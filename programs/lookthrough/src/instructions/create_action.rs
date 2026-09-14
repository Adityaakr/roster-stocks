use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    error::LookthroughError,
    instructions::ACTION_SEED,
    state::{Action, ActionKind},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateActionParams {
    pub action_id: [u8; 32],
    pub kind: ActionKind,
    pub snapshot_slot: u64,
    pub root: [u8; 32],
    pub content_hash: [u8; 32],
    pub metadata_uri: String,
    pub total_entitlement: u64,
    /// Distribution: USDC micro-units per 1e6 share units. Ignored for votes.
    pub amount_per_share_micro: u64,
    /// Distribution: last slot at which claims are accepted. Ignored for votes.
    pub claims_close_slot: u64,
    /// Vote: keccak256 of the question text. Ignored for distributions.
    pub question_hash: [u8; 32],
    /// Vote: last slot at which votes are accepted. Ignored for distributions.
    pub deadline_slot: u64,
}

#[event]
pub struct ActionCreated {
    pub action: Pubkey,
    pub action_id: [u8; 32],
    pub kind: ActionKind,
    pub mint: Pubkey,
    pub snapshot_slot: u64,
    pub root: [u8; 32],
    pub total_entitlement: u64,
}

#[derive(Accounts)]
#[instruction(params: CreateActionParams)]
pub struct CreateAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    /// The payout mint (USDC in the demo). Votes get an unused vault for uniformity.
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + Action::INIT_SPACE,
        seeds = [ACTION_SEED, params.action_id.as_ref()],
        bump
    )]
    pub action: Account<'info, Action>,
    /// Vault owned by the action PDA. Token-2022 or SPL Token, whichever owns `usdc_mint`.
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = action,
        token::token_program = token_program,
        seeds = [b"vault", action.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_action(ctx: Context<CreateAction>, params: CreateActionParams) -> Result<()> {
    require!(params.metadata_uri.len() <= 200, LookthroughError::MetadataTooLong);
    let slot = Clock::get()?.slot;
    let action = &mut ctx.accounts.action;
    action.authority = ctx.accounts.authority.key();
    action.mint = ctx.accounts.mint.key();
    action.action_id = params.action_id;
    action.kind = params.kind;
    action.snapshot_slot = params.snapshot_slot;
    action.root = params.root;
    action.content_hash = params.content_hash;
    action.metadata_uri = params.metadata_uri;
    action.total_entitlement = params.total_entitlement;
    action.created_at_slot = slot;
    action.bump = ctx.bumps.action;
    action.closed = false;
    action.usdc_mint = ctx.accounts.usdc_mint.key();
    action.vault = ctx.accounts.vault.key();
    action.amount_per_share_micro = params.amount_per_share_micro;
    action.claimed_total = 0;
    action.claims_close_slot = params.claims_close_slot;
    action.funded = false;
    action.question_hash = params.question_hash;
    action.deadline_slot = params.deadline_slot;
    action.for_weight = 0;
    action.against_weight = 0;
    action.abstain_weight = 0;
    action.voters = 0;
    // A vote needs no funding; the vault stays empty.
    if params.kind == ActionKind::Vote {
        action.funded = true;
    }
    emit!(ActionCreated {
        action: action.key(),
        action_id: params.action_id,
        kind: params.kind,
        mint: action.mint,
        snapshot_slot: params.snapshot_slot,
        root: params.root,
        total_entitlement: params.total_entitlement,
    });
    Ok(())
}
