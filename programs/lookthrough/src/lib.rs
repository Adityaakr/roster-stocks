#![deny(warnings)]
#![allow(unexpected_cfgs)]
//! Lookthrough: opt-in registry, record-date Merkle commitments, and a claim and vote router for
//! issuer-defined entitlements on tokenized stocks.

pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("HVB7th73BLUF6kdHWcWkvNW3kGiVPHusfT97iQ5UnA4S");

#[program]
pub mod lookthrough {
    use super::*;

    /// Register the signing wallet for corporate actions on `mint`. One signature, no authority.
    pub fn register(ctx: Context<Register>) -> Result<()> {
        instructions::register::handle_register(ctx)
    }

    /// Publish an action: root, content hash and parameters. Authority only (the registrar).
    pub fn create_action(ctx: Context<CreateAction>, params: CreateActionParams) -> Result<()> {
        instructions::create_action::handle_create_action(ctx, params)
    }

    /// Move USDC into the action vault. Claims open once the vault covers the total entitlement.
    pub fn fund_distribution(ctx: Context<FundDistribution>, amount: u64) -> Result<()> {
        instructions::fund_distribution::handle_fund_distribution(ctx, amount)
    }

    /// Claim a distribution with a Merkle proof. Pays entitlement × amount_per_share_micro / 1e6 USDC.
    pub fn claim(ctx: Context<Claim>, entitlement: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::claim::handle_claim(ctx, entitlement, proof)
    }

    /// Cast a weighted vote with a Merkle proof, before the deadline slot.
    pub fn cast_vote(ctx: Context<CastVote>, entitlement: u64, proof: Vec<[u8; 32]>, choice: VoteChoice) -> Result<()> {
        instructions::cast_vote::handle_cast_vote(ctx, entitlement, proof, choice)
    }

    /// After the window, return residual USDC to the authority and close the vault.
    pub fn close_action(ctx: Context<CloseAction>) -> Result<()> {
        instructions::close_action::handle_close_action(ctx)
    }
}
