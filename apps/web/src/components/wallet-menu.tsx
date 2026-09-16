"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useDemoWallet } from "@/lib/demo-wallet";
import { useCluster, explorerUrl } from "@/lib/cluster";
import { short } from "@/lib/format";
import { Icon } from "@/components/icons";

/** Connect button, or the active wallet with a menu: switch to a demo wallet, copy, view on explorer, disconnect. */
export function WalletMenu() {
  const { publicKey, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const demo = useDemoWallet();
  const cluster = useCluster();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = demo.activePubkey;
  if (!active) {
    return (
      <div className="btnrow">
        {demo.enabled && demo.wallets.length ? (
          <button className="btn secondary sm" onClick={() => demo.select("alice")}>
            Use a sample wallet
          </button>
        ) : null}
        <button className="btn primary sm" onClick={() => setVisible(true)}>
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button className="btn secondary sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: demo.isDemo ? "var(--yellow)" : "var(--green)" }} />
        {demo.isDemo ? `${demo.selected} (sample)` : short(active, 4)}
        <Icon.Chevron width={14} height={14} />
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="px-2.5 py-2 small">
            <div className="mono" style={{ color: "var(--text)" }}>{short(active, 8)}</div>
            <div>{demo.isDemo ? "Sample wallet, signed by the server" : wallet?.adapter.name ?? "Browser wallet"} on {cluster.label}</div>
          </div>
          <div className="sep" />
          <button role="menuitem" onClick={() => navigator.clipboard.writeText(active).catch(() => undefined)}>Copy address</button>
          {explorerUrl(cluster, "address", active) ? (
            <a role="menuitem" href={explorerUrl(cluster, "address", active) ?? "#"} target="_blank" rel="noreferrer">
              View on explorer <Icon.External width={14} height={14} />
            </a>
          ) : null}
          {demo.enabled && demo.wallets.length ? (
            <>
              <div className="sep" />
              <div className="px-2.5 pt-1 pb-1 small">Sample wallets, signed by the server</div>
              {demo.wallets.map((w) => (
                <button key={w.name} role="menuitem" onClick={() => { demo.select(w.name); setOpen(false); }}>
                  <span>{w.name[0]?.toUpperCase() + w.name.slice(1)}</span>
                  <span className="mono muted">{short(w.pubkey, 4)}</span>
                </button>
              ))}
              {demo.isDemo && publicKey ? (
                <button role="menuitem" onClick={() => { demo.select(null); setOpen(false); }}>
                  Back to {wallet?.adapter.name ?? "browser wallet"}
                </button>
              ) : null}
            </>
          ) : null}
          <div className="sep" />
          {publicKey ? (
            <button role="menuitem" onClick={() => { void disconnect(); demo.select(null); setOpen(false); }}>Disconnect</button>
          ) : (
            <button role="menuitem" onClick={() => { setVisible(true); setOpen(false); }}>Connect a browser wallet</button>
          )}
          {demo.isDemo && !publicKey ? <button role="menuitem" onClick={() => { demo.select(null); setOpen(false); }}>Leave sample wallet</button> : null}
        </div>
      ) : null}
    </div>
  );
}
