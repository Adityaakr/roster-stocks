use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{instructions::REGISTRATION_SEED, state::Registration};

#[event]
pub struct Registered {
    pub wallet: Pubkey,
    pub mint: Pubkey,
    pub slot: u64,
}

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = wallet,
        space = 8 + Registration::INIT_SPACE,
        seeds = [REGISTRATION_SEED, mint.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub registration: Account<'info, Registration>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register(ctx: Context<Register>) -> Result<()> {
    let slot = Clock::get()?.slot;
    let reg = &mut ctx.accounts.registration;
    reg.wallet = ctx.accounts.wallet.key();
    reg.mint = ctx.accounts.mint.key();
    reg.registered_at_slot = slot;
    reg.bump = ctx.bumps.registration;
    emit!(Registered { wallet: reg.wallet, mint: reg.mint, slot });
    Ok(())
}
