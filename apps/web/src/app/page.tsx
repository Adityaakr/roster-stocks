import Link from "next/link";
import { SupplyMap, type Segment } from "@/components/supply-map";
import { readVisibility } from "@/lib/server";
import { slotLabel, timeLabel } from "@/lib/format";

interface Visibility {
  mint: string;
  symbol: string;
  slot: number;
  timestamp: number;
  supplyRaw: string;
  accountsRaw: string;
  accountsScanned: number;
  walletVisibleRaw: string;
  programHeldRaw: string;
  programHeldPct: string;
  breakdownByProgram: { label: string; program: string | null; raw: string; pct: string; accounts: number }[];
  source: string;
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
  const mints = [DEFAULT_MINT, "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W"];
  const stats = mints.map((m) => readVisibility(m) as Visibility | null).filter((v): v is Visibility => v !== null);
  const primary = stats.find((s) => s.symbol === "SPYx") ?? stats[0] ?? null;
  const secondary = stats.filter((s) => s !== primary);

  return (
    <div className="pt-14">
      <section className="max-w-[760px]">
        <h1 className="display text-[28px] sm:text-[44px]">
          Tokenized stocks are composable.
          <br />
          Shareholder records are not.
        </h1>
        <p className="mt-5 text-[16px] text-ink-2 max-w-[640px]">
          The moment a tokenized stock enters a pool or a lending market, the program becomes the formal owner. Lookthrough resolves who is entitled at a record date, across wallets and DeFi positions, and publishes a root anyone can check.
        </p>
      </section>

      <section className="mt-12 panel p-6 sm:p-8">
        {primary ? (
          <>
            <SupplyMap segments={toSegments(primary)} hiddenPct={Number(primary.programHeldPct)} symbol={primary.symbol} />
            <p className="mt-4 text-[13px] text-ink-3">
              Read from mainnet at slot <span className="num">{slotLabel(primary.slot)}</span> ({timeLabel(primary.timestamp)}), <span className="num">{primary.accountsScanned.toLocaleString("en-US")}</span> token accounts. Unknown programs are labelled from their on-chain IDL name or as other programs, never guessed.
            </p>
            {secondary.length ? (
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-ink-2">
                {secondary.map((s) => (
                  <li key={s.mint}>
                    {s.symbol}: <span className="num text-ink">{s.programHeldPct}%</span> in programs at slot <span className="num">{slotLabel(s.slot)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="text-ink-2">
            No visibility data yet. Run <code className="num">pnpm visibility &lt;mint&gt; &lt;symbol&gt;</code> against mainnet to generate it.
          </div>
        )}
      </section>

      <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/holder" className="panel p-6 hover:border-ink-3 transition-colors">
          <div className="text-[20px] font-semibold">I hold tokenized stocks</div>
          <p className="mt-2 text-ink-2">See your positions resolved, register once, claim distributions and vote without unwinding anything.</p>
        </Link>
        <Link href="/issuer" className="panel p-6 hover:border-ink-3 transition-colors">
          <div className="text-[20px] font-semibold">I issue tokenized stocks</div>
          <p className="mt-2 text-ink-2">Pick a stock and its Solana wrappers, set a record date, run the snapshot, publish the root, fund or open the action.</p>
        </Link>
      </section>

      <section className="mt-16 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-x-10 gap-y-10">
        <h2 className="text-[20px]">How it works</h2>
        <ol className="space-y-8">
          <li className="grid grid-cols-1 sm:grid-cols-[1fr_260px] gap-4 items-start">
            <div>
              <div className="font-medium">Opt-in registry</div>
              <p className="text-ink-2 mt-1">A wallet signs once to register for corporate actions on a mint. It is a public on-chain record, with no identity attached, and it links the wallet to that intent.</p>
            </div>
            <div className="panel p-4 flex items-center justify-between">
              <span className="text-[14px]">Register for corporate actions</span>
              <span className="chip chip-accent">1 signature</span>
            </div>
          </li>
          <li className="grid grid-cols-1 sm:grid-cols-[1fr_260px] gap-4 items-start">
            <div>
              <div className="font-medium">Entitlement resolver</div>
              <p className="text-ink-2 mt-1">At the record slot, every token account of the mint is attributed exactly once: wallets directly, Raydium CLMM positions and Kamino deposits through issuer-defined pass-through rules, everything else labelled and left unattributed. Attributed plus unattributed equals supply, or the run fails.</p>
            </div>
            <table className="panel w-full text-[13px]">
              <tbody>
                <tr className="border-b border-line"><td className="p-3">Wallet</td><td className="p-3 num text-right">25.00</td></tr>
                <tr className="border-b border-line"><td className="p-3">Raydium CLMM</td><td className="p-3 num text-right">35.00</td></tr>
                <tr className="border-b border-line"><td className="p-3">Kamino Lend</td><td className="p-3 num text-right">40.00</td></tr>
                <tr><td className="p-3 font-medium">Entitlement</td><td className="p-3 num text-right font-medium">100.00</td></tr>
              </tbody>
            </table>
          </li>
          <li className="grid grid-cols-1 sm:grid-cols-[1fr_260px] gap-4 items-start">
            <div>
              <div className="font-medium">Record-date proof and rights router</div>
              <p className="text-ink-2 mt-1">Entitlements are hashed into a Merkle tree; only the root, a content hash and the snapshot slot go on-chain. Holders claim a USDC distribution or cast a weighted vote with a proof. The program checks registration, inclusion and single use.</p>
            </div>
            <div className="panel p-4 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-2">Root</span><span className="num">d2d5…d37e</span></div>
              <div className="flex justify-between"><span className="text-ink-2">Proof nodes</span><span className="num">2</span></div>
              <div className="flex justify-between"><span className="text-ink-2">Receipt</span><span className="chip chip-accent">Claimed 25.00 USDC</span></div>
            </div>
          </li>
        </ol>
      </section>

      <section className="mt-16 max-w-[760px] text-[14px] text-ink-2 space-y-2">
        <p>What is real here: the resolver reads real Raydium and Kamino state, the program runs on a mainnet fork of Solana, and the numbers above come from mainnet. What is simulated: the issuer role, the demo wallets, and the USDC that funds the distribution.</p>
        <p>xStocks are tracker certificates. They carry no voting rights, and their dividends are reinvested and reflected in the mint multiplier. On xStocks, Lookthrough is about votes an issuer chooses to route, non-cash actions, and cross-wrapper consistency. Entitlements here are issuer-defined, never a determination of legal ownership.</p>
      </section>
    </div>
  );
}
