"use client";

import { useCallback, useEffect, useState } from "react";
import { useDemoWallet } from "@/lib/demo-wallet";
import { shares, short, slotLabel, usdc } from "@/lib/format";
import { Hash } from "@/components/copy-button";
import { ErrorState } from "@/components/states";

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

interface Variant {
  mint: string;
  symbol?: string;
  name?: string;
  stockVariantTier?: string;
  liquidityTier?: string;
  market?: { liquidity?: number | null; price?: number | null } | null;
}
interface ActionRecord {
  id: string;
  kind: "distribution" | "vote";
  status: string;
  recordSlot: number;
  amountPerShareMicro?: string;
  question?: string;
  snapshot?: { slotActual: number; root: string; contentHash: string; totalEntitlement: string; leaves: number; attributedPct: string };
  onchain?: { actionPda: string; createTx: string; fundTx?: string; vault?: string };
}
interface Job {
  id: string;
  status: "running" | "done" | "failed";
  lines: string[];
  progress: Record<string, unknown>;
  error?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function IssuerPage() {
  const demo = useDemoWallet();
  const [step, setStep] = useState<Step>(1);
  const [q, setQ] = useState("apple");
  const [search, setSearch] = useState<{ results?: { assetId: string; symbol: string; name: string }[]; error?: string; configured?: boolean } | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [kind, setKind] = useState<"distribution" | "vote">("distribution");
  const [label, setLabel] = useState(`console-${new Date().toISOString().slice(0, 10)}`);
  const [perShare, setPerShare] = useState("0.25");
  const [question, setQuestion] = useState("Approve acquisition of XYZ");
  const [minutes, setMinutes] = useState("1");
  const [suggestion, setSuggestion] = useState<{ closeAt: string; sessionName: string; demoSlot: number | null } | null>(null);
  const [action, setAction] = useState<ActionRecord | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onchain, setOnchain] = useState<{ funded?: boolean; claimedTotal?: string; forWeight?: string; againstWeight?: string; abstainWeight?: string; voters?: number } | null>(null);
  const [entitlements, setEntitlements] = useState<{ entries: { wallet: string; entitlement: string; registered: boolean }[]; unattributed: { label: string; raw: string }[]; attributedRaw: string; unattributedRaw: string; multiplier: string } | null>(null);

