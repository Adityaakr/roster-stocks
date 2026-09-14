"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { motion, useReducedMotion } from "motion/react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LookthroughClient } from "@lookthrough/sdk";
import { useDemoWallet } from "@/lib/demo-wallet";
import { pct, shares, short, slotLabel, timeLabel, usdc } from "@/lib/format";
import { Hash } from "@/components/copy-button";
import { Empty, ErrorState, Loading } from "@/components/states";
import { verifyLocally } from "@/lib/merkle-browser";

const DEFAULT_MINT = process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

interface LedgerRow {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  container: string;
  label: string;
  rawAmount: string;
  shares6: string;
  estimated: boolean;
  evidence: Record<string, unknown>;
}
interface ActionStanding {
  id: string;
  kind: "distribution" | "vote";
  title: string;
  status: string;
  snapshotSlot: number;
  root: string;
  amountPerShareMicro: string | null;
  question: string | null;
  entitlement: string | null;
  inTree: boolean;
  funded: boolean | null;
  closed: boolean | null;
  receipt: { entitlement: string; amountPaid: string; choice: string | null; slot: string } | null;
  tally: { for: string; against: string; abstain: string; voters: number } | null;
}
interface LedgerResponse {
  ledger: { wallet: string; mint: string; slot: number; timestamp: number; multiplier: string; decimals: number; rows: LedgerRow[]; walletVisibleShares6: string; totalShares6: string };
  registration: { registered: boolean; slot?: string };
  actions: ActionStanding[];
}

