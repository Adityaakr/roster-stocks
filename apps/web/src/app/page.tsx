import Link from "next/link";
import { SupplyMap, type Segment } from "@/components/supply-map";
import { ProductCard } from "@/components/product-card";
import { readVisibility, store } from "@/lib/server";
import { proofFor } from "@lookthrough/registrar";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { repoRoot } from "@/lib/server";
import { shares, slotLabel, timeLabel, usdc } from "@/lib/format";

interface Visibility {
  mint: string;
  symbol: string;
  slot: number;
  timestamp: number;
  accountsRaw: string;
  accountsScanned: number;
  walletVisibleRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; program: string | null; raw: string; pct: string; accounts: number }[];
}

function toSegments(v: Visibility): Segment[] {
  const total = BigInt(v.accountsRaw);
  const p = (raw: string) => Number((BigInt(raw) * 10_000n) / total) / 100;
  const segs: Segment[] = [{ label: "Wallets", pct: p(v.walletVisibleRaw), kind: "wallet" }];
  let other = 0;
  for (const b of v.breakdownByProgram) {
    if (b.label === "Raydium CLMM" || b.label === "Kamino Lend") segs.push({ label: b.label, pct: p(b.raw), kind: "adapter" });
    else other += p(b.raw);
  }
  if (other > 0) segs.push({ label: "Other programs", pct: Math.round(other * 100) / 100, kind: "other" });
  return segs;
}

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

