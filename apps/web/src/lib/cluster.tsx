"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface ClusterInfo {
  cluster: "fork" | "devnet";
  label: string;
  programId: string;
  rpcReachable: boolean;
  demoMint: string | null;
  usdcMint: string | null;
  registrar: string | null;
  explorer: string | null;
  faucet: boolean;
}

const Ctx = createContext<ClusterInfo | null>(null);
const fallback: ClusterInfo = { cluster: process.env.NEXT_PUBLIC_CLUSTER === "devnet" ? "devnet" : "fork", label: process.env.NEXT_PUBLIC_CLUSTER === "devnet" ? "Devnet" : "Mainnet fork", programId: "", rpcReachable: true, demoMint: process.env.NEXT_PUBLIC_DEFAULT_MINT ?? null, usdcMint: null, registrar: null, explorer: process.env.NEXT_PUBLIC_CLUSTER === "devnet" ? "https://explorer.solana.com/{path}?cluster=devnet" : null, faucet: process.env.NEXT_PUBLIC_CLUSTER === "devnet" };

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ClusterInfo>(fallback);
  useEffect(() => {
    fetch("/api/cluster")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ClusterInfo | null) => j && setInfo(j))
      .catch(() => undefined);
  }, []);
  return <Ctx.Provider value={info}>{children}</Ctx.Provider>;
}

export function useCluster(): ClusterInfo {
  return useContext(Ctx) ?? fallback;
}

/** Explorer link for an address or transaction, null on the fork (no public explorer). */
export function explorerUrl(info: ClusterInfo, kind: "address" | "tx", value: string): string | null {
  return info.explorer ? info.explorer.replace("{path}", `${kind}/${value}`) : null;
}
