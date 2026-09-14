use anchor_lang::prelude::*;

#[error_code]
pub enum LookthroughError {
    #[msg("Wallet is not registered for this mint at the snapshot slot")]
    NotRegistered,
    #[msg("Merkle proof does not match the published root")]
    InvalidProof,
    #[msg("This wallet has already claimed or voted on this action")]
    AlreadyClaimed,
    #[msg("Voting closed at the deadline slot")]
    VoteClosed,
    #[msg("Distribution vault does not cover the total entitlement")]
    Underfunded,
    #[msg("Proof has more than 32 nodes")]
    ProofTooLong,
    #[msg("Action kind does not allow this instruction")]
    WrongActionKind,
    #[msg("Entitlement must be greater than zero")]
    ZeroEntitlement,
    #[msg("Claims closed at the claims close slot")]
    ClaimsClosed,
    #[msg("Action is still open")]
    ActionStillOpen,
    #[msg("Action is closed")]
    ActionClosed,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Metadata URI is longer than 200 bytes")]
    MetadataTooLong,
    #[msg("Registered after the snapshot slot")]
    RegisteredAfterSnapshot,
}