export default function Landing() {
  const stats = [DEFAULT_MINT, "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W"].map((m) => readVisibility(m) as Visibility | null).filter((v): v is Visibility => v !== null);
  const spy = stats.find((s) => s.symbol === "SPYx") ?? stats[0] ?? null;
  const aapl = stats.find((s) => s.symbol === "AAPLx") ?? null;

  // The step chips show the latest real run, never illustrative numbers.
  const s = store();
  const latest = s.list().find((a) => a.kind === "distribution" && a.snapshot) ?? null;
  const alicePath = path.join(repoRoot(), ".keys/alice.json");
  const alice = existsSync(alicePath) ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(alicePath, "utf8")))).publicKey.toBase58() : null;
  const leaf = latest && alice ? proofFor(s, latest.id, alice) : null;
  const payout = latest && leaf ? (BigInt(leaf.leaf.entitlement) * BigInt(latest.amountPerShareMicro ?? "0")) / 1_000_000n : null;
  const steps = [
    { n: 1, t: "Holders opt in", d: "One signature registers a wallet for corporate actions on a mint. Public, no identity, no KYC.", ui: <span className="chip chip-accent">Register for corporate actions</span> },
    { n: 2, t: "The resolver takes the snapshot", d: "At the record slot every token account is attributed once: wallets directly, Raydium and Kamino positions through issuer-defined rules, the rest labelled and left unattributed.", ui: <span className="chip">{latest?.snapshot ? `${latest.snapshot.attributedPct}% attributed, double counted 0` : "attributed plus unattributed equals supply"}</span> },
    { n: 3, t: "Only the root goes on-chain", d: "Entitlements are hashed into a Merkle tree. The root, a content hash and the slot are published. Anyone can recompute the root from the entitlement file.", ui: <span className="chip num">{latest?.snapshot ? `root ${latest.snapshot.root.slice(0, 4)}…${latest.snapshot.root.slice(-4)}` : "root, content hash, slot"}</span> },
    { n: 4, t: "Holders claim or vote", d: "A proof unlocks the USDC distribution or a weighted vote. The program checks registration, inclusion and single use.", ui: <span className="chip chip-accent">{payout !== null && leaf ? `Claim ${usdc(payout)} USDC for ${shares(leaf.leaf.entitlement, 2, 2)} shares` : "Claim with a proof"}</span> }
  ];

  return (
    <div className="pt-12 sm:pt-16">
      {/* Hero: the use case in one breath, the product beside it. */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-10 lg:gap-14 items-center">
        <div>
          <h1 className="display text-[32px] sm:text-[44px]">Corporate actions for tokenized stocks, even when the shares sit in DeFi.</h1>
          <p className="mt-5 text-[16px] text-ink-2 max-w-[520px]">
            When a tokenized stock goes into a Raydium pool or a Kamino reserve, the program becomes its owner and the holder disappears from the register. Lookthrough is the record-date process that sees through those positions, so issuers can pay a distribution or run a vote and holders can take part without unwinding anything.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/holder?demo=1" className="btn btn-primary">See a holder&apos;s positions</Link>
            <Link href="/issuer?demo=1" className="btn">Run a record date</Link>
          </div>
        </div>
        <ProductCard />
      </section>
      <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-[14px] border-t border-line pt-6">
        <li><div className="font-medium">Issuers and transfer agents</div><div className="text-ink-2 mt-1">A record-date process that survives composability: who is entitled, with proof, without asking anyone to leave a pool.</div></li>
        <li><div className="font-medium">Holders</div><div className="text-ink-2 mt-1">Register once, then claim a distribution or vote with a Merkle proof while the Raydium position and the Kamino deposit stay where they are.</div></li>
        <li><div className="font-medium">Protocols and wallets</div><div className="text-ink-2 mt-1">An open entitlement interface. A lending market keeps its depositors enfranchised; a wallet with its own voting rail reads the same tree.</div></li>
      </ul>

      {/* Why: the mainnet number. */}
      <section className="mt-20">
        <div className="max-w-[720px]">
          <h2 className="text-[28px]">A wallet scan misses the part that moved into DeFi.</h2>
          <p className="mt-3 text-ink-2">Read from every token account on mainnet, not estimated. Wallets are what a scan sees; everything else is held by a program.</p>
        </div>
        <div className="mt-6 panel p-6 sm:p-8">
          {spy ? (
            <>
              <SupplyMap segments={toSegments(spy)} hiddenPct={Number(spy.programHeldPct)} symbol={spy.symbol} />
              <p className="mt-4 text-[13px] text-ink-3">
                Slot <span className="num">{slotLabel(spy.slot)}</span>, {timeLabel(spy.timestamp)}, <span className="num">{spy.accountsScanned.toLocaleString("en-US")}</span> token accounts. Programs are named from their on-chain IDL or left as other programs, never guessed.
                {aapl ? <> AAPLx at slot <span className="num">{slotLabel(aapl.slot)}</span>: <span className="num text-ink">{aapl.programHeldPct}%</span> in programs.</> : null}
              </p>
            </>
          ) : (
            <div className="text-ink-2">No visibility data yet. Run pnpm visibility against mainnet to generate it.</div>
          )}
        </div>
      </section>

      {/* How a record date runs. */}
      <section className="mt-20">
        <h2 className="text-[28px]">How a record date runs</h2>
        <ol className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {steps.map((st) => (
            <li key={st.n} className="panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="num inline-flex w-7 h-7 items-center justify-center rounded-full bg-ink text-white text-[13px]">{st.n}</span>
                <span className="font-medium">{st.t}</span>
              </div>
              <p className="text-[14px] text-ink-2 flex-1">{st.d}</p>
              <div>{st.ui}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[14px] text-ink-2 max-w-[760px]">The one rule that never bends: attributed plus unattributed equals the supply held in token accounts. If it does not, the snapshot fails instead of publishing.</p>
      </section>

      {/* Honesty block. */}
      <section className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6 text-[14px]">
        <div className="panel p-5">
          <div className="font-medium">What is real</div>
          <p className="text-ink-2 mt-2">The mints, the Raydium pool, the Kamino reserve and every other holder are mainnet state, read through a surfpool fork. The positions in the card above were opened with the protocols&apos; own instructions. The program is deployed on the fork and every claim and vote is a transaction.</p>
        </div>
        <div className="panel p-5">
          <div className="font-medium">What is simulated</div>
          <p className="text-ink-2 mt-2">The issuer. A registrar keypair we operate publishes actions, and the USDC that funds the distribution comes from a demo wallet. xStocks are tracker certificates with no voting rights and dividends reinvested through the mint multiplier, so the vote here shows the rail, not a real Apple proxy. Entitlements are issuer-defined, never a determination of legal ownership.</p>
        </div>
      </section>
    </div>
  );
}
