"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoWallet } from "@/lib/demo-wallet";
import { explorerUrl, useCluster } from "@/lib/cluster";
import { pct, shares, short, slotLabel, usdc } from "@/lib/format";
import { Address, Badge, ErrorState, KV, Logo, fmtCompact } from "@/components/ui";
import { M } from "@/components/mono";

interface Variant {
  mint: string;
  symbol?: string;
  name?: string;
  label?: string | null;
  stockVariantTier?: string;
  liquidityTier?: string;
  market?: { liquidity?: number | null; price?: number | null } | null;
}
interface MarketRow {
  address: string;
  name?: string;
  liquidity?: number | null;
}
interface ActionRecord {
  id: string;
  kind: "distribution" | "vote";
  status: string;
  recordSlot: number;
  amountPerShareMicro?: string;
  question?: string;
  snapshot?: { slotActual: number; timestamp: number; root: string; contentHash: string; totalEntitlement: string; leaves: number; attributedPct: string };
  onchain?: { actionPda: string; createTx: string; fundTx?: string; vault?: string; publishedSlot?: number };
}
interface Job {
  id: string;
  status: "running" | "done" | "failed";
  lines: string[];
  progress: Record<string, unknown>;
  error?: string;
}
interface Entitlements {
  entries: { wallet: string; entitlement: string; registered: boolean }[];
  unattributed: { label: string; raw: string; program: string | null }[];
  attributedRaw: string;
  unattributedRaw: string;
  multiplier: string;
  accountsScanned: number;
  invariants: { ok: boolean; warnings: string[] };
}

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: { n: Step; t: string }[] = [
  { n: 1, t: "Stock and wrapper" },
  { n: 2, t: "Action and record slot" },
  { n: 3, t: "Snapshot" },
  { n: 4, t: "Publish" },
  { n: 5, t: "Claims and tallies" }
];

export default function IssuerPage() {
  return (
    <Suspense fallback={null}>
      <IssuerConsole />
    </Suspense>
  );
}

