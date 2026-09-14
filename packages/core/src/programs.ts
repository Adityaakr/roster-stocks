/**
 * Known program ids used for classification labels. Every entry records how the id was verified.
 * An owner program that is not in this map is labelled "other programs"; we never guess a name.
 */
export interface KnownProgram {
  id: string;
  name: string;
  adapterId?: string;
  verifiedBy: string;
}

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
export const RAYDIUM_CPMM_PROGRAM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const KAMINO_LEND_PROGRAM = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export const KNOWN_PROGRAMS: readonly KnownProgram[] = [
  { id: TOKEN_PROGRAM, name: "SPL Token", verifiedBy: "@solana/spl-token TOKEN_PROGRAM_ID" },
  { id: TOKEN_2022_PROGRAM, name: "Token-2022", verifiedBy: "@solana/spl-token TOKEN_2022_PROGRAM_ID; owner of the AAPLx mint" },
  { id: SYSTEM_PROGRAM, name: "System program", verifiedBy: "@solana/web3.js SystemProgram.programId" },
  { id: RAYDIUM_CLMM_PROGRAM, name: "Raydium CLMM", adapterId: "raydium_clmm", verifiedBy: "api-v3.raydium.io programId for Concentrated pools, 2026-09-14" },
  { id: RAYDIUM_CPMM_PROGRAM, name: "Raydium CPMM", verifiedBy: "api-v3.raydium.io programId for Standard pools, 2026-09-14" },
  { id: KAMINO_LEND_PROGRAM, name: "Kamino Lend", adapterId: "kamino_lend", verifiedBy: "@kamino-finance/klend-sdk PROGRAM_ID; owner of reserve CKJbq…" }
];

const byId = new Map(KNOWN_PROGRAMS.map((p) => [p.id, p]));

export function knownProgram(id: string | null | undefined): KnownProgram | undefined {
  return id ? byId.get(id) : undefined;
}

export function programLabel(id: string | null | undefined): string {
  return knownProgram(id)?.name ?? "other programs";
}
