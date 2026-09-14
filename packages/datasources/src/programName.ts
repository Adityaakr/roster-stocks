/**
 * Label an unknown program without guessing: use the known-programs map first, then the program's own
 * on-chain Anchor IDL account (name field), else "other programs".
 * IDL account address: createWithSeed(findProgramAddress([], program), "anchor:idl", program);
 * data = 8 discriminator | 32 authority | 4 len | zlib(json). Verified on mainnet for 6EF8rr… (name "pump") on 2026-09-14.
 */
import { PublicKey } from "@solana/web3.js";
import { inflateSync } from "node:zlib";
import { knownProgram, type Base58, type ChainReader } from "@lookthrough/core";

const cache = new Map<Base58, string>();

export async function programDisplayName(reader: ChainReader, programId: Base58 | null): Promise<string> {
  if (!programId) return "other programs (owner has no account)";
  const known = knownProgram(programId);
  if (known) return known.name;
  const cached = cache.get(programId);
  if (cached) return cached;
  let label = "other programs";
  try {
    const program = new PublicKey(programId);
    const [base] = PublicKey.findProgramAddressSync([], program);
    const idlAddr = await PublicKey.createWithSeed(base, "anchor:idl", program);
    const acc = await reader.getAccount(idlAddr.toBase58());
    if (acc && acc.data.length > 44) {
      const len = new DataView(acc.data.buffer, acc.data.byteOffset + 40, 4).getUint32(0, true);
      const json = JSON.parse(inflateSync(Buffer.from(acc.data.subarray(44, 44 + len))).toString()) as { name?: string; metadata?: { name?: string } };
      const name = json.name ?? json.metadata?.name;
      if (name) label = `other programs (on-chain IDL name: ${name})`;
    }
  } catch {
    // no IDL or not an Anchor program: keep the generic label
  }
  cache.set(programId, label);
  return label;
}
