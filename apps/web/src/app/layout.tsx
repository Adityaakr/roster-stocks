import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";

const sans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Lookthrough",
  description: "Street-name infrastructure for tokenized stocks on Solana: entitlements resolved across wallets and DeFi positions at a record date, with a verifiable root."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 pb-24">{children}</main>
          <footer className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 py-10 text-[13px] text-ink-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-line">
            <a href="/actions" className="hover:text-ink">Proof explorer</a>
            <a href="https://github.com/adityakrx/lookthrough#readme" className="hover:text-ink">README</a>
            <a href="https://doi.org/10.1016/j.respol.2026.105497" className="hover:text-ink">Malinova and Park (2026)</a>
            <span className="ml-auto">Demo on a mainnet fork. Issuer role simulated. Not an offer of any security.</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
