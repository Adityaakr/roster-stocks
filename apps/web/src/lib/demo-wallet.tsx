"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export type DemoName = "alice" | "bob" | "carol";

export interface DemoWalletInfo {
  name: DemoName;
  pubkey: string;
}

interface DemoWalletState {
  enabled: boolean;
  wallets: DemoWalletInfo[];
  selected: DemoName | null;
  select: (name: DemoName | null) => void;
  /** The active public key: the selected demo wallet, else the connected browser wallet. */
  activePubkey: string | null;
  activeLabel: string | null;
  isDemo: boolean;
}

const Ctx = createContext<DemoWalletState | null>(null);

/**
 * Demo mode exposes Alice, Bob and Carol as one-click wallets. Their keypairs live on the server (.keys/),
 * so their transactions are signed by server routes on the fork and labelled as such in the UI.
 */
export function DemoWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const [enabled, setEnabled] = useState(false);
  const [wallets, setWallets] = useState<DemoWalletInfo[]>([]);
  const [selected, setSelected] = useState<DemoName | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("lt.demo");
    } catch {
      stored = null;
    }
    const on = params.get("demo") === "1" || stored === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    if (params.get("demo") === "1") {
      try {
        localStorage.setItem("lt.demo", "1");
      } catch {
        // ignore
      }
    }
    setEnabled(on);
    if (!on) return;
    fetch("/api/demo/wallets")
      .then((r) => (r.ok ? r.json() : { wallets: [] }))
      .then((j: { wallets: DemoWalletInfo[] }) => {
        setWallets(j.wallets);
        // Default to Alice in demo mode so the holder page has something to show on first load.
        let sel: DemoName | null = null;
        try {
          sel = localStorage.getItem("lt.demo.selected") as DemoName | null;
        } catch {
          sel = null;
        }
        if (sel && j.wallets.some((w) => w.name === sel)) setSelected(sel);
        else if (j.wallets.some((w) => w.name === "alice")) setSelected("alice");
      })
      .catch(() => setWallets([]));
  }, []);

  // A browser wallet connecting takes over from the auto-selected demo wallet; picking a demo wallet later is explicit.
  const pk = publicKey?.toBase58() ?? null;
  useEffect(() => {
    if (pk) setSelected(null);
  }, [pk]);

  const value = useMemo<DemoWalletState>(() => {
    const demo = selected ? (wallets.find((w) => w.name === selected) ?? null) : null;
    return {
      enabled,
      wallets,
      selected,
      select: (name) => {
        setSelected(name);
        try {
          if (name) localStorage.setItem("lt.demo.selected", name);
          else localStorage.removeItem("lt.demo.selected");
        } catch {
          // ignore
        }
      },
      activePubkey: demo?.pubkey ?? publicKey?.toBase58() ?? null,
      activeLabel: demo ? `${demo.name[0]?.toUpperCase()}${demo.name.slice(1)} (demo wallet)` : publicKey ? "Connected wallet" : null,
      isDemo: !!demo
    };
  }, [enabled, wallets, selected, publicKey]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemoWallet(): DemoWalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemoWallet outside provider");
  return v;
}
