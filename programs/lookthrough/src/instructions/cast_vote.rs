use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    error::LookthroughError,
    instructions::{ACTION_SEED, CLAIM_SEED, REGISTRATION_SEED},
    merkle,
    state::{Action, ActionKind, ClaimReceipt, Registration, VoteChoice},
};

#[event]
pub struct VoteCast {
    pub action: Pubkey,
    pub wallet: Pubkey,
    pub entitlement: u64,
    pub choice: VoteChoice,
    pub for_weight: u64,
    pub against_weight: u64,
    pub abstain_weight: u64,
    pub voters: u32,
    pub slot: u64,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
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
    #[account(mut, seeds = [ACTION_SEED, action.action_id.as_ref()], bump = action.bump, has_one = mint)]
    pub action: Account<'info, Action>,
    #[account(
        init,
        payer = wallet,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [CLAIM_SEED, action.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, ClaimReceipt>,
    pub system_program: Program<'info, System>,
}

pub fn handle_cast_vote(ctx: Context<CastVote>, entitlement: u64, proof: Vec<[u8; 32]>, choice: VoteChoice) -> Result<()> {
    let slot = Clock::get()?.slot;
    let action = &ctx.accounts.action;
    require!(action.kind == ActionKind::Vote, LookthroughError::WrongActionKind);
    require!(!action.closed, LookthroughError::ActionClosed);
    require!(slot < action.deadline_slot, LookthroughError::VoteClosed);
    require!(entitlement > 0, LookthroughError::ZeroEntitlement);
    require!(proof.len() <= merkle::MAX_PROOF_LEN, LookthroughError::ProofTooLong);
    require!(
        ctx.accounts.registration.registered_at_slot <= action.snapshot_slot,
        LookthroughError::RegisteredAfterSnapshot
    );
    let leaf = merkle::leaf_hash(&action.action_id, &ctx.accounts.wallet.key(), &action.mint, action.snapshot_slot, entitlement);
    require!(merkle::verify(leaf, &proof, &action.root), LookthroughError::InvalidProof);

    let action = &mut ctx.accounts.action;
    match choice {
        VoteChoice::For => action.for_weight = action.for_weight.checked_add(entitlement).ok_or(LookthroughError::Overflow)?,
        VoteChoice::Against => action.against_weight = action.against_weight.checked_add(entitlement).ok_or(LookthroughError::Overflow)?,
        VoteChoice::Abstain => action.abstain_weight = action.abstain_weight.checked_add(entitlement).ok_or(LookthroughError::Overflow)?,
    }
    action.voters = action.voters.checked_add(1).ok_or(LookthroughError::Overflow)?;
    let receipt = &mut ctx.accounts.receipt;
    receipt.action = action.key();
    receipt.wallet = ctx.accounts.wallet.key();
    receipt.entitlement = entitlement;
    receipt.amount_paid = 0;
    receipt.choice = Some(choice);
    receipt.slot = slot;
    receipt.bump = ctx.bumps.receipt;
    emit!(VoteCast {
        action: action.key(),
        wallet: receipt.wallet,
        entitlement,
        choice,
        for_weight: action.for_weight,
        against_weight: action.against_weight,
        abstain_weight: action.abstain_weight,
        voters: action.voters,
        slot,
    });
    Ok(())
}
