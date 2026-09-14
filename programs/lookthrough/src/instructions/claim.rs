use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    error::LookthroughError,
    instructions::{ACTION_SEED, CLAIM_SEED, REGISTRATION_SEED},
    merkle,
    state::{Action, ActionKind, ClaimReceipt, Registration},
};

#[event]
pub struct Claimed {
    pub action: Pubkey,
    pub wallet: Pubkey,
    pub entitlement: u64,
    pub amount_paid: u64,
    pub slot: u64,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        seeds = [REGISTRATION_SEED, mint.key().as_ref(), wallet.key().as_ref()],
        bump = registration.bump,
        constraint = registration.wallet == wallet.key() @ LookthroughError::NotRegistered,
        constraint = registration.mint == mint.key() @ LookthroughError::NotRegistered,
    )]
    pub registration: Account<'info, Registration>,
    #[account(
        mut,
        seeds = [ACTION_SEED, action.action_id.as_ref()],
        bump = action.bump,
        has_one = mint,
        has_one = vault,
        has_one = usdc_mint,
    )]
    pub action: Account<'info, Action>,
    #[account(
        init,
        payer = wallet,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [CLAIM_SEED, action.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, ClaimReceipt>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = wallet)]
    pub wallet_token_account: InterfaceAccount<'info, TokenAccount>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_claim(ctx: Context<Claim>, entitlement: u64, proof: Vec<[u8; 32]>) -> Result<()> {
    let slot = Clock::get()?.slot;
    let action = &ctx.accounts.action;
    require!(action.kind == ActionKind::Distribution, LookthroughError::WrongActionKind);
    require!(!action.closed, LookthroughError::ActionClosed);
    require!(action.funded, LookthroughError::Underfunded);
    require!(slot < action.claims_close_slot, LookthroughError::ClaimsClosed);
    require!(entitlement > 0, LookthroughError::ZeroEntitlement);
    require!(proof.len() <= merkle::MAX_PROOF_LEN, LookthroughError::ProofTooLong);
    require!(
        ctx.accounts.registration.registered_at_slot <= action.snapshot_slot,
        LookthroughError::RegisteredAfterSnapshot
    );
    let leaf = merkle::leaf_hash(&action.action_id, &ctx.accounts.wallet.key(), &action.mint, action.snapshot_slot, entitlement);
    require!(merkle::verify(leaf, &proof, &action.root), LookthroughError::InvalidProof);

    let amount = action.payout_for(entitlement).ok_or(LookthroughError::Overflow)?;
    let action_id = action.action_id;
    let bump = action.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[ACTION_SEED, action_id.as_ref(), &[bump]]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.wallet_token_account.to_account_info(),
                authority: ctx.accounts.action.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let action = &mut ctx.accounts.action;
    action.claimed_total = action.claimed_total.checked_add(amount).ok_or(LookthroughError::Overflow)?;
    let receipt = &mut ctx.accounts.receipt;
    receipt.action = action.key();
    receipt.wallet = ctx.accounts.wallet.key();
    receipt.entitlement = entitlement;
    receipt.amount_paid = amount;
    receipt.choice = None;
    receipt.slot = slot;
    receipt.bump = ctx.bumps.receipt;
    emit!(Claimed { action: action.key(), wallet: receipt.wallet, entitlement, amount_paid: amount, slot });
    Ok(())
}
