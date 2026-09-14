use anchor_lang::prelude::*;
use anchor_spl::token_interface::{close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    error::LookthroughError,
    instructions::ACTION_SEED,
    state::{Action, ActionKind},
};

#[event]
pub struct ActionClosed {
    pub action: Pubkey,
    pub residual_returned: u64,
    pub slot: u64,
}

#[derive(Accounts)]
pub struct CloseAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [ACTION_SEED, action.action_id.as_ref()], bump = action.bump, has_one = authority, has_one = vault, has_one = usdc_mint)]
    pub action: Account<'info, Action>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = authority)]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_close_action(ctx: Context<CloseAction>) -> Result<()> {
    let slot = Clock::get()?.slot;
    let action = &ctx.accounts.action;
    require!(!action.closed, LookthroughError::ActionClosed);
    let window_end = match action.kind {
        ActionKind::Distribution => action.claims_close_slot,
        ActionKind::Vote => action.deadline_slot,
    };
    require!(slot >= window_end, LookthroughError::ActionStillOpen);

    let residual = ctx.accounts.vault.amount;
    let action_id = action.action_id;
    let bump = action.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[ACTION_SEED, action_id.as_ref(), &[bump]]];
    if residual > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.action.to_account_info(),
                },
                signer_seeds,
            ),
            residual,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: ctx.accounts.action.to_account_info(),
        },
        signer_seeds,
    ))?;
    let action = &mut ctx.accounts.action;
    action.closed = true;
    emit!(ActionClosed { action: action.key(), residual_returned: residual, slot });
    Ok(())
}
