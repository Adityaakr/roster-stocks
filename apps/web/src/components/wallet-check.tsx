"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LookthroughClient } from "@lookthrough/sdk";
import { useDemoWallet } from "@/lib/demo-wallet";
import { useCluster } from "@/lib/cluster";
import { sharesRounded as shares, short, slotLabel } from "@/lib/format";
import { M } from "@/components/mono";

interface LedgerRow {
  source: "direct" | "raydium_clmm" | "kamino_lend";
  label: string;
  shares6: string;
}
interface LedgerResponse {
  ledger: { slot: number; rows: LedgerRow[]; walletVisibleShares6: string; totalShares6: string };
  registration: { registered: boolean; slot?: string };
}

const SOURCE_LABEL: Record<LedgerRow["source"], string> = { direct: "in the wallet", raydium_clmm: "in a Raydium CLMM position", kamino_lend: "in a Kamino Lend deposit" };

/** The hero instrument: paste a wallet, see what a scan misses, register it in place. */
export function WalletCheck() {
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
  const [example, setExample] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<{ slot: string } | null>(null);

  useEffect(() => {
    fetch("/api/demo/summary")
      .then((r) => r.json())
      .then((j: { wallet?: string }) => setExample(j.wallet ?? null))
      .catch(() => setExample(null));
  }, []);

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

  /** Register the checked wallet: server-signed for a demo wallet, the SDK for the connected browser wallet. */
  async function register() {
    if (!wallet) return;
    setRegistering(true);
    setError(null);
    try {
      const demoName = demo.wallets.find((d) => d.pubkey === wallet)?.name;
      if (demoName) {
        const res = await fetch(`/api/demo/${demoName}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint }) });
        const j = (await res.json()) as { error?: string; slot?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        setRegistered({ slot: String(j.slot ?? "") });
      } else if (anchorWallet && anchorWallet.publicKey.toBase58() === wallet) {
        const client = new LookthroughClient(connection, anchorWallet as unknown as ConstructorParameters<typeof LookthroughClient>[1]);
        await client.register(new PublicKey(mint));
        const after = await client.isRegistered(new PublicKey(mint));
        setRegistered({ slot: String(after.slot ?? "") });
      } else {
        throw new Error("Connect this wallet to sign its registration, or check a demo wallet.");
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
  const hiddenRows = rows.filter((r) => r.source !== "direct");
  const canRegister = !!wallet && (demo.wallets.some((d) => d.pubkey === wallet) || anchorWallet?.publicKey.toBase58() === wallet);

  return (
    <div className="card" style={{ padding: 22 }}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <input className="field mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste any Solana wallet" aria-label="Wallet public key" />
        <button className="btn primary" type="submit" disabled={state === "loading" || !input.trim()}>{state === "loading" ? "Checking" : "Check a wallet"}</button>
      </form>

      {state === "error" && error ? <p className="msg red" style={{ marginTop: 12 }}>{error}</p> : null}

      {data && wallet ? (
        total === 0n ? (
          <p className="body-sm" style={{ marginTop: 16 }}>
            No tokenized stock in this wallet.{" "}
            {example ? (
              <>Try <button className="mono" style={{ borderBottom: "1px solid var(--line-strong)" }} onClick={() => { setInput(example); void check(example); }}>{short(example, 4)}</button> to see what a pool hides.</>
            ) : null}
          </p>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div className="h5" style={{ fontWeight: 400 }}>
              A wallet scan sees <M>{shares(visible, 2)}</M> of <M>{shares(total, 2)}</M> share equivalents.
            </div>
            {hidden > 0n ? (
              <p className="body-sm" style={{ margin: 0 }}>
                <M>{shares(hidden, 2)}</M> shares are invisible to the issuer:{" "}
                {hiddenRows.map((r, i) => (
                  <span key={`${r.label}-${i}`}>
                    {i ? ", " : ""}
                    <M>{shares(r.shares6, 2)}</M> {SOURCE_LABEL[r.source]}
                  </span>
                ))}
                .
              </p>
            ) : (
              <p className="body-sm" style={{ margin: 0 }}>Everything this wallet holds is visible to a scan. The gap appears the moment a position moves into a pool or a vault.</p>
            )}
            <p className="body-sm" style={{ margin: 0 }}>
              Lookthrough counts all <M>{shares(total, 2)}</M>. {data.registration.registered || registered ? "This wallet is registered to be paid and polled on them." : "Register this wallet to be paid and polled on them."}
            </p>
            <div className="btnrow">
              {registered ? (
                <span className="msg green">Registered at slot <M>{slotLabel(registered.slot || 0)}</M></span>
              ) : data.registration.registered ? (
                <span className="msg green">Registered at slot <M>{slotLabel(data.registration.slot ?? 0)}</M></span>
              ) : (
                <button className="btn secondary sm" onClick={register} disabled={registering || !canRegister} title={canRegister ? undefined : "Connect this wallet to sign, or check a demo wallet"}>
                  {registering ? "Registering" : "Register this wallet"}
                </button>
              )}
              {!canRegister && !data.registration.registered && !registered ? <span className="small">Connect this wallet to sign its registration.</span> : null}
            </div>
            {error && state !== "error" ? <p className="msg red" style={{ margin: 0 }}>{error}</p> : null}
            <p className="small" style={{ margin: 0 }}>Read at slot <M>{slotLabel(data.ledger.slot)}</M>. Attributed under issuer-defined rules. Not a determination of legal ownership.</p>
          </div>
        )
      ) : state !== "error" ? (
        <p className="small" style={{ marginTop: 12 }}>
          {example ? (
            <>Try <button className="mono" style={{ borderBottom: "1px solid var(--line-strong)" }} onClick={() => { setInput(example); void check(example); }}>{short(example, 4)}</button> to see what a pool hides.</>
          ) : (
            "Reads the wallet's positions on the network shown in the masthead."
          )}
        </p>
      ) : null}
    </div>
  );
}
