"use client";

import { useMemo, type ReactNode } from "react";
import { Buffer } from "buffer";

// web3.js and the shared merkle helpers expect a global Buffer in the browser.
if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { DemoWalletProvider } from "@/lib/demo-wallet";

/** Wallet adapter wiring. The RPC endpoint is the fork; wallets are auto-discovered (Wallet Standard). */
export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8899", []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <DemoWalletProvider>{children}</DemoWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