export default function HolderPage() {
  const demo = useDemoWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const reduce = useReducedMotion();
  const [mint] = useState(DEFAULT_MINT);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resolveKey, setResolveKey] = useState(0);
  const [proofOpen, setProofOpen] = useState<string | null>(null);
  const wallet = demo.activePubkey;

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/holder/ledger?wallet=${wallet}&mint=${mint}`);
      const j = (await res.json()) as LedgerResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
      setResolveKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, mint]);

  useEffect(() => {
    void load();
  }, [load]);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  };

  /** Demo wallets are server-signed; a browser wallet signs through the SDK. */
  async function act(kind: "register" | "claim" | "vote", actionId?: string, choice?: "for" | "against" | "abstain") {
    if (!wallet) return;
    setBusy(`${kind}:${actionId ?? ""}:${choice ?? ""}`);
    try {
      if (demo.isDemo) {
        const res = await fetch(`/api/demo/${demo.selected}/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint, actionId, choice }) });
        const j = (await res.json()) as { error?: string; amountPaid?: string; signature?: string | null };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        say(kind === "register" ? "Registered for corporate actions" : kind === "claim" ? `Claimed ${usdc(j.amountPaid ?? "0")} USDC` : `Voted ${choice}`);
      } else {
        if (!anchorWallet) throw new Error("Connect a wallet first.");
        const client = new LookthroughClient(connection, anchorWallet as unknown as ConstructorParameters<typeof LookthroughClient>[1]);
        if (kind === "register") {
          await client.register(new PublicKey(mint));
          say("Registered for corporate actions");
        } else {
          const pr = await fetch(`/api/actions/${actionId}/proof?wallet=${wallet}`).then((r) => r.json() as Promise<{ inTree: boolean; leaf?: { entitlement: string; proof: string[] } }>);
          if (!pr.inTree || !pr.leaf) throw new Error("This wallet is not in the tree for that action.");
          const a = data?.actions.find((x) => x.id === actionId);
          const idHex = await fetch(`/api/actions/${actionId}`).then((r) => r.json() as Promise<{ action: { actionIdHex: string } }>);
          const id = new Uint8Array(Buffer.from(idHex.action.actionIdHex, "hex"));
          const proof = pr.leaf.proof.map((h) => new Uint8Array(Buffer.from(h, "hex")));
          if (kind === "claim") {
            await client.claim(id, BigInt(pr.leaf.entitlement), proof);
            say(`Claimed ${usdc((BigInt(pr.leaf.entitlement) * BigInt(a?.amountPerShareMicro ?? "0")) / 1_000_000n)} USDC`);
          } else {
            await client.castVote(id, BigInt(pr.leaf.entitlement), proof, choice ?? "for");
            say(`Voted ${choice}`);
          }
        }
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      say(msg.length > 140 ? msg.slice(0, 140) : msg);
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.ledger.rows ?? [];
  const total = data ? BigInt(data.ledger.totalShares6) : 0n;
  const visible = data ? BigInt(data.ledger.walletVisibleShares6) : 0n;
  const recovered = total - visible;
  const hasEstimate = rows.some((r) => r.estimated);
  const stagger = useMemo(() => (reduce ? 0 : 0.06), [reduce]);

  if (!wallet) {
    return (
      <div className="pt-12 max-w-[720px]">
        <h1 className="text-[28px]">Your positions, resolved</h1>
        <p className="text-ink-2 mt-3">Connect a wallet to see how your tokenized stock is held across your wallet, Raydium and Kamino, register once, and act on open corporate actions.</p>
        <div className="mt-6">
          <Empty title="No wallet connected." action={demo.enabled ? "Pick a demo wallet in the header, or connect your own." : "Use Connect wallet in the header. Add ?demo=1 to the URL to use the demo wallets on the fork."} />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px]">Your positions, resolved</h1>
          <p className="text-ink-2 mt-1">
            {demo.activeLabel} <span className="num">{short(wallet, 6)}</span>{demo.isDemo ? ", signed by the demo server on the fork" : ""}. Mint AAPLx <span className="num">{short(mint, 6)}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.registration.registered ? (
            <span className="chip chip-accent">Registered at slot <span className="num">{slotLabel(data.registration.slot ?? 0)}</span></span>
          ) : (
            <button className="btn btn-primary" disabled={busy !== null || !data} onClick={() => act("register")}>
              {busy === "register::" ? "Registering" : "Register for corporate actions"}
            </button>
          )}
          <button className="btn" onClick={() => load()} disabled={loading}>
            {loading ? "Resolving" : "Resolve again"}
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 panel px-4 py-2 text-[14px]" style={{ boxShadow: "var(--shadow-float)" }} role="status">
          {toast}
        </div>
      ) : null}

      <section className="mt-8">
        {loading && !data ? <Loading what="your positions from the fork" /> : null}
        {error ? <ErrorState message={error} next="The holder page needs the fork and the registrar's data directory. Check pnpm fork and reload." /> : null}
        {data ? (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ledger w-full" key={resolveKey}>
                <thead>
                  <tr>
                    <th>Where</th>
                    <th>Container</th>
                    <th className="num">Share equivalents</th>
                    <th className="w-[160px]">How we counted this</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-ink-2">This wallet holds no AAPLx directly, in Raydium CLMM positions, or in Kamino deposits on the fork.</td>
                    </tr>
                  ) : null}
                  {rows.map((r, i) => (
                    <motion.tr key={`${r.container}-${i}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: i * stagger, ease: [0.2, 0.8, 0.2, 1] }}>
                      <td>
                        {r.label}
                        {r.estimated ? <span className="chip chip-warn ml-2">estimated</span> : null}
                      </td>
                      <td>
                        <Hash value={r.container} />
                      </td>
                      <td className="num">{shares(r.shares6)}</td>
                      <td>
                        <details>
                          <summary className="text-accent text-[14px]">Evidence</summary>
                          <pre className="mt-2 num text-[12px] whitespace-pre-wrap break-all text-ink-2 max-w-[520px]">{JSON.stringify(r.evidence, null, 2)}</pre>
                        </details>
                      </td>
                    </motion.tr>
                  ))}
                  <motion.tr initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: rows.length * stagger + 0.1 }}>
                    <td className="font-medium">Total</td>
                    <td className="text-ink-2 text-[13px]">
                      multiplier <span className="num">{data.ledger.multiplier}</span>, slot <span className="num">{slotLabel(data.ledger.slot)}</span>
                    </td>
                    <td className="num font-medium">
                      <CountUp value={total} reduce={!!reduce} />
                    </td>
                    <td>
                      {recovered > 0n ? (
                        <motion.span className="chip chip-accent" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: rows.length * stagger + 0.5, duration: 0.3 }}>
                          {shares(recovered)} recovered from DeFi positions
                        </motion.span>
                      ) : null}
                    </td>
                  </motion.tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-[13px] text-ink-3 border-t border-line">
              A wallet scan sees <span className="num text-ink">{shares(visible)}</span> of <span className="num text-ink">{shares(total)}</span> share equivalents ({pct(visible, total)}%).
              {hasEstimate ? " Rows marked estimated use current pool and reserve state; the record-date snapshot applies accrued fees and the pool-wide reconciliation, and it is the number that counts." : ""}
              {" "}Read at {timeLabel(data.ledger.timestamp)}.
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="text-[20px]">Corporate actions</h2>
        {!data ? null : data.actions.length === 0 ? (
          <div className="mt-4">
            <Empty title="No actions have been snapshotted for this mint yet." action="The issuer console schedules a record date and runs the snapshot." />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.actions.map((a) => {
              const ent = a.entitlement ? BigInt(a.entitlement) : 0n;
              const pay = a.amountPerShareMicro ? (ent * BigInt(a.amountPerShareMicro)) / 1_000_000n : 0n;
              const claimed = a.receipt && a.kind === "distribution";
              const voted = a.receipt && a.kind === "vote";
              const open = a.status === "funded" || a.status === "open";
              return (
                <li key={a.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-[13px] text-ink-2 mt-1">
                        {a.kind === "distribution" ? `${usdc(a.amountPerShareMicro ?? "0")} USDC per share` : a.question} · record slot <span className="num">{slotLabel(a.snapshotSlot)}</span> · {a.status}
                      </div>
                      <div className="text-[13px] text-ink-2 mt-1">
                        {a.inTree ? (
                          <>Your entitlement at the record date: <span className="num text-ink">{shares(ent)}</span> shares{data.registration.registered ? "" : " (registered after the snapshot: not claimable)"}</>
                        ) : (
                          "You are not in this tree (not registered at the record date, or no exposure)."
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {a.kind === "distribution" ? (
                        claimed ? (
                          <span className="chip chip-accent">Claimed {usdc(a.receipt?.amountPaid ?? "0")} USDC</span>
                        ) : (
                          <button className="btn btn-accent" disabled={!a.inTree || !open || busy !== null} onClick={() => act("claim", a.id)}>
                            {busy === `claim:${a.id}:` ? "Claiming" : `Claim ${usdc(pay)} USDC`}
                          </button>
                        )
                      ) : voted ? (
                        <span className="chip chip-accent">Voted {a.receipt?.choice} with {shares(a.receipt?.entitlement ?? "0")} votes</span>
                      ) : (
                        (["for", "against", "abstain"] as const).map((c) => (
                          <button key={c} className="btn" disabled={!a.inTree || !open || busy !== null} onClick={() => act("vote", a.id, c)}>
                            {busy === `vote:${a.id}:${c}` ? "Voting" : c[0]?.toUpperCase() + c.slice(1)}
                          </button>
                        ))
                      )}
                      <button className="btn" onClick={() => setProofOpen(proofOpen === a.id ? null : a.id)} disabled={!a.inTree}>
                        Proof
                      </button>
                    </div>
                  </div>
                  {a.tally && a.kind === "vote" ? (
                    <div className="mt-3 text-[13px] text-ink-2">
                      Tally: for <span className="num text-ink">{shares(a.tally.for)}</span>, against <span className="num text-ink">{shares(a.tally.against)}</span>, abstain <span className="num text-ink">{shares(a.tally.abstain)}</span>, voters <span className="num text-ink">{a.tally.voters}</span>
                    </div>
                  ) : null}
                  {proofOpen === a.id ? <ProofDrawer actionId={a.id} wallet={wallet} mint={mint} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CountUp({ value, reduce }: { value: bigint; reduce: boolean }) {
  const [shown, setShown] = useState<bigint>(reduce ? value : 0n);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(BigInt(Math.floor(Number(value) * eased)));
      if (k < 1) raf = requestAnimationFrame(step);
      else setShown(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{shares(shown)}</>;
}

/** Leaf bytes, proof path, on-chain root, and a local verify that runs in the browser. */
function ProofDrawer({ actionId, wallet, mint }: { actionId: string; wallet: string; mint: string }) {
  const [state, setState] = useState<{ root: string; onchainRoot: string | null; actionIdHex: string; snapshotSlot: number; leaf: { entitlement: string; leaf: string; proof: string[] } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof verifyLocally> | null>(null);
  useEffect(() => {
    Promise.all([fetch(`/api/actions/${actionId}/proof?wallet=${wallet}`).then((r) => r.json()), fetch(`/api/actions/${actionId}`).then((r) => r.json())])
      .then(([p, a]: [{ inTree: boolean; root?: string; leaf?: { entitlement: string; leaf: string; proof: string[] } }, { action: { actionIdHex: string; snapshot?: { slotActual: number } }; onchain: { root?: string } | null }]) => {
        if (!p.inTree || !p.leaf || !p.root) throw new Error("Not in the tree.");
        setState({ root: p.root, onchainRoot: a.onchain?.root ?? null, actionIdHex: a.action.actionIdHex, snapshotSlot: a.action.snapshot?.slotActual ?? 0, leaf: p.leaf });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [actionId, wallet]);
  if (error) return <div className="mt-4 text-danger text-[14px]">{error}</div>;
  if (!state) return <div className="mt-4 text-ink-2 text-[14px]">Loading proof.</div>;
  return (
    <div className="mt-4 border-t border-line pt-4 text-[13px] space-y-2">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span>Leaf <Hash value={state.leaf.leaf} /></span>
        <span>Published root <Hash value={state.root} /></span>
        <span>On-chain root {state.onchainRoot ? <Hash value={state.onchainRoot} /> : <span className="text-ink-3">not published yet</span>}</span>
      </div>
      <div className="text-ink-2">Leaf preimage: 0x00, action id, wallet, mint, snapshot slot <span className="num">{slotLabel(state.snapshotSlot)}</span> (u64 LE), entitlement <span className="num">{state.leaf.entitlement}</span> (u64 LE). Proof of <span className="num">{state.leaf.proof.length}</span> sibling nodes.</div>
      <ol className="num text-ink-2 space-y-1">
        {state.leaf.proof.map((p, i) => (
          <li key={p}>
            {i + 1}. <Hash value={p} n={10} />
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <button className="btn" onClick={() => setResult(verifyLocally({ actionIdHex: state.actionIdHex, wallet, mint, snapshotSlot: state.snapshotSlot, entitlement: state.leaf.entitlement, proof: state.leaf.proof, root: state.onchainRoot ?? state.root }))}>
          Verify in this browser
        </button>
        {result ? result.ok ? <span className="chip chip-accent">Proof verifies against the {state.onchainRoot ? "on-chain" : "published"} root</span> : <span className="chip chip-danger">Proof does not verify</span> : null}
      </div>
    </div>
  );
}
