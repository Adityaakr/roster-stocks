# Decisions

Dated log of non-obvious choices, with the alternative rejected.

## 2026-09-14

- **AMM is Raydium CLMM.** `api-v3.raydium.io` lists two liquid AAPLx/USDC CLMM pools (`CKwJZ…` ~359k USD TVL, `ApniV…` ~243k USD). Meteora DLMM was the fallback only if Raydium had no liquid pool; it does. Meteora stays a stub adapter.
- **Lender is Kamino's xStocks market** (`5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua`, AAPLx reserve `CKJbq…`). Found by gPA on the klend program with memcmp offset 128 = AAPLx, since `api.kamino.finance/kamino-market` only lists the primary market. Kamino API metrics show AAPLx totalBorrow 0; the on-chain reserve config decides in Phase 2 whether the UI may call the lending scenario live.
- **Fork datasource.** surfpool 1.0.0 with `--network mainnet` (public RPC) works for reads and gPA; we will switch to `MAINNET_RPC_URL` when the user supplies one because the public endpoint returns 429 on `getTokenLargestAccounts`.
- **Funding demo wallets on the fork.** `surfnet_setTokenAccount` exists and works (positional `[owner, mint, {amount}, tokenProgram]`). Plan: use it for USDC and for the AAPLx base amount, then open Raydium and Kamino positions with real instructions. Rejected alternative: swapping on the fork through Jupiter, which needs a Jupiter route that exists only against live mainnet. Pending: confirm Token-2022 transfers work from the cheatcode-created account (mint has a transfer hook extension with no program set).
- **Anchor 1.2.0 (Rust) with `@anchor-lang/core` 1.2.0 (TS).** An earlier entry pinned `@coral-xyz/anchor` 0.32.1; that was wrong, Anchor 1.0.0 moved the TS package (PR #4141), verified on npm (published 2026-09-04). avm could not download Solana 4.1.2 (network error) but solana-cli 4.2.1 and cargo-build-sbf 4.1.0 are already installed, so we keep them.
- **Share units.** Entitlements are u64 in fixed 6-decimal share units (1 share = 1_000_000) computed from `raw × effective multiplier / 10^decimals` with `decimal.js`, floored. Rejected: storing raw units, which would tie a leaf to one wrapper's decimals and break cross-wrapper consistency.
- **Backpack rail scope.** The docs contain no mint or redeem endpoint on 2026-09-14, so `BackpackSecuritiesRail` implements securities lookup, sessions and holidays only, and reports mint/redeem as "not available in the public docs". Nothing is fabricated.
- **Prism review of the plan (7 lenses, 3 skeptics: 2 Opus, 1 Sonnet).** Two claims fell: "Kamino vaults need a hard-coded known-vaults map" (refuted 2 of 3: the vault owner is the derivable `["lma", market]` PDA and vaults are discoverable from Reserve accounts at offset 160, so containers are discovered from program state) and "`solana-keccak-hasher` is required under deny(warnings)" (refuted 2 of 3: the deprecated re-export compiles; we still take the crate directly by choice). Two held with refinements: Raydium vaults hold protocol, fund and per-position owed fees; the cheatcode-seeded transfer works only because the hook program is unset. Full record in `docs/01-phase-0-plan-review.md`.
- **`@solana/kit` pinned to 2.3.0 where klend-sdk is used.** klend-sdk 12 declares `^2.3.0`; installing the latest 8.x alongside produces two incompatible `Rpc` types.
- **Vote scene stays on AAPLx but is labelled simulated.** Alternative was switching the vote to a mint that carries votes; none is on the fork with liquidity. The label "simulated issuer; xStocks carry no voting rights" is mandatory copy.
- **Alchemy mainnet URL used for point reads only.** It returns 429 on gPA and getTokenLargestAccounts; full scans go through the fork's datasource proxy (public mainnet), which served 61k accounts.

## 2026-09-16

- **tokens.xyz key supplied; schemas follow the live API, not the docs page.** `GET /assets/:id/markets` returns rows with `address`, `name`, `base{address,symbol,decimals}`, `quote{…}`, `liquidity`, `volume24h`, `trade24h` (the docs page says `poolAddress`/`dex`); `price-chart` candles use `time`, not `timestamp`. Schemas stay loose so extra fields pass through. Verified on 2026-09-16 for `apple` and AAPLx: variants AAPLx and AAPLon, both `cash_redeemable`, `tier3`; six markets for AAPLx, the two largest being the Raydium CLMM pools the resolver already looks through.

## 2026-09-16, editorial design system and the assets page

- Replaced the panel-and-chip UI with the editorial system from the design prototype: paper, ink rules, one green and one amber, serif margin notes numbered 01 to 05, mono numbers. Every page is a document with a left margin note and a right content column; this reads as a record, which is what the product produces.
- Added `/assets` because a visitor could not see what universe Lookthrough applies to. It lists tokens.xyz curated stocks (400) and ETFs (24) with every Solana wrapper, paginated 50 at a time through a server proxy, and pre-IPO tokens from the Tessera and PreStocks public APIs labelled by source. Failed sources are reported next to the ones that loaded, not hidden.
- Added `/adapters` from `adapterStatusTable()` so the stub list is visible in the product, not only in the README.
- Frontend work landed on the `bounties` branch history as a separate commit so it can be cherry-picked to `main` without the bounty code.

## 2026-09-16, redesign on the Framer reference, and devnet

- The editorial (paper, serif) system was replaced the same day by the dark institutional system from the user's Framer project, read through the Framer agent CLI: Host Grotesk, near-black ground, elevation surfaces, white primary buttons, pill-labelled sections. Marketing and app are separate route groups so the landing can sell the problem while the app stays a tool with a sidebar.
- The assets directory became a card grid with an asset page (chart, every wrapper with venues, rights profiles) because a list alone did not show what the product covers. Rights profiles are written only where the source is known (xStock from Backed's terms, PreStocks from the bounty discovery); everything else says "per issuer documentation".
- Devnet deployment so the user can test with their own wallet. The brief's "fork not devnet" rule still holds for the look-through itself, which cannot exist on devnet; the devnet profile is explicit about that in the snapshot warnings and the UI. Public devnet and Alchemy free tier refuse `getProgramAccounts`, so the resolver gained a labelled `getTokenLargestAccounts` fallback rather than a silent one.
- The SDK stopped using Anchor's `.rpc()`: it timed out at 30 s on devnet while transactions still landed, which would have desynchronised the action records. The replacement adds a priority fee, polls statuses, re-sends until seen, and only fails after the blockhash expires and a final status check is empty. `publish` and `fund` also recover from a record that missed a landed transaction.
