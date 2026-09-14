"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDemoWallet } from "@/lib/demo-wallet";

interface SessionState {
  open: boolean;
  session: string | null;
  label: string;
}

function short(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

/** Product name, US market session state (from Backpack sessions), wallet control. Nothing else. */
export function Header() {
  const [session, setSession] = useState<SessionState | null>(null);
  const { setVisible } = useWalletModal();
  const { publicKey, disconnect } = useWallet();
  const demo = useDemoWallet();

  useEffect(() => {
    fetch("/api/backpack/session-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SessionState | null) => setSession(j))
      .catch(() => setSession(null));
  }, []);

  return (
    <header className="w-full border-b border-line bg-surface">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 min-w-0">
        <Link href="/" className="font-semibold tracking-tight text-[16px]">
          Lookthrough
        </Link>
        <nav className="hidden sm:flex items-center gap-4 text-[14px] text-ink-2 ml-4">
          <Link href="/holder" className="hover:text-ink">Holder</Link>
          <Link href="/issuer" className="hover:text-ink">Issuer</Link>
          <Link href="/actions" className="hover:text-ink">Actions</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {session ? (
            <span className="hidden sm:block">
              <span className="chip" title="From Backpack market sessions and holidays">
                <span className={`inline-block w-2 h-2 rounded-full ${session.open ? "bg-accent" : "bg-ink-3"}`} aria-hidden />
                US market {session.open ? "open" : "closed"}
              </span>
            </span>
          ) : null}
          {demo.enabled ? (
            <label className="chip gap-2 min-w-0 max-w-[60vw] sm:max-w-none">
              <span className="sr-only">Demo wallet</span>
              <select
                aria-label="Demo wallet"
                className="bg-transparent outline-none min-w-0 max-w-full truncate"
                value={demo.selected ?? ""}
                onChange={(e) => demo.select((e.target.value || null) as never)}
              >
                <option value="">Browser wallet</option>
                {demo.wallets.map((w) => (
                  <option key={w.name} value={w.name}>
                    {w.name[0]?.toUpperCase()}
                    {w.name.slice(1)} (demo) {short(w.pubkey)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {demo.isDemo ? null : publicKey ? (
            <button className="btn" onClick={() => disconnect()} title={publicKey.toBase58()}>
              <span className="num">{short(publicKey.toBase58())}</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setVisible(true)}>
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
