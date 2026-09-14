/**
 * Classify token accounts: adapter container (matched by address), wallet (on-curve owner),
 * or program-held (off-curve owner) which is labelled by the owner account's program when known.
 */
import { PublicKey } from "@solana/web3.js";
import { SYSTEM_PROGRAM, type Base58, type ChainReader, type ContainerInfo, type TokenAccountRow } from "@lookthrough/core";
import { programDisplayName } from "@lookthrough/datasources";

export interface ProgramHeldRow extends TokenAccountRow {
  /** Program that owns the token account's owner, or null when that owner has no account on chain. */
  ownerProgram: Base58 | null;
  label: string;
}

export interface Classification {
  wallet: TokenAccountRow[];
  container: { row: TokenAccountRow; container: ContainerInfo }[];
  programHeld: ProgramHeldRow[];
}

const onCurveCache = new Map<string, boolean>();
export function isOnCurve(pubkey: Base58): boolean {
  let v = onCurveCache.get(pubkey);
  if (v === undefined) {
    v = PublicKey.isOnCurve(new PublicKey(pubkey).toBytes());
    onCurveCache.set(pubkey, v);
  }
  return v;
}

export async function classifyAccounts(reader: ChainReader, rows: TokenAccountRow[], containers: ContainerInfo[]): Promise<Classification> {
  const byAddress = new Map(containers.map((c) => [c.address, c]));
  const out: Classification = { wallet: [], container: [], programHeld: [] };
  const pending: TokenAccountRow[] = [];
  for (const row of rows) {
    const c = byAddress.get(row.pubkey);
    if (c) out.container.push({ row, container: c });
    else if (isOnCurve(row.owner)) out.wallet.push(row);
    else pending.push(row);
  }
  // Look up the owning program of every distinct off-curve owner (data slice of length 0: we only need the owner field).
  const owners = [...new Set(pending.map((r) => r.owner))];
  const ownerAccounts = await reader.getMultipleAccounts(owners, { offset: 0, length: 0 });
  const ownerProgram = new Map<Base58, Base58 | null>();
  owners.forEach((o, i) => ownerProgram.set(o, ownerAccounts[i]?.owner ?? null));
  const labels = new Map<Base58 | null, string>();
  for (const prog of new Set(ownerProgram.values())) {
    labels.set(prog, prog === SYSTEM_PROGRAM ? "other programs (PDA holding lamports only)" : await programDisplayName(reader, prog));
  }
  for (const row of pending) {
    const prog = ownerProgram.get(row.owner) ?? null;
    out.programHeld.push({ ...row, ownerProgram: prog, label: labels.get(prog) ?? "other programs" });
  }
  return out;
}
