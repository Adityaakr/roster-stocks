"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LookthroughClient } from "@lookthrough/sdk";
import { useDemoWallet } from "@/lib/demo-wallet";
import { useCluster } from "@/lib/cluster";
import { sharesRounded, short, slotLabel } from "@/lib/format";
import { Roll, Stagger } from "@/components/motion";

interface LedgerRow {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  label: string;
  shares6: string;
}
interface LedgerResponse {
  ledger: { slot: number; rows: LedgerRow[]; walletVisibleShares6: string; totalShares6: string };
  registration: { registered: boolean; slot?: string };
}

const LINE: Record<LedgerRow["source"], string> = { direct: "Wallet", raydium_clmm: "Raydium CLMM position", kamino_lend: "Kamino Lend deposit" };

/** The instrument: paste a wallet, see the three-line ledger with a running total, register in place. */
export function WalletCheck({ example, id = "check" }: { example: string | null; id?: string }) {
  const demo = useDemoWallet();
  const cluster = useCluster();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const mint = cluster.demoMint ?? process.env.NEXT_PUBLIC_DEFAULT_MINT ?? "";
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<{ slot: string } | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state === "idle" && data) setKey((k) => k + 1);
  }, [data, state]);

  async function check(target?: string) {
    const w = (target ?? input).trim();
    if (!w) return;
    try {
      new PublicKey(w);
    } catch {
      setError("That is not a Solana public key.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    setRegistered(null);
    setWallet(w);
    try {
      const res = await fetch(`/api/holder/ledger?wallet=${w}&mint=${mint}`);
      const j = (await res.json()) as LedgerResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
      setData(null);
    }
  }

  async function register() {
    if (!wallet) return;
    setRegistering(true);
    setError(null);
    try {
      const name = demo.wallets.find((d) => d.pubkey === wallet)?.name;
      if (name) {
        const res = await fetch(`/api/demo/${name}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint }) });
        const j = (await res.json()) as { error?: string; slot?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        setRegistered({ slot: String(j.slot ?? "") });
      } else if (anchorWallet && anchorWallet.publicKey.toBase58() === wallet) {
        const client = new LookthroughClient(connection, anchorWallet as unknown as ConstructorParameters<typeof LookthroughClient>[1]);
        await client.register(new PublicKey(mint));
        const after = await client.isRegistered(new PublicKey(mint));
        setRegistered({ slot: String(after.slot ?? "") });
      } else {
        throw new Error("Connect this wallet to sign its registration.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegistering(false);
    }
  }

  const rows = data?.ledger.rows ?? [];
  const total = data ? BigInt(data.ledger.totalShares6) : 0n;
  const visible = data ? BigInt(data.ledger.walletVisibleShares6) : 0n;
  const hidden = total - visible;
  const canRegister = !!wallet && (demo.wallets.some((d) => d.pubkey === wallet) || anchorWallet?.publicKey.toBase58() === wallet);
  const inputId = `${id}-input`;
  const running: bigint[] = [];
  rows.reduce((acc, r) => { const n = acc + BigInt(r.shares6); running.push(n); return n; }, 0n);

  return (
    <div style={{ background: "#fff", padding: 22 }}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void check(); }}>
        <label htmlFor={inputId} className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Solana wallet</label>
        <input id={inputId} className="field mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste any Solana wallet" autoComplete="off" spellCheck={false} />
        <button className="btn primary" type="submit" style={{ flex: "none" }} disabled={state === "loading" || !input.trim()}><Roll>{state === "loading" ? "Checking" : "Check wallet"}</Roll></button>
      </form>
      {state === "error" && error ? <p className="note" style={{ marginTop: 12, color: "var(--amber)" }} role="alert">{error}</p> : null}
      {data && wallet ? (
        total === 0n ? (
          <p className="body" style={{ marginTop: 16 }}>
            No tokenized stock in this wallet.{example ? <> Try <button type="button" className="mono link" onClick={() => { setInput(example); void check(example); }}>{short(example, 4)}</button>.</> : null}
          </p>
        ) : (
          <div style={{ marginTop: 18 }}>
            <Stagger key={key} step={0.1} className="ledger-rows">
              {[
                ...rows.map((r, i) => (
                  <div key={`${r.source}-${i}`} className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, lineHeight: "19px", padding: "8px 0", borderBottom: "1px solid var(--line)", color: "var(--ink-2)" }}>
                    <span>{LINE[r.source]}</span>
                    <span className="num" style={{ color: "var(--ink)" }}>{sharesRounded(r.shares6, 2)}</span>
                  </div>
                )),
                <div key="total" className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, lineHeight: "19px", padding: "10px 0 0", borderTop: "1px solid var(--ink)", marginTop: -1, color: "var(--ink)" }}>
                  <span>Share equivalents</span>
                  <span className="num">{sharesRounded(running[running.length - 1] ?? 0n, 2)}</span>
                </div>
              ]}
            </Stagger>
            <p className="body" style={{ marginTop: 16 }}>
              A wallet scan sees <span className="fig">{sharesRounded(visible, 2)}</span>. <span className="fig">{sharesRounded(hidden, 2)}</span> are invisible to the issuer.
            </p>
            <div className="btnrow" style={{ marginTop: 14 }}>
              {registered || data.registration.registered ? (
                <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>Registered at slot {slotLabel(registered?.slot ?? data.registration.slot ?? 0)}</span>
              ) : (
                <button className="btn primary" onClick={register} disabled={registering || !canRegister} title={canRegister ? undefined : "Connect this wallet to sign its registration"}><Roll>{registering ? "Registering" : "Register this wallet"}</Roll></button>
              )}
              {!canRegister && !registered && !data.registration.registered ? <span className="note">Connect this wallet to sign its registration.</span> : null}
            </div>
            {error && state !== "error" ? <p className="note" style={{ marginTop: 8, color: "var(--amber)" }}>{error}</p> : null}
            <p className="note" style={{ marginTop: 14 }}>Read at slot {slotLabel(data.ledger.slot)}. Attributed under issuer-defined rules. Not a determination of legal ownership.</p>
          </div>
        )
      ) : state !== "error" ? (
        <p className="note" style={{ marginTop: 12 }}>
          {example ? <>No wallet yet. Try <button type="button" className="mono link" onClick={() => { setInput(example); void check(example); }}>{short(example, 4)}</button> to see what a pool hides.</> : "Reads the wallet's positions on the network shown in the masthead."}
        </p>
      ) : null}
    </div>
  );
}
