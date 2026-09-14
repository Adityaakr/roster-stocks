import { PublicKey } from "@solana/web3.js";

export const REGISTRATION_SEED = Buffer.from("reg");
export const ACTION_SEED = Buffer.from("action");
export const VAULT_SEED = Buffer.from("vault");
export const CLAIM_SEED = Buffer.from("claim");

export function registrationPda(programId: PublicKey, mint: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([REGISTRATION_SEED, mint.toBuffer(), wallet.toBuffer()], programId)[0];
}
export function actionPda(programId: PublicKey, actionId: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync([ACTION_SEED, Buffer.from(actionId)], programId)[0];
}
export function vaultPda(programId: PublicKey, action: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([VAULT_SEED, action.toBuffer()], programId)[0];
}
export function receiptPda(programId: PublicKey, action: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([CLAIM_SEED, action.toBuffer(), wallet.toBuffer()], programId)[0];
}