function IssuerConsole() {
  const demo = useDemoWallet();
  const cluster = useCluster();
  const devnet = cluster.cluster === "devnet";
  const defaultMint = cluster.demoMint ?? process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "";
  const [step, setStep] = useState<Step>(1);
  const [q, setQ] = useState("apple");
  const [search, setSearch] = useState<{ results?: { assetId: string; symbol: string; name: string; imageUrl?: string | null }[]; error?: string; configured?: boolean } | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [mint, setMint] = useState(defaultMint);
  const [kind, setKind] = useState<"distribution" | "vote">("distribution");
  const [label, setLabel] = useState("");
  // The default id is derived on the client only, so the server and client render the same markup.
  useEffect(() => {
    setLabel((l) => l || `console-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`);
  }, []);
  const [perShare, setPerShare] = useState("0.25");
  const [question, setQuestion] = useState("Approve acquisition of XYZ");
  const [minutes, setMinutes] = useState("1");
  const [suggestion, setSuggestion] = useState<{ closeAt: string; sessionName: string; demoSlot: number | null } | null>(null);
  const [action, setAction] = useState<ActionRecord | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onchain, setOnchain] = useState<{ funded?: boolean; claimedTotal?: string; forWeight?: string; againstWeight?: string; abstainWeight?: string; voters?: number } | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    if (!mint && defaultMint) setMint(defaultMint);
  }, [defaultMint, mint]);

  // ?action=<id> reopens an existing record in the console at its current step.
  const params = useSearchParams();
  const reopen = params.get("action");
  useEffect(() => {
    if (!reopen) return;
    fetch(`/api/actions/${reopen}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j: { action: ActionRecord } | null) => {
        if (!j) return;
        setAction(j.action);
        setMint((m) => m || (j.action as unknown as { mint?: string }).mint || m);
        setKind(j.action.kind);
        if (j.action.snapshot) {
          const e = await fetch(`/actions/${j.action.id}/entitlements.json`).then((r) => (r.ok ? r.json() : null));
          setEntitlements(e as Entitlements | null);
          setJob({ id: "reopened", status: "done", lines: [], progress: {} });
        }
        const wanted = Number(params.get("step"));
        setStep(wanted >= 1 && wanted <= 5 ? (wanted as Step) : j.action.onchain ? 5 : j.action.snapshot ? 3 : 2);
      })
      .catch(() => undefined);
  }, [reopen, params]);

  const doSearch = useCallback(async () => {
    if (devnet) return;
    const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(q)}`);
    setSearch((await res.json()) as typeof search);
  }, [q, devnet]);

  useEffect(() => {
    void doSearch();
  }, [doSearch]);

  useEffect(() => {
    fetch(`/api/backpack/record-date?minutes=${minutes}`)
      .then((r) => r.json())
      .then((j: typeof suggestion) => setSuggestion(j))
      .catch(() => setSuggestion(null));
  }, [minutes]);

  async function loadVariants(id: string) {
    setAssetId(id);
    const res = await fetch(`/api/tokens/variants?assetId=${encodeURIComponent(id)}`);
    const j = (await res.json()) as { variants?: Variant[] };
    setVariants(j.variants ?? []);
  }

  useEffect(() => {
    if (!assetId) return;
    fetch(`/api/tokens/markets?assetId=${encodeURIComponent(assetId)}&mint=${mint}&limit=8`)
      .then((r) => r.json())
      .then((j: { markets?: MarketRow[] }) => setMarkets(j.markets ?? []))
      .catch(() => setMarkets(null));
  }, [assetId, mint]);

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
      const j = await post<{ action: ActionRecord }>("/api/registrar/schedule", { label, mint, symbol: variants?.find((v) => v.mint === mint)?.symbol ?? (devnet ? "LTAAPL" : "AAPLx"), kind, inMinutes: Number(minutes), usdcPerShare: Number(perShare), question, deadlineMinutes: 30 });
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
          setEntitlements(e as Entitlements | null);
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

  // "waiting for record slot N, current M" lines in the log turn into the not-final-yet hint (about 0.4 s per slot).
  const waitLine = job?.status === "running" ? [...job.lines].reverse().find((l) => l.startsWith("waiting for record slot")) : undefined;
  const waitMatch = waitLine?.match(/record slot (\d+), current (\d+)/);
  const waiting = waitMatch && waitLine === job?.lines[job.lines.length - 1] ? { target: Number(waitMatch[1]), seconds: Math.max(1, Math.ceil((Number(waitMatch[1]) - Number(waitMatch[2])) * 0.4)) } : null;
  const registered = entitlements?.entries.filter((e) => e.registered) ?? [];
  const totalRaw = entitlements ? BigInt(entitlements.attributedRaw) + BigInt(entitlements.unattributedRaw) : 0n;
  const doneStep = (n: Step) => (n === 1 ? step > 1 : n === 2 ? !!action : n === 3 ? !!action?.snapshot : n === 4 ? !!action?.onchain : false);
  const byLabel = entitlements ? Object.entries(entitlements.unattributed.reduce<Record<string, bigint>>((acc, u) => ((acc[u.label] = (acc[u.label] ?? 0n) + BigInt(u.raw)), acc), {})).sort((a, b) => (a[1] > b[1] ? -1 : 1)) : [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="h3">Issuer console</h1>
          <p className="body-sm">Pick the stock and the wrapper in scope, set the record slot, take the snapshot, publish the root, then fund the distribution or open the vote. Registered holders claim or vote with a proof; nobody leaves a pool.</p>
        </div>
        <Badge tone="yellow">simulated issuer, demo registrar {cluster.registrar ? short(cluster.registrar, 4) : ""}</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 16 }} className="issuer-grid">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card" style={{ padding: 8 }}>
            <div className="steps">
              {STEPS.map((s) => (
                <button key={s.n} className={doneStep(s.n) ? "done" : ""} aria-current={step === s.n ? "step" : undefined} onClick={() => setStep(s.n)}>
                  <span className="n">{doneStep(s.n) ? "✓" : s.n}</span>
                  {s.t}
                </button>
              ))}
            </div>
          </div>
          {action ? (
            <div className="card pad">
              <div className="small">Current action</div>
              <div style={{ marginTop: 8 }}>
                <KV items={[
                  { k: "Id", v: <span className="mono">{action.id}</span> },
                  { k: "Kind", v: action.kind },
                  { k: "Record slot", v: slotLabel(action.recordSlot) },
                  { k: "Status", v: <Badge tone={action.status === "funded" || action.status === "open" ? "green" : "yellow"} dot>{action.status}</Badge> }
                ]} />
              </div>
              <div className="btnrow" style={{ marginTop: 12 }}><Link href={`/actions/${action.id}`} className="btn ghost sm">Public record</Link></div>
            </div>
          ) : null}
          <p className="small" style={{ padding: "0 4px" }}>This console signs with a demo registrar keypair on {cluster.label} and funds distributions from test USDC. {demo.enabled ? "" : "Open with ?demo=1 or set DEMO_MODE=1 to enable the actions here."}</p>
        </div>

        <div className="card pad" style={{ minWidth: 0 }}>
          {error ? <div style={{ marginBottom: 16 }}><ErrorState message={error} /></div> : null}

          {step === 1 ? (
            <div>
              <div className="h5">Pick a canonical stock and its Solana wrapper</div>
              <p className="body-sm" style={{ margin: "6px 0 0" }}>{devnet ? "On devnet the demo stock mint is the only asset with holders; the tokens.xyz directory still works for browsing." : "Search tokens.xyz for the stock, then choose the wrapper mint in scope. Tier labels are informational, never legal advice."}</p>
              {!devnet ? (
                <>
                  <div className="flex gap-2" style={{ marginTop: 16, maxWidth: 520 }}>
                    <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens.xyz, for example apple" aria-label="Search stocks" onKeyDown={(e) => e.key === "Enter" && doSearch()} />
                    <button className="btn secondary" onClick={doSearch}>Search</button>
                  </div>
                  {search?.error ? <p className="msg" style={{ marginTop: 10 }}>{search.error}{search.configured === false ? " The console falls back to the default mint below." : ""}</p> : null}
                  {search?.results?.length ? (
                    <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
                      {search.results.map((r) => (
                        <button key={r.assetId} className={`btn sm ${assetId === r.assetId ? "primary" : "ghost"}`} onClick={() => loadVariants(r.assetId)}>
                          <Logo src={r.imageUrl} symbol={r.symbol} size="sm" /> {r.symbol} <span className="muted">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {variants ? (
                    <div className="scroll-x" style={{ marginTop: 16 }}>
                      <table className="table">
                        <thead><tr><th>Wrapper</th><th>Mint</th><th>Redemption</th><th>Liquidity tier</th><th className="num">Liquidity</th><th>In scope</th></tr></thead>
                        <tbody>
                          {variants.map((v) => (
                            <tr key={v.mint} className="row-link" onClick={() => setMint(v.mint)}>
                              <td><div style={{ fontWeight: 500 }}>{v.symbol ?? v.name ?? "?"}</div><div className="small">{v.label ?? ""}</div></td>
                              <td><Address value={v.mint} /></td>
                              <td className="small">{v.stockVariantTier?.replaceAll("_", " ") ?? "n/a"}</td>
                              <td className="small">{v.liquidityTier ?? "n/a"}</td>
                              <td className="num">{fmtCompact(v.market?.liquidity)}</td>
                              <td><input type="radio" name="mint" checked={mint === v.mint} onChange={() => setMint(v.mint)} aria-label={`Use ${v.mint}`} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {markets && markets.length ? (
                    <p className="small" style={{ marginTop: 12 }}>
                      Where this mint trades: {markets.slice(0, 6).map((m, i) => <span key={m.address}>{i ? ", " : ""}{m.name ?? m.address.slice(0, 6)} <span className="num" style={{ color: "var(--text-2)" }}>{fmtCompact(m.liquidity)}</span></span>)}. Only Raydium CLMM pools among these are looked through; the rest stay labelled and unattributed.
                    </p>
                  ) : null}
                </>
              ) : null}
              <div style={{ marginTop: 18 }}>
                <label className="lbl" htmlFor="mint">Mint in scope</label>
                <div className="flex gap-2" style={{ maxWidth: 640 }}>
                  <input id="mint" className="field mono" value={mint} onChange={(e) => setMint(e.target.value)} />
                  <button className="btn primary" onClick={() => setStep(2)} disabled={!mint}>Continue</button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <div className="h5">Choose the action and the record slot</div>
              <p className="body-sm" style={{ margin: "6px 0 0" }}>Mint <span className="mono">{short(mint, 6)}</span>. The record slot is scheduled on {cluster.label}; the snapshot runs once the slot has passed.</p>
              <div className="grid-2" style={{ marginTop: 16, maxWidth: 720 }}>
                <div><label className="lbl">Action id</label><input className="field mono" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
                <div>
                  <label className="lbl">Kind</label>
                  <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "distribution" | "vote")}>
                    <option value="distribution">USDC distribution</option>
                    <option value="vote">Vote</option>
                  </select>
                </div>
                {kind === "distribution" ? (
                  <div><label className="lbl">USDC per share</label><input className="field num" value={perShare} onChange={(e) => setPerShare(e.target.value)} /></div>
                ) : (
                  <div><label className="lbl">Question</label><input className="field" value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
                )}
                <div><label className="lbl">Record slot, minutes from now</label><input className="field num" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
              </div>
              <p className="small" style={{ marginTop: 14 }}>
                {suggestion ? <>Session-aware suggestion: the next {suggestion.sessionName.replaceAll("_", " ").toLowerCase()} close is {new Date(suggestion.closeAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} (Backpack sessions and holidays). The demo uses a slot {minutes} minutes out{suggestion.demoSlot ? <>, about <span className="num">{slotLabel(suggestion.demoSlot)}</span></> : ""}.</> : "Record-date suggestion unavailable."}
              </p>
              <div className="btnrow" style={{ marginTop: 16 }}>
                <button className="btn primary" onClick={scheduleAction} disabled={busy || !demo.enabled}>{busy ? "Scheduling" : "Schedule record date"}</button>
                <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <div className="h5">Snapshot</div>
              <p className="body-sm" style={{ margin: "6px 0 0" }}>Every token account of the mint is read at one slot, classified and attributed once. {devnet ? "On devnet the RPC refuses program-wide scans, so the resolver falls back to the largest-accounts method and says so." : "On the fork this takes several minutes."}</p>
              {!action ? <p className="msg" style={{ marginTop: 12 }}>Schedule an action first.</p> : null}
              {action && !action.snapshot ? (
                <div className="btnrow" style={{ marginTop: 16 }}><button className="btn primary" onClick={runSnapshot} disabled={busy}>{busy ? "Snapshotting" : "Snapshot holders"}</button>{waiting ? <span className="small">Slot <M>{slotLabel(waiting.target)}</M> is not final yet. Try again in about <M>{waiting.seconds}</M> seconds.</span> : null}</div>
              ) : null}
              {job && job.lines.length ? (
                <div className="log" style={{ marginTop: 16 }}>
                  {job.lines.slice(-30).map((l, i) => (
                    <div key={`${i}-${l.slice(0, 24)}`}>
                      <span className="t">{String(i + Math.max(0, job.lines.length - 30) + 1).padStart(3, "0")}</span>
                      <span className={l.startsWith("root ") || l.includes("supply panel") ? "ok" : ""}>{l}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {job?.status === "failed" ? <div style={{ marginTop: 12 }}><ErrorState message={`Snapshot failed: ${job.error}`} /></div> : null}
              {job?.status === "done" && action?.snapshot ? <p className="msg green" style={{ marginTop: 12 }}>Snapshot complete, <M>{action.snapshot.attributedPct}%</M> attributed.</p> : null}
              {action?.snapshot && entitlements ? (
                <div style={{ marginTop: 20 }}>
                  <div className="grid-3">
                    <div className="inset" style={{ padding: 14 }}><div className="small">Attributed</div><div className="h4 num up" style={{ marginTop: 6 }}>{pct(entitlements.attributedRaw, totalRaw)}%</div></div>
                    <div className="inset" style={{ padding: 14 }}><div className="small">Unattributed</div><div className="h4 num" style={{ marginTop: 6 }}>{pct(entitlements.unattributedRaw, totalRaw)}%</div></div>
                    <div className="inset" style={{ padding: 14 }}><div className="small">Token accounts</div><div className="h4 num" style={{ marginTop: 6 }}>{entitlements.accountsScanned.toLocaleString("en-US")}</div></div>
                  </div>
                  <div className="bar" style={{ marginTop: 14 }}>
                    <span style={{ width: `${pct(entitlements.attributedRaw, totalRaw)}%`, background: "var(--green)" }} />
                    <span style={{ width: `${pct(entitlements.unattributedRaw, totalRaw)}%`, background: "var(--yellow)" }} />
                  </div>
                  <p className="msg" style={{ marginTop: 10, color: entitlements.invariants.warnings.length ? "var(--yellow)" : "var(--green)" }}>
                    {entitlements.invariants.warnings.length ? entitlements.invariants.warnings.join(" · ") : "Scanned token accounts sum exactly to mint supply."} Double counted 0. Multiplier {entitlements.multiplier}.
                  </p>
                  <div className="scroll-x" style={{ marginTop: 16 }}>
                    <table className="table">
                      <thead><tr><th>Registered wallet</th><th className="num">Entitlement, shares</th></tr></thead>
                      <tbody>
                        {registered.map((e) => <tr key={e.wallet}><td><Address value={e.wallet} href={explorerUrl(cluster, "address", e.wallet)} /></td><td className="num">{shares(e.entitlement)}</td></tr>)}
                      </tbody>
                      <tfoot><tr><td>{action.snapshot.leaves} leaves</td><td className="num">{shares(action.snapshot.totalEntitlement)}</td></tr></tfoot>
                    </table>
                  </div>
                  {byLabel.length ? (
                    <details style={{ marginTop: 12 }}>
                      <summary className="small" style={{ cursor: "pointer" }}>Unattributed by label</summary>
                      <table className="table" style={{ marginTop: 8 }}><tbody>{byLabel.slice(0, 10).map(([l, raw]) => <tr key={l}><td>{l}</td><td className="num">{pct(raw, totalRaw)}%</td></tr>)}</tbody></table>
                    </details>
                  ) : null}
                  <div className="btnrow" style={{ marginTop: 16 }}><button className="btn primary" onClick={() => setStep(4)}>Continue to publish</button></div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="h5">{kind === "vote" ? "Publish the root and open the vote" : "Publish the root and fund the vault"}</div>
              <p className="body-sm" style={{ margin: "6px 0 0" }}>Only the root, the content hash and the slot go on-chain. The entitlement file stays public so anyone can recompute the root.</p>
              {action?.snapshot ? (
                <>
                  <div className="inset proof" style={{ marginTop: 16, padding: 14 }}>
                    <div><span className="k">root</span>{action.snapshot.root}</div>
                    <div><span className="k">content hash</span>{action.snapshot.contentHash}</div>
                  </div>
                  <div style={{ marginTop: 14, maxWidth: 520 }}>
                    <KV items={[
                      { k: "Record slot", v: slotLabel(action.snapshot.slotActual) },
                      { k: "Leaves", v: `${action.snapshot.leaves} registered wallets` },
                      { k: "Total entitlement", v: `${shares(action.snapshot.totalEntitlement)} shares` },
                      { k: "Attributed", v: `${action.snapshot.attributedPct}%` },
                      ...(action.kind === "distribution" ? [{ k: "Required funding", v: `${usdc((BigInt(action.snapshot.totalEntitlement) * BigInt(action.amountPerShareMicro ?? "0")) / 1_000_000n)} USDC, from test USDC` }] : []),
                      ...(action.onchain ? [{ k: "Action account", v: <Address value={action.onchain.actionPda} href={explorerUrl(cluster, "address", action.onchain.actionPda)} /> }] : [])
                    ]} />
                  </div>
                  <div className="btnrow" style={{ marginTop: 16 }}>
                    {!action.onchain ? <button className="btn primary" onClick={publishAction} disabled={busy}>{busy ? "Publishing" : "Publish record"}</button> : <><span className="msg green">Published{action.onchain.publishedSlot ? <> at slot <M>{slotLabel(action.onchain.publishedSlot)}</M></> : null}</span><button className="btn primary" onClick={() => setStep(5)}>Continue</button></>}
                  </div>
                </>
              ) : (
                <p className="msg" style={{ marginTop: 12 }}>Run the snapshot first.</p>
              )}
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <div className="h5">Claims and tallies</div>
              <p className="body-sm" style={{ margin: "6px 0 0" }}>Read from program state every three seconds. Holders claim or vote from their portfolio.</p>
              {action?.onchain ? (
                <div style={{ marginTop: 16, maxWidth: 560 }}>
                  <KV items={[
                    { k: "Action account", v: <Address value={action.onchain.actionPda} href={explorerUrl(cluster, "address", action.onchain.actionPda)} /> },
                    { k: "Public record", v: <Link href={`/actions/${action.id}`} style={{ borderBottom: "1px solid var(--line-strong)" }}>/actions/{action.id}</Link> },
                    ...(onchain
                      ? action.kind === "distribution"
                        ? [{ k: "Funded", v: <Badge tone={onchain.funded ? "green" : "yellow"} dot>{onchain.funded ? "yes" : "no"}</Badge> }, { k: "Claimed so far", v: `${usdc(onchain.claimedTotal ?? "0")} USDC` }]
                        : [{ k: "For", v: shares(onchain.forWeight ?? "0") }, { k: "Against", v: shares(onchain.againstWeight ?? "0") }, { k: "Abstain", v: shares(onchain.abstainWeight ?? "0") }, { k: "Voters", v: String(onchain.voters ?? 0) }]
                      : [{ k: "Program state", v: "reading" }])
                  ]} />
                </div>
              ) : (
                <p className="msg" style={{ marginTop: 12 }}>Publish the record first.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <style>{`@media (max-width: 809px) { .issuer-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
