use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    error::LookthroughError,
    state::{Action, ActionKind},
};

#[event]
pub struct Funded {
    pub action: Pubkey,
    pub amount: u64,
    pub vault_balance: u64,
    pub required: u64,
    pub funded: bool,
}

#[derive(Accounts)]
pub struct FundDistribution<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority, has_one = vault, has_one = usdc_mint)]
    pub action: Account<'info, Action>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = authority)]
    pub funder_token_account: InterfaceAccount<'info, TokenAccount>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_fund_distribution(ctx: Context<FundDistribution>, amount: u64) -> Result<()> {
    let action = &ctx.accounts.action;
    require!(action.kind == ActionKind::Distribution, LookthroughError::WrongActionKind);
    require!(!action.closed, LookthroughError::ActionClosed);
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.funder_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;
    ctx.accounts.vault.reload()?;
    let required = ctx
        .accounts
        .action
        .payout_for(ctx.accounts.action.total_entitlement)
        .ok_or(LookthroughError::Overflow)?;
    // Compare the vault balance after the transfer, not the single amount, so partial top-ups are idempotent.
    let funded = ctx.accounts.vault.amount >= required;
    let action = &mut ctx.accounts.action;
    action.funded = funded;
    emit!(Funded {
        action: action.key(),
        amount,
        vault_balance: ctx.accounts.vault.amount,
        required,
        funded,
    });
    Ok(())
}
