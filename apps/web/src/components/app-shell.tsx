"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { WalletMenu } from "@/components/wallet-menu";
import { useCluster } from "@/lib/cluster";
import { Badge } from "@/components/ui";

const NAV = [
  { group: "Holder", items: [
    { href: "/portfolio", label: "Portfolio", icon: Icon.Wallet, match: (p: string) => p.startsWith("/portfolio") },
    { href: "/assets", label: "Assets", icon: Icon.Grid, match: (p: string) => p.startsWith("/assets") },
    { href: "/actions", label: "Record dates", icon: Icon.File, match: (p: string) => p.startsWith("/actions") }
  ] },
  { group: "Issuer", items: [
    { href: "/issuer", label: "Issuer console", icon: Icon.Console, match: (p: string) => p.startsWith("/issuer") },
    { href: "/adapters", label: "Adapters", icon: Icon.Plug, match: (p: string) => p.startsWith("/adapters") }
  ] }
];

const CRUMB: Record<string, string> = { portfolio: "Portfolio", assets: "Assets", actions: "Record dates", issuer: "Issuer console", adapters: "Adapters" };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cluster = useCluster();
  const first = pathname.split("/")[1] ?? "";
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark"><i />Lookthrough</Link>
        <nav aria-label="App">
          {NAV.map((g) => (
            <div key={g.group} className="contents">
              <div className="group">{g.group}</div>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} aria-current={it.match(pathname) ? "page" : undefined}>
                  <it.icon />
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="foot mt-auto small" style={{ padding: "0 10px" }}>
          <div className="flex items-center gap-2">
            <Badge tone={cluster.rpcReachable ? "green" : "amber"} dot>{cluster.label}</Badge>
          </div>
          <p className="mt-3" style={{ margin: "12px 0 0" }}>{cluster.cluster === "devnet" ? "Program deployed on Solana devnet. Demo stock and test USDC mints; no real value." : "surfpool fork of mainnet. Real mints, pools and reserves; simulated issuer."}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="topbar">
          <div className="crumbs">
            <span>Lookthrough</span>
            <span>/</span>
            <b>{CRUMB[first] ?? first}</b>
            <span>·</span>
            <Badge tone={cluster.rpcReachable ? "green" : "amber"} dot>{cluster.label}</Badge>
          </div>
          <WalletMenu />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
