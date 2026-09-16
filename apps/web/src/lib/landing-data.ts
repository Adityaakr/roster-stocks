/**
 * Everything the landing page prints that is measured rather than written: the visibility scan, the latest record on
 * this deployment, the example wallet's positions and receipts, and the transaction tape. Read at request time,
 * cached for a minute, printed as stored (percentages are truncated to two decimals by the resolver, never rounded).
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { LookthroughClient, receiptPda } from "@lookthrough/sdk";
import { cluster, connection, forkReachable, keysDir, readVisibility, store } from "@/lib/server";

export interface VisibilityData {
  symbol: string;
  decimals?: number;
  slot: number;
  timestamp: number;
  accountsScanned: number;
  accountsRaw: string;
  walletVisibleRaw: string;
  programHeldRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; program: string | null; raw: string; pct: string; accounts: number }[];
}

export interface TapeRow {
  type: "publish_record" | "fund_vault" | "claim" | "cast_vote" | "close_action";
  slot: number | null;
  signature: string | null;
}

export interface LandingData {
  cluster: "fork" | "devnet";
  clusterLabel: string;
  spy: VisibilityData | null;
  aapl: VisibilityData | null;
  latest: {
    id: string;
    kind: "distribution" | "vote";
    recordSlot: number;
    slotActual: number;
    root: string;
    contentHash: string;
    attributedPct: string;
    unattributedPct: string;
    leaves: number;
    amountPerShareMicro: string | null;
    publishedSlot: number | null;
  } | null;
  example: {
    wallet: string;
    registeredAtSlot: string | null;
    entitlement6: string | null;
    direct6: string | null;
    raydium6: string | null;
    kamino6: string | null;
    claim: { amountPaid: string; slot: string; signature: string | null } | null;
    vote: { choice: string; entitlement: string; slot: string; signature: string | null } | null;
  } | null;
  tape: TapeRow[];
}

const pct2 = (part: bigint, whole: bigint) => {
  if (whole === 0n) return "0.00";
  const bp = (part * 10_000n) / whole;
  return `${bp / 100n}.${(bp % 100n).toString().padStart(2, "0")}`;
};

let cache: { at: number; value: LandingData } | null = null;

export async function landingData(): Promise<LandingData> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const value = await compute();
  cache = { at: Date.now(), value };
  return value;
}

async function compute(): Promise<LandingData> {
  const c = cluster();
  const spy = readVisibility("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W") as VisibilityData | null;
  const aapl = readVisibility("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp") as VisibilityData | null;
  const s = store();
  const actions = s.list().filter((a) => a.snapshot);
  const dist = actions.find((a) => a.kind === "distribution" && a.onchain) ?? actions.find((a) => a.kind === "distribution") ?? null;
  const vote = actions.find((a) => a.kind === "vote" && a.onchain) ?? null;
  const latestAction = dist ?? actions[0] ?? null;

  let latest: LandingData["latest"] = null;
  if (latestAction?.snapshot) {
    let unattributedPct = "0.00";
    try {
      const ent = s.readJson<{ attributedRaw: string; unattributedRaw: string }>(latestAction.id, "entitlements.json");
      unattributedPct = pct2(BigInt(ent.unattributedRaw), BigInt(ent.attributedRaw) + BigInt(ent.unattributedRaw));
    } catch {
      // keep the default
    }
    latest = {
      id: latestAction.id,
      kind: latestAction.kind,
      recordSlot: latestAction.recordSlot,
      slotActual: latestAction.snapshot.slotActual,
      root: latestAction.snapshot.root,
      contentHash: latestAction.snapshot.contentHash,
      attributedPct: latestAction.snapshot.attributedPct,
      unattributedPct,
      leaves: latestAction.snapshot.leaves,
      amountPerShareMicro: latestAction.amountPerShareMicro ?? null,
      publishedSlot: latestAction.onchain?.publishedSlot ?? null
    };
  }

  // The example wallet is the first seeded wallet (Alice) when it exists.
  const alicePath = path.join(keysDir(), "alice.json");
  const alice = existsSync(alicePath) ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(alicePath, "utf8")))).publicKey : null;
  let example: LandingData["example"] = null;
  const tape: TapeRow[] = [];
  const up = await forkReachable();

  if (alice && latestAction?.snapshot) {
    let direct6: string | null = null;
    let raydium6: string | null = null;
    let kamino6: string | null = null;
    let entitlement6: string | null = null;
    try {
      const ent = s.readJson<{ multiplier: string; decimals: number; entries: { wallet: string; entitlement: string; breakdown: { source: string; rawAttributed: string }[] }[] }>(latestAction.id, "entitlements.json");
      const e = ent.entries.find((x) => x.wallet === alice.toBase58());
      if (e) {
        entitlement6 = e.entitlement;
        const toShares6 = (raw: string) => {
          // raw × multiplier × 1e6 / 10^decimals, floored, same rule as the resolver (decimal-free here because the multiplier is a short string).
          const m = ent.multiplier;
          const [ip, fp = ""] = m.split(".");
          const scale = 10n ** BigInt(fp.length);
          const mult = BigInt(ip ?? "1") * scale + BigInt(fp || "0");
          return ((BigInt(raw) * mult * 1_000_000n) / scale / 10n ** BigInt(ent.decimals)).toString();
        };
        const sum = (src: string) => e.breakdown.filter((b) => b.source === src).reduce((a, b) => a + BigInt(b.rawAttributed), 0n).toString();
        direct6 = toShares6(sum("direct"));
        raydium6 = toShares6(sum("raydium_clmm"));
        kamino6 = toShares6(sum("kamino_lend"));
      }
    } catch {
      // no entitlement file
    }

    let registeredAtSlot: string | null = null;
    let claim: NonNullable<LandingData["example"]>["claim"] = null;
    let voteReceipt: NonNullable<LandingData["example"]>["vote"] = null;
    if (up) {
      try {
        const conn = connection();
        const client = LookthroughClient.readOnly(conn);
        const reg = await client.isRegistered(new PublicKey(latestAction.mint), alice);
        registeredAtSlot = reg.registered ? String(reg.slot) : null;
        const sigFor = async (address: PublicKey): Promise<{ signature: string; slot: number } | null> => {
          const sigs = await conn.getSignaturesForAddress(address, { limit: 5 }).catch(() => []);
          const ok = sigs.filter((x) => !x.err);
          const last = ok[ok.length - 1];
          return last ? { signature: last.signature, slot: last.slot } : null;
        };
        if (dist?.onchain) {
          const id = new Uint8Array(Buffer.from(dist.actionIdHex, "hex"));
          const r = await client.fetchReceipt(id, alice);
          const sig = r ? await sigFor(receiptPda(client.programId, client.action(id), alice)) : null;
          if (r) claim = { amountPaid: r.amountPaid.toString(), slot: r.slot.toString(), signature: sig?.signature ?? null };
          const actionSigs = await conn.getSignaturesForAddress(new PublicKey(dist.onchain.actionPda), { limit: 10 }).catch(() => []);
          const bySig = new Map(actionSigs.map((x) => [x.signature, x.slot]));
          tape.push({ type: "publish_record", slot: bySig.get(dist.onchain.createTx) ?? dist.onchain.publishedSlot ?? null, signature: dist.onchain.createTx });
          if (dist.onchain.fundTx) tape.push({ type: "fund_vault", slot: bySig.get(dist.onchain.fundTx) ?? null, signature: dist.onchain.fundTx });
          if (r) tape.push({ type: "claim", slot: sig?.slot ?? Number(r.slot), signature: sig?.signature ?? null });
        }
        if (vote?.onchain) {
          const id = new Uint8Array(Buffer.from(vote.actionIdHex, "hex"));
          const r = await client.fetchReceipt(id, alice);
          const sig = r ? await sigFor(receiptPda(client.programId, client.action(id), alice)) : null;
          if (r) {
            voteReceipt = { choice: r.choice ?? "for", entitlement: r.entitlement.toString(), slot: r.slot.toString(), signature: sig?.signature ?? null };
            tape.push({ type: "cast_vote", slot: sig?.slot ?? Number(r.slot), signature: sig?.signature ?? null });
          }
        }
        tape.push({ type: "close_action", slot: null, signature: null });
      } catch {
        // chain unreachable mid-way: keep what we have
      }
    }
    example = { wallet: alice.toBase58(), registeredAtSlot, entitlement6, direct6, raydium6, kamino6, claim, vote: voteReceipt };
  }

  return { cluster: c, clusterLabel: c === "devnet" ? "Devnet" : "Mainnet fork", spy, aapl, latest, example, tape };
}