  const doSearch = useCallback(async () => {
    const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(q)}`);
    setSearch((await res.json()) as typeof search);
  }, [q]);

  useEffect(() => {
    void doSearch();
    fetch(`/api/backpack/record-date?minutes=${minutes}`)
      .then((r) => r.json())
      .then((j: typeof suggestion) => setSuggestion(j))
      .catch(() => setSuggestion(null));
  }, [doSearch, minutes]);

  async function loadVariants(id: string) {
    setAssetId(id);
    const res = await fetch(`/api/tokens/variants?assetId=${encodeURIComponent(id)}`);
    const j = (await res.json()) as { variants?: Variant[] };
    setVariants(j.variants ?? []);
  }

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j;
  }

  async function scheduleAction() {
    setBusy(true);
    setError(null);
    try {
      const j = await post<{ action: ActionRecord }>("/api/registrar/schedule", { label, mint, symbol: "AAPLx", kind, inMinutes: Number(minutes), usdcPerShare: Number(perShare), question, deadlineMinutes: 30 });
      setAction(j.action);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSnapshot() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const j = await post<{ job: Job }>("/api/registrar/snapshot", { actionId: action.id });
      setJob(j.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/registrar/jobs/${job.id}`);
      if (!res.ok) return;
      const j = (await res.json()) as { job: Job };
      setJob(j.job);
      if (j.job.status !== "running") {
        setBusy(false);
        if (action) {
          const a = (await fetch(`/api/actions/${action.id}`).then((r) => r.json())) as { action: ActionRecord };
          setAction(a.action);
          const e = await fetch(`/actions/${action.id}/entitlements.json`).then((r) => (r.ok ? r.json() : null));
          setEntitlements(e as typeof entitlements);
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [job, action]);

  async function publishAction() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const j = await post<{ action: ActionRecord }>("/api/registrar/publish", { actionId: action.id });
      setAction(j.action);
      if (j.action.kind === "distribution") {
        const required = (BigInt(j.action.snapshot?.totalEntitlement ?? "0") * BigInt(j.action.amountPerShareMicro ?? "0")) / 1_000_000n;
        const f = await post<{ action: ActionRecord }>("/api/registrar/fund", { actionId: action.id, usdc: Number(required) / 1e6 + 1 });
        setAction(f.action);
      }
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== 5 || !action) return;
    const t = setInterval(async () => {
      const j = (await fetch(`/api/actions/${action.id}`).then((r) => r.json())) as { onchain: typeof onchain };
      setOnchain(j.onchain);
    }, 3000);
    return () => clearInterval(t);
  }, [step, action]);

  const registered = entitlements?.entries.filter((e) => e.registered) ?? [];
  const totalRaw = entitlements ? BigInt(entitlements.attributedRaw) + BigInt(entitlements.unattributedRaw) : 0n;

  return (
    <div className="pt-12">
      <h1 className="text-[28px]">Registrar console</h1>
      <p className="text-ink-2 mt-1 max-w-[720px]">
        The issuer role is simulated: this console signs with a demo registrar keypair on the fork and funds distributions from a demo wallet. {demo.enabled ? "" : "Open with ?demo=1 or set DEMO_MODE=1 to enable the actions here."}
      </p>
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

      <ol className="mt-8 space-y-4">
        {/* Step 1 */}
        <li className="panel p-5">
          <StepHeader n={1} title="Pick a canonical stock and its Solana wrappers" done={step > 1} onOpen={() => setStep(1)} summary={`Mint ${short(mint, 6)}`} />
          {step === 1 ? (
            <div className="mt-4 space-y-4">
              <div className="flex gap-2 max-w-[520px]">
                <input className="flex-1 h-10 px-3 rounded-[10px] border border-line bg-surface" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens.xyz, for example apple" aria-label="Search stocks" />
                <button className="btn" onClick={doSearch}>Search</button>
              </div>
              {search?.error ? (
                <div className="text-[14px] text-ink-2">
                  {search.error}{search.configured === false ? " The console falls back to the AAPLx mint below." : ""}
                </div>
              ) : null}
              {search?.results?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {search.results.map((r) => (
                    <li key={r.assetId}>
                      <button className={`btn ${assetId === r.assetId ? "btn-primary" : ""}`} onClick={() => loadVariants(r.assetId)}>
                        {r.symbol} <span className="text-ink-3">{r.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {variants ? (
                <table className="ledger w-full text-[14px]">
                  <thead>
                    <tr><th>Wrapper</th><th>Mint</th><th>Tier</th><th>Liquidity</th><th className="num">Liquidity USD</th><th>In scope</th></tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.mint}>
                        <td>{v.symbol ?? v.name ?? "?"}</td>
                        <td><Hash value={v.mint} /></td>
                        <td>{v.stockVariantTier ? <span className="chip">{v.stockVariantTier.replaceAll("_", " ")}</span> : <span className="text-ink-3">n/a</span>}</td>
                        <td>{v.liquidityTier ?? "n/a"}</td>
                        <td className="num">{v.market?.liquidity != null ? Math.round(v.market.liquidity).toLocaleString("en-US") : "n/a"}</td>
                        <td><input type="radio" name="mint" checked={mint === v.mint} onChange={() => setMint(v.mint)} aria-label={`Use ${v.mint}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <div className="flex items-center gap-3">
                <label className="text-[14px] text-ink-2">Mint in scope</label>
                <input className="flex-1 max-w-[520px] h-10 px-3 rounded-[10px] border border-line bg-surface num text-[13px]" value={mint} onChange={(e) => setMint(e.target.value)} aria-label="Mint address" />
                <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
              </div>
              <p className="text-[13px] text-ink-3">Tier labels come from tokens.xyz and are informational, never legal advice. Only Raydium CLMM and Kamino Lend positions are looked through in v1; other programs stay unattributed and labelled.</p>
            </div>
          ) : null}
        </li>

        {/* Step 2 */}
        <li className="panel p-5">
          <StepHeader n={2} title="Choose the action and the record slot" done={step > 2} onOpen={() => setStep(2)} summary={action ? `${action.kind}, record slot ${slotLabel(action.recordSlot)}` : ""} />
          {step === 2 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[720px]">
              <label className="text-[14px]">Action id<input className="mt-1 w-full h-10 px-3 rounded-[10px] border border-line bg-surface" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
              <label className="text-[14px]">Kind
                <select className="mt-1 w-full h-10 px-3 rounded-[10px] border border-line bg-surface" value={kind} onChange={(e) => setKind(e.target.value as "distribution" | "vote")}>
                  <option value="distribution">USDC distribution</option>
                  <option value="vote">Vote</option>
                </select>
              </label>
              {kind === "distribution" ? (
                <label className="text-[14px]">USDC per share<input className="mt-1 w-full h-10 px-3 rounded-[10px] border border-line bg-surface num" value={perShare} onChange={(e) => setPerShare(e.target.value)} /></label>
              ) : (
                <label className="text-[14px]">Question<input className="mt-1 w-full h-10 px-3 rounded-[10px] border border-line bg-surface" value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
              )}
              <label className="text-[14px]">Record slot, minutes from now<input className="mt-1 w-full h-10 px-3 rounded-[10px] border border-line bg-surface num" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
              <div className="sm:col-span-2 text-[13px] text-ink-2">
                {suggestion ? (
                  <>Session-aware suggestion: the next {suggestion.sessionName.replaceAll("_", " ").toLowerCase()} close is {new Date(suggestion.closeAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} (from Backpack sessions and holidays). The demo uses a slot {minutes} minutes out{suggestion.demoSlot ? <>, about <span className="num">{slotLabel(suggestion.demoSlot)}</span></> : ""}.</>
                ) : (
                  "Record-date suggestion unavailable."
                )}
              </div>
              <div className="sm:col-span-2">
                <button className="btn btn-primary" onClick={scheduleAction} disabled={busy || !demo.enabled}>{busy ? "Scheduling" : "Schedule record date"}</button>
              </div>
            </div>
          ) : null}
        </li>

        {/* Step 3 */}
        <li className="panel p-5">
          <StepHeader n={3} title="Run the snapshot" done={step > 3 || !!action?.snapshot} onOpen={() => setStep(3)} summary={action?.snapshot ? `slot ${slotLabel(action.snapshot.slotActual)}, ${action.snapshot.attributedPct}% attributed, ${action.snapshot.leaves} leaves` : ""} />
          {step === 3 && action ? (
            <div className="mt-4 space-y-4">
              {!action.snapshot ? (
                <button className="btn btn-primary" onClick={runSnapshot} disabled={busy}>{busy ? "Snapshot running" : "Run snapshot at the record slot"}</button>
              ) : null}
              {job ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px]">
                  {(["slot", "containers", "accounts", "classified", "resolved", "invariants"] as const).map((k) => (
                    <div key={k} className="panel p-3">
                      <div className="text-ink-3">{k}</div>
                      <div className="num text-ink mt-1 break-all">{job.progress[k] ? JSON.stringify(job.progress[k]).replaceAll('"', "").replaceAll(",", ", ") : "…"}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {job ? (
                <pre className="num text-[12px] text-ink-2 max-h-[220px] overflow-auto panel p-3 whitespace-pre-wrap">{job.lines.slice(-30).join("\n")}</pre>
              ) : null}
              {job?.status === "failed" ? <ErrorState message={`Snapshot failed: ${job.error}`} /> : null}
              {action.snapshot && entitlements ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium mb-2">Entitlements (registered wallets)</div>
                    <table className="ledger w-full text-[14px]">
                      <thead><tr><th>Wallet</th><th className="num">Shares</th></tr></thead>
                      <tbody>
                        {registered.map((e) => (
                          <tr key={e.wallet}><td><Hash value={e.wallet} /></td><td className="num">{shares(e.entitlement)}</td></tr>
                        ))}
                        <tr><td className="font-medium">Total</td><td className="num font-medium">{shares(action.snapshot.totalEntitlement)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="font-medium mb-2">Supply panel</div>
                    <div className="panel p-4 space-y-2 text-[14px]">
                      <div className="flex justify-between"><span>Attributed</span><span className="num text-accent font-medium">{action.snapshot.attributedPct}%</span></div>
                      <div className="flex justify-between"><span>Double counted</span><span className="num">0</span></div>
                      <div className="flex justify-between"><span>Registered leaves</span><span className="num">{action.snapshot.leaves}</span></div>
                      <div className="pt-2 border-t border-line text-[13px] text-ink-2">Unattributed by program</div>
                      {Object.entries(entitlements.unattributed.reduce<Record<string, bigint>>((acc, u) => ((acc[u.label] = (acc[u.label] ?? 0n) + BigInt(u.raw)), acc), {}))
                        .sort((a, b) => (a[1] > b[1] ? -1 : 1))
                        .slice(0, 8)
                        .map(([lbl, raw]) => (
                          <div key={lbl} className="flex justify-between text-[13px]"><span className="text-ink-2">{lbl}</span><span className="num">{(Number((raw * 10_000n) / (totalRaw || 1n)) / 100).toFixed(2)}%</span></div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {action.snapshot ? <button className="btn btn-primary" onClick={() => setStep(4)}>Continue</button> : null}
            </div>
          ) : null}
        </li>

        {/* Step 4 */}
        <li className="panel p-5">
          <StepHeader n={4} title={kind === "vote" ? "Publish the root and open the vote" : "Publish the root and fund the vault"} done={step > 4} onOpen={() => setStep(4)} summary={action?.onchain ? `action ${short(action.onchain.actionPda, 6)}` : ""} />
          {step === 4 && action?.snapshot ? (
            <div className="mt-4 space-y-3 text-[14px]">
              <div>Root <Hash value={action.snapshot.root} /> · content hash <Hash value={action.snapshot.contentHash} /></div>
              {action.kind === "distribution" ? <div>Required funding: <span className="num">{usdc((BigInt(action.snapshot.totalEntitlement) * BigInt(action.amountPerShareMicro ?? "0")) / 1_000_000n)}</span> USDC, funded by the demo wallet.</div> : null}
              <button className="btn btn-primary" onClick={publishAction} disabled={busy}>{busy ? "Publishing" : action.kind === "vote" ? "Publish and open" : "Publish and fund"}</button>
            </div>
          ) : null}
        </li>

        {/* Step 5 */}
        <li className="panel p-5">
          <StepHeader n={5} title="Monitor claims and tallies" done={false} onOpen={() => setStep(5)} summary="" />
          {step === 5 && action ? (
            <div className="mt-4 text-[14px] space-y-2">
              <div>Action <Hash value={action.onchain?.actionPda ?? ""} /> · <a className="text-accent" href={`/actions/${action.id}`}>public proof page</a></div>
              {onchain ? (
                action.kind === "distribution" ? (
                  <div>Funded: {onchain.funded ? "yes" : "no"} · claimed so far <span className="num">{usdc(onchain.claimedTotal ?? "0")}</span> USDC</div>
                ) : (
                  <div>For <span className="num">{shares(onchain.forWeight ?? "0")}</span> · against <span className="num">{shares(onchain.againstWeight ?? "0")}</span> · abstain <span className="num">{shares(onchain.abstainWeight ?? "0")}</span> · voters <span className="num">{onchain.voters ?? 0}</span></div>
                )
              ) : (
                <div className="text-ink-2">Reading program state from the fork.</div>
              )}
            </div>
          ) : null}
        </li>
      </ol>
    </div>
  );
}

function StepHeader({ n, title, done, summary, onOpen }: { n: number; title: string; done: boolean; summary: string; onOpen: () => void }) {
  return (
    <button className="w-full flex items-center gap-3 text-left" onClick={onOpen}>
      <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-[13px] num ${done ? "bg-accent text-white" : "border border-line text-ink-2"}`}>{n}</span>
      <span className="font-medium">{title}</span>
      {summary ? <span className="ml-auto text-[13px] text-ink-2">{summary}</span> : null}
    </button>
  );
}
