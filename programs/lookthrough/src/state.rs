use anchor_lang::prelude::*;

/// A wallet's one-time opt-in for corporate actions on a mint. Seeds: ["reg", mint, wallet].
#[account]
#[derive(InitSpace)]
pub struct Registration {
    pub wallet: Pubkey,
    pub mint: Pubkey,
    pub registered_at_slot: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ActionKind {
    Distribution,
    Vote,
}

/// A published corporate action: the Merkle root over registered holders' entitlements at a snapshot slot.
/// Seeds: ["action", action_id].
#[account]
#[derive(InitSpace)]
pub struct Action {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub action_id: [u8; 32],
    pub kind: ActionKind,
    pub snapshot_slot: u64,
    pub root: [u8; 32],
    pub content_hash: [u8; 32],
    #[max_len(200)]
    pub metadata_uri: String,
    /// Sum of all entitlements in the tree, in 6-decimal share units.
    pub total_entitlement: u64,
    pub created_at_slot: u64,
    pub bump: u8,
    pub closed: bool,
    // Distribution
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    /// USDC micro-units paid per 1e6 share units.
    pub amount_per_share_micro: u64,
    pub claimed_total: u64,
    pub claims_close_slot: u64,
    pub funded: bool,
    // Vote
    pub question_hash: [u8; 32],
    pub deadline_slot: u64,
    pub for_weight: u64,
    pub against_weight: u64,
    pub abstain_weight: u64,
    pub voters: u32,
}

impl Action {
    /// USDC owed for an entitlement: entitlement × amount_per_share_micro / 1e6, floored, in u128 then checked into u64.
    pub fn payout_for(&self, entitlement: u64) -> Option<u64> {
        let amount = (entitlement as u128).checked_mul(self.amount_per_share_micro as u128)? / 1_000_000u128;
        u64::try_from(amount).ok()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum VoteChoice {
    For,
    Against,
    Abstain,
}

/// One receipt per (action, wallet): blocks double claims and double votes. Seeds: ["claim", action, wallet].
#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub action: Pubkey,
    pub wallet: Pubkey,
    pub entitlement: u64,
    pub amount_paid: u64,
    pub choice: Option<VoteChoice>,
    pub slot: u64,
    pub bump: u8,
}
