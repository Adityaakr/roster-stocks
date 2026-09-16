# Lookthrough, working notes

Street-name infrastructure for tokenized stocks on Solana. Opt-in registry, entitlement resolver with a look-through into DeFi positions, Merkle record-date proof, claim and vote router. Four-day hackathon build started 2026-09-14. Read `DECISIONS.md` for why things are the way they are.

## Phase 0 plan (written 2026-09-14, before any application code)

### Verified facts (probed, not remembered)

| Thing | Value | How verified |
|---|---|---|
| AAPLx mint | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | mainnet `getAccountInfo`, Token-2022, decimals 8, metadata name "Apple xStock", symbol AAPLx |
| SPYx mint | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | same, name "SP500 xStock" |
| AAPLx extensions | permanentDelegate, defaultAccountState, scaledUiAmountConfig, transferHook (programId null), tokenMetadata | mainnet parsed mint |
| AAPLx scaled UI config at slot 446997288 | multiplier 1.0026642075893797, newMultiplier 1.0032690125398187, effective ts 1786149000 | mainnet parsed mint |
| Raydium CLMM AAPLx/USDC pool | `CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y`, TVL ~359k USD, program `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK` | `api-v3.raydium.io/pools/info/mint` |
| Second Raydium CLMM AAPLx/USDC pool | `ApniVWuZbZoruTAJdyJcLBA4AVw4DKGdV5fHxo6qrAZT`, TVL ~243k USD | same |
| Kamino xStocks market | lending market `5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua` | gPA on klend with memcmp offset 128 = AAPLx |
| Kamino AAPLx reserve | `CKJbqakbPGyhziowm19LPYz636UszuezfkitmpRtcLSH`, on-chain `config.borrowLimit` 0, `borrowedAmountSf` 0, supplyVault balance == `collateral.mintTotalSupply` == 138,205,509,467 raw | klend-sdk `Reserve.decode` over Alchemy, plus Kamino API metrics |
| Kamino program | `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` | klend-sdk `PROGRAM_ID` |
| Kamino SPYx reserve | `UvXjBuC7YZYaGB9Rn1PpBD1GySmjzunXgE8Zev9ua8d` (totalBorrow 118 SPYx, so SPYx is borrowed) | Kamino API metrics |
| AAPLx token accounts (Token-2022, memcmp mint at offset 0) | 61,268 at slot ~446997808 | gPA through the surfpool fork |
| Backpack `GET /api/v1/securities` | returns `asset` AAPL.US, `cusip` 037833100, `sessions[]` with `name, minQuantity, maxQuantity, stepSize` | curl |
| Backpack `GET /api/v1/market-sessions` | `name, description, startTime, endTime, timezone, startWeekday, endWeekday` | curl |
| Backpack `GET /api/v1/market-holidays` | `market, name, date, startTime, endTime, timezone` | curl |
| Backpack ticker `AAPL.US_USDC_RFQ&source=External` | returns `INVALID_CLIENT_REQUEST: External source is only available for stock markets`; only `AAPL.US_USDC_PERP` appears in `/api/v1/markets` | curl. Treat external price as optional; probe symbol forms in Phase 4 |
| Backpack mint/redeem endpoints | not present in docs.backpack.exchange as of 2026-09-14 (sections: Introduction, Authentication, RFQ Lifecycle, Stock Trading, Infrastructure, Public and Authenticated endpoints, WebSocket) | WebFetch of the docs. The rail exposes securities lookup only; mint/redeem stays unimplemented and labelled |
| tokens.xyz `GET /v1/health` | `{"ok":true}` | curl |
| surfpool 1.0.0 fork | `surfpool start --network mainnet --no-tui -y` answers `getSlot` in ~1s, proxies `getProgramAccounts` and `getAccountInfo` to the datasource | probe on port 8999 |
| `surfnet_setTokenAccount` | params positional `[owner, mint, { amount }, tokenProgram]`; creates a 165-byte token account (no extensions) for the owner's ATA | probe. Gotcha: verify Token-2022 transfers from a cheatcode-created account succeed for a mint with the transfer hook extension before relying on it |
| `surfnet_timeTravel` | `{ absoluteSlot }` or `{ absoluteTimestamp }` (ms) or `{ absoluteEpoch }`; `surfnet_pauseClock`, `surfnet_resumeClock` | surfpool source |

### Toolchain (installed)

node 22.23.2, pnpm 11.23.0, rustc 1.97.0, solana-cli 4.2.1, cargo-build-sbf 4.1.0 (platform-tools v1.54), anchor-cli 1.2.0 via avm, surfpool 1.0.0. Add `~/.avm/bin` and `~/.cargo/bin` to PATH.

Pinned packages (latest on npm on 2026-09-14): `@anchor-lang/core` 1.2.0 (TS client for Anchor 1.x; `@coral-xyz/anchor` stopped at 0.32.1 on 2025-10-10 and predates the 1.0 IDL), `anchor-lang` and `anchor-spl` 1.2.0 (Rust, matches the CLI), `solana-keccak-hasher` 3.x (Rust), `@solana/web3.js` 1.99.0, `@solana/spl-token` 0.4.15, `@raydium-io/raydium-sdk-v2` 0.2.69-alpha, `@kamino-finance/klend-sdk` 12.0.0 (declares `@solana/kit ^2.3.0` and `@solana/compat ^2.3.0`; pin kit 2.3.0 in the adapters package, never kit 8.x, or `Rpc<KaminoMarketRpcApi>` types split), `@noble/hashes` 2.4.0, `decimal.js` 10.6.0, `zod` 4.6.5, `vitest` 5.0.0, `next` 16.3.5, `tailwindcss` 4.3.3, `motion` 13.2.0, `@solana/wallet-adapter-react` 0.15.40, `@playwright/test` 1.63.0, `turbo` 2.10.12.

### Exact names to use

tokens.xyz (base `https://api.tokens.xyz/v1`, header `x-api-key`, all server-side, 60 s cache, backoff on 429, log `x-request-id` on non-2xx, error body `{ error: { _tag, message, details? } }`):
- `GET /assets/curated?list=stocks|etfs&groupBy=asset&variants=all&limit=50&offset=` (live 2026-09-16: `variants=all` adds every wrapper; `variantsMode=all` is ignored) returns `{listId, pagination{offset,limit,total,hasMore,nextOffset}, assets[{assetId,name,symbol,category,imageUrl,stats{price,liquidity,volume24hUSD,marketCap,totalSupply,circulatingSupply},primaryVariant,variants[]}]}`; stocks total 400, etfs 24
- `GET /assets/search?q=apple&limit=…` result fields `assetId, name, symbol, category, primaryVariant{mint, kind, stockVariantTier, liquidityTier, market}, variants?`
- `GET /assets/resolve?mint=<mint>` fields `assetId, resolvedBy, mint, asset{assetId,name,symbol,category,aliases}, variant{mint,chain,kind,liquidityTier,trustTier,tags,issuer,issuerUrl,label}`
- `GET /assets/:assetId/variants?kind=tokenized_equity` per variant `mint, chain, kind, stockVariantTier (share_redeemable|cash_redeemable|not_redeemable), liquidityTier (tier1|tier2|tier3), market{price, liquidity, volume1hUSD, …, asOf}, decimals, symbol, name, advisory`
- `GET /assets/:assetId/markets?mint=<mint>&limit=50` returns `{ assetId, mint, markets: [{ address, name, price, liquidity, volume24h, trade24h, uniqueWallet24h, base{address,symbol,decimals}, quote{…} }], total, offset, limit }` (live shape 2026-09-16; the docs page's `poolAddress`/`dex` names are not what the API returns)
- `GET /assets/:assetId/price-chart?mint=<mint>&interval=1H` returns `{ assetId, interval, from, to, candles: [{ time, open, high, low, close, volume }] }` (live shape; `time` not `timestamp`)
- `POST /assets/market-snapshots` body `{ "mints": [...] }`

Backpack (base `https://api.backpack.exchange`, public): `GET /api/v1/securities`, `GET /api/v1/market-sessions`, `GET /api/v1/market-holidays`, `GET /api/v1/ticker?symbol=…&source=External`, `GET /api/v1/klines?symbol=…&interval=…&startTime=…&source=External`. Signing (stretch only): headers `X-API-Key, X-Signature, X-Timestamp, X-Window`; payload `instruction=<name>&<alphabetical params>&timestamp=…&window=…`, ED25519, base64.

Token-2022: `getMint(connection, mint, commitment, TOKEN_2022_PROGRAM_ID)` then `getScaledUiAmountConfig(mint)` from `@solana/spl-token` (fields `authority, multiplier, newMultiplierEffectiveTimestamp, newMultiplier`). Effective multiplier: `newMultiplier` if `snapshotTimestamp >= newMultiplierEffectiveTimestamp` else `multiplier`. Share units are integers at 6 decimals: `shares6 = floor(raw * multiplier * 10^6 / 10^decimals)` using `decimal.js` with 40 digits precision.

Raydium (`@raydium-io/raydium-sdk-v2`): `Raydium.load({ connection, owner, disableLoadToken })`, `raydium.clmm.getRpcClmmPoolInfo({ poolId })`, `raydium.clmm.getPoolInfoFromRpc(poolId)`, `PersonalPositionLayout.decode`, `getPdaPersonalPositionAddress(programId, nftMint)`, `TickUtil.getSqrtPriceAtTick`, `LiquidityMathUtil.getAmountsForLiquidity(sqrtPriceX64, sqrtA, sqrtB, liquidity, roundUp)`, `raydium.clmm.openPositionFromBase({...})`, `CLMM_PROGRAM_ID`. Enumerate all positions in a pool by gPA on the CLMM program with `dataSize 281` and memcmp `poolId` at offset 41 (verified from `PersonalPositionLayout`: disc 8, bump 9, nftMint 9..41, poolId 41..73, tickLower 73, tickUpper 77, liquidity 81; 215 positions on pool `CKwJZ…` on 2026-09-14). `PoolInfoLayout` span 1544: mintA 73, vaultA 137, sqrtPriceX64 253, protocolFeesTokenA 309, fundFeesTokenA 1064.

Kamino (`@kamino-finance/klend-sdk` 12): `KaminoMarket.load(rpc, marketAddress, recentSlotDurationMs, programId?)`, `market.getReservesByMint(mint)`, `reserve.getCollateralExchangeRate()`, `reserve.getLiquidityAvailableAmount()`, `reserve.getBorrowedAmount()`, `reserve.getTotalSupply()`, `reserve.getCTokenMint()`, `market.getAllObligationsByDepositedReserve(reserve, instant)`, `obligation.deposits: Map<Address, Position{ reserveAddress, mintAddress, amount }>`, `KaminoAction.buildDepositTxns({...})`. The reserve state's `liquidity.supplyVault` is the physical container (AAPLx: `3Sm4EjYWnxptEmHLmCJTEhpasvXPqwy2Junvt7DMynFz`, 175 bytes). Its token-account owner is the lending-market authority PDA `findProgramAddress(["lma", lendingMarket], KLEND)` (`2Z7zhqp1eddmHNmEqexftST6DFPWmoL4QqfgiG5uJMJx`, no account on chain for this market, a System-owned account for others), so classification must match vault addresses discovered from Reserve accounts, not the owner's program. Reserve layout: lendingMarket at 32, liquidity.mintPubkey at 128, liquidity.supplyVault at 160. Obligation: deposits start at byte 96, stride 136, `depositedAmount` is in cTokens; `config.borrowLimit` is 0 on the AAPLx reserve (collateral-only, no live lending scenario).

Merkle: leaf `keccak256(0x00 || actionId[32] || wallet[32] || mint[32] || snapshotSlot u64 LE || entitlement u64 LE)`, node `keccak256(0x01 || min(a,b) || max(a,b))`, odd leaf promoted. TS `@noble/hashes/sha3` keccak_256, Rust `solana_keccak_hasher::hashv(&[...]).to_bytes()` (the `solana_program::keccak` re-export is deprecated since 2.2.0; it still compiles under `#![deny(warnings)]` because rustc does not lint deprecated re-exports, but we depend on the crate directly). `Hash.0` is private, use `.to_bytes()`.

Anchor program `lookthrough`: PDAs `["reg", mint, wallet]`, `["action", action_id]`, `["claim", action, wallet]`; instructions `register, create_action, fund_distribution, claim, cast_vote, close_action`; `transfer_checked` via `anchor_spl::token_interface`.

### Resolver rules refined after the Phase 0 review (2026-09-14)

- **Classification** runs adapter `discoverContainers` first (Raydium: vaults of every CLMM pool whose mintA or mintB is the mint; Kamino: `liquidity.supplyVault` of every reserve whose liquidity mint is the mint) and matches token accounts by address. Owner-program lookup is only for labelling what is left: on-curve owner is a wallet, anything else is unattributed with the owner program's name when known, otherwise "other programs".
- **Single-slot view.** On the fork call `surfnet_pauseClock` before the resolve and `surfnet_resumeClock` after, and record the slot. Against mainnet, pass `minContextSlot` and refuse the snapshot if response `context.slot` values differ. README says "a consistent view at or shortly after the record slot", never "state at the record slot".
- **Invariants stay in raw units.** Hard: attributed + unattributed == sum of raw balances of all token accounts. Soft, labelled: that sum vs mint supply (catches an incomplete scan). Share units are derived once per wallet from the summed raw amount, floored, so dust is at most one micro-share per wallet and is printed.
- **Multiplier.** Read the f64, convert with the JS shortest round-trip string into `decimal.js` (precision 40), store that string as `multiplierSource`. Document that Token-2022's own `amount_to_ui_amount` truncates in f64 and can differ by one raw unit.
- **Raydium rule.** Attributable base = vaultA balance minus `protocolFeesTokenA` minus `fundFeesTokenA` (those go to an unattributed row "Raydium protocol and fund fees"). Each position's claim = `getAmountsForLiquidity` amount plus its `tokenFeesOwedA`; scale claims pro rata to the base; the rounding remainder goes to an unattributed "rounding" row, never to a position. Position owner = holder of the NFT under either token program; off-curve holders recurse once (lock program, vaults) and otherwise stay unattributed.
- **Kamino rule.** Attribute `vaultBalance × depositedAmount / collateral.mintTotalSupply` to each obligation owner, `vaultBalance × walletCTokenBalance / mintTotalSupply` to on-curve cToken holders, residual unattributed. `exposureRaw` uses the exchange rate; with `borrowLimit` 0 it equals `rawAttributed`, and the UI says the lending scenario is collateral-only.
- **Program.** `claim` and `cast_vote` require `registration.registered_at_slot <= action.snapshot_slot` and `entitlement > 0`; entries in the tree are unique wallets, sorted, zero entitlements excluded. `Distribution` carries `claims_close_slot`; `fund_distribution` compares the vault balance after transfer with the required total, so top-ups are idempotent. `close_action` transfers the residual and closes the vault.
- **Wording.** xStocks dividends are reinvested and reflected in the multiplier, no cash reaches any balance. The vote scene on AAPLx is labelled "simulated issuer; xStocks carry no voting rights". Backpack and Superstate tokens are "tokenized claims and entitlements", not "native shares". Lookthrough does not issue, offer or market any security; xStocks are not offered to US persons. Registration is a public record linking a wallet to an intent; claims and votes are public. Paper: Malinova and Park, Research Policy 55(7), 2026, 105497, doi 10.1016/j.respol.2026.105497; do not quote sentences we have not read.

### Phase order and acceptance

0. Scaffold: monorepo, `pnpm verify` green with placeholder tests, `scripts/fork.sh`, clients return real data for `apple` and `AAPL.US`. `TOKENS_API_KEY` supplied on 2026-09-16 (in `.env`, ignored by git); the issuer console's search, wrapper table and markets line are live.
1. Resolver core: direct adapter, classification, unattributed bucket, visibility stat for AAPLx and SPYx, invariant test on a captured fixture.
2. Raydium CLMM and Kamino adapters, rules, tree, CLI `schedule` and `snapshot`. Alice resolves to 100 shares on the fork.
3. Anchor program, SDK, CLI `publish`, `fund`, `proof`. Claim and vote from the CLI, double claim rejected.
4. Web app, four pages, demo mode, design system, screenshots.
5. Demo, README, video script, pitch.
6. Buffer.

## How to run (kept current)

- Fork: `pnpm fork` (surfpool on 127.0.0.1:8899, datasource public mainnet or `FORK_DATASOURCE_URL`). Creates `.keys/registrar.json` on first run.
- Program: `pnpm anchor:build` (sbpf v0, syncs the IDL into `packages/sdk/src/idl`), `pnpm anchor:deploy` (to the fork).
- Seed: `pnpm seed` (Alice, Bob, Carol under `.keys/`, positions opened on the fork, `.keys/demo.json` and `.keys/registry.json`).
- Demo: `pnpm demo` (five scenes, checklist with signatures) or `pnpm test:e2e`. A snapshot on the fork takes 5 to 15 minutes.
- Registrar CLI: `pnpm registrar <schedule|snapshot|register|publish|fund|claim|vote|proof|tally> …`.
- Web: `pnpm --filter @lookthrough/web dev`, then http://localhost:3000/?demo=1. Pages: `/` (landing), `/holder`, `/issuer`, `/actions` (record), `/assets` (tokens.xyz curated stocks and ETFs with all wrappers, plus Tessera and PreStocks pre-IPO tokens via `/api/preipo`), `/adapters`. Design system in `apps/web/src/app/globals.css` (Newsreader, IBM Plex Sans, IBM Plex Mono; `.sec` margin-note sections, `.ledger`, `.facts`, `.cert`, `.bar`, `.steps`). Avoid class names that collide with Tailwind utilities (`outline` did). `DEMO_MODE=1` in `.env` enables the server-signed demo wallets and the issuer console.
- Devnet profile: `.env.devnet` (gitignored; example committed) is loaded on top of `.env` by scripts with `LOOKTHROUGH_ENV=devnet` (`scripts/env-load.ts` must be the first import so it wins over `dotenv/config`) and by `apps/web/src/lib/server.ts` and `next.config.ts` (which also exposes root `NEXT_PUBLIC_*` to the client; Next only reads env files from apps/web). Keys in `.keys/devnet/` (registrar = the funded deployer `39AWgnNnWFADQaVYnXZXWCCWHViAmXhHoTsrWM28yQpZ`), data in `apps/web/public/data/devnet/`. `pnpm seed:devnet`, `pnpm dev:devnet` (port 3001), `pnpm registrar:devnet …`. Program deployed on devnet 2026-09-16 (slot 499,182,746, 1.6 SOL rent). Demo stock mint `9DMJk1u4XWU9BwxuXpunywYcPPnS8FMobwyjJXgNoPYW`, test USDC `2BuuThtRSchG6Dkmm3QAHtQZ8rYVupp9ZwdNovWvY5rz`. Public devnet and Alchemy free tier refuse gPA: the snapshot falls back to `getTokenLargestAccounts` (`scanTokenAccounts` in the resolver) and adapters whose discovery is refused are recorded as warnings; the server reader uses Alchemy (`getTokenLargestAccounts` 429s on public devnet). The SDK sends with a priority fee and polls `getSignatureStatuses` until the blockhash expires (Anchor's `.rpc()` gave up at 30 s on devnet). `/api/devnet/faucet` mints 10 demo shares to any wallet, once per 10 minutes.
- Design system (2026-09-16, evening): the Aoutive Framer template, read through the Framer agent CLI (`npx @framer/agent@latest session new <project url>`, then `framer.agent.serialize` and `readProject` screenshots). Light palette (#FCFCFC paper, #1A1A1A ink, #737373 slate, #E2E2E2 hairlines), Space Grotesk display, Inter body, IBM Plex Mono figures. Structure: 1224px containers with left and right hairlines and 11px corner ticks; sections in `apps/web/src/components/landing/aoutive.tsx` mirror the template's home page (hero, brand strip, workflow tab cards with a swapping image, auto-cycling accordion with image, 2+3 use-case cards, counters, connect, three plan columns, boxed FAQ, CTA). Motion catalogue at the top of that file and in `components/motion.tsx` (word-by-word blur reveal, spring fade-ups 150/40 staggered 0.1 s, scroll-linked letter colouring, pixel-mask image reveal, count-up, text-roll button hover, nav underline 0.6 s, Lenis smooth scroll). Template illustrations live in `apps/web/public/aoutive/` (downloaded from the user's Framer project); product screenshots in `public/frames/` come from `scripts/dev/frames.mjs` (copy next to `apps/web/e2e` to run). Landing QA: `scripts/dev/landing-qa.mjs` writes `docs/LANDING_QA.md`.
- Verify: `pnpm verify` = typecheck, lint, unit tests (incl. the AAPLx fixture invariant test and Merkle vectors), litesvm program tests, Playwright smoke (skipped when the web app is not running).
- Fixtures: `pnpm fixtures:capture <mint> <symbol>` (10 to 20 minutes against public mainnet), `pnpm visibility <mint> <symbol> [--fixture file]`, `pnpm merkle:vectors`.
- Probes worth keeping: `scripts/probes/*.ts` (Raydium pool accounting, Kamino reserve accounting, fork position and deposit, ledger profile).

## Known gotchas

- Public mainnet RPC rate-limits `getTokenLargestAccounts` (429) but served a filtered gPA of 61k accounts. gPA through the fork merges cheatcode-written accounts with datasource accounts (verified for a filtered query).
- `@kamino-finance/klend-sdk` 12 uses `@solana/kit` addresses; Raydium and spl-token use web3.js v1 `PublicKey`. Keep the resolver's own types as base58 strings and convert at the edges.
- Anchor 1.x TS client is `@anchor-lang/core` (release notes 1.0.0, PR #4141). Do not install `@coral-xyz/anchor`. `anchor test` defaults to surfpool; we run our own fork and pass `--skip-local-validator`. The 1.2.0 template ships `[lints.rust] unexpected_cfgs` so `#![deny(warnings)]` should pass; confirm with `anchor build` before promising it.
- AAPLx mint extensions (fork read): metadataPointer, permanentDelegate, defaultAccountState, scaledUiAmountConfig, pausableConfig (paused false), confidentialTransferMint, transferHook (programId = default pubkey, so no hook runs), tokenMetadata. A real ATA is 179 bytes (ImmutableOwner, PausableAccount, TransferHookAccount). `surfnet_setTokenAccount` creates the canonical Token-2022 ATA at 165 bytes with no extensions; `transferChecked` from it succeeded on the fork (verified three times) only because the hook program is unset. Seeding order: create the ATA with a real instruction first, then set the amount with the cheatcode, and check the size stays 179.
- surfpool 1.0.0 has `--ci`, `--snapshot <file>` and `surfnet_exportSnapshot {"scope":"network"}`. Loading the 9,218-account export back with `--snapshot` hung surfpool before it listened (0% CPU, no log line) on 2026-09-16, so the fork restart path is: `pnpm fork`, `pnpm anchor:deploy`, `pnpm seed`, register the three wallets, `pnpm demo`. The fork's state is lost whenever the process dies; keep `pnpm fork` in its own terminal. `surfnet_timeTravel {"absoluteSlot": n}` verified.
- Alchemy mainnet URL: point reads fine, `getProgramAccounts` and `getTokenLargestAccounts` rate-limited (429). Full scans go through the fork's datasource proxy or the public RPC.
- `surfnet_timeTravel.absoluteTimestamp` is in milliseconds; the Clock sysvar reports seconds.

## 12. Phase 5: bounty tracks (only after the main submission is confirmed)

Everything in the original brief still applies: verify before assuming, real data only, phase gates, no legal-ownership claims.

### 12.0 Gate and budget

- Do not start until `docs/BUILD_LOG.md` records the main-track submission URL and the Phase 3 checklist passing.
- Work on a `bounties` branch behind feature flags (`FEATURE_PRE_IPO`, `FEATURE_CASH_IN_LIEU`). `main` must keep passing the 90-second demo untouched at all times.
- Time boxes, hard: Tessera one day, PreStocks half a day, Pyth half a day. If a box overruns, cut that track, drop it from the submit form, and log why. Bounty work never degrades the main demo.
- Tracks we are entering: **Tessera (pre-IPO)**, **PreStocks**, **Pyth market data**. We are not entering Meteora DBC or Clawpump; do not build anything for them.

### 12.1 Discovery first (half a morning, no code)

1. Read the Tessera and PreStocks bounty text on the hackathon page and record any required API, SDK or attribution in `docs/BOUNTIES.md`.
2. Tessera: from `tessera.pe` and their docs, collect every live token mint on mainnet. For each mint, fetch the account, identify the token program, and list every Token-2022 extension present (expect `TransferFeeConfig` given the published `0.2%` transfer fee; check for `TransferHook`, `PermanentDelegate`, `DefaultAccountState`). Record extensions in the registry entry.
3. PreStocks: fetch `https://prestocks.com/api/prestocks`, document the response shape in `packages/data/prestocks/README.md`, and extract mints, symbols and any supply or price fields. Identify the token program and extensions the same way. Check whether SPACEX is still listed after its IPO; if it converted, note what happened to holders and pick a still-listed token for the demo.
4. For every pre-IPO mint, find where it trades: Tokens API `resolve` and `markets` first; if the Tokens API does not index it, look up Meteora and Raydium pools by mint directly. Record pool addresses and the AMM program so the existing adapters can be pointed at them.
5. Write a **rights profile** per pre-IPO mint into the registry, with a source link for each field:

```ts
rights: {
  vote: false,                 // loan participation rights, not equity (Tessera); economic exposure only (PreStocks)
  cashDistribution: true,      // liquidity-event proceeds
  conversion: 'liquidity_event',
  redemption: 'kyc_only' | 'none',
  legalForm: 'spv_loan_participation' | 'spv_economic_exposure',
  sources: string[]
}
```

Stop and confirm the discovery results with the user before writing code.

### 12.2 Transfer-fee-aware invariant (Tessera prerequisite, also correct for any fee mint)

Token-2022 transfer fees are withheld inside token accounts (`withheld_amount`) and can be harvested to the mint. They are part of supply but not part of any holder's `amount`.

- Supply conservation becomes: `Σ account.amount + Σ account.withheld_amount + mint.withheld_amount == mint.supply`. Fail the snapshot if it does not hold.
- Entitlements use `amount` only. Withheld fees belong to the fee authority; show them as a separate line, "Fees withheld (issuer)", in the invariant panel and in `snapshot.json` as `withheldTotal`.
- Add a unit test with a fee mint fixture where the naive sum is short by the withheld total and the corrected sum reaches `100.0%`.
- If a `TransferHook` is present, record that DeFi positions may be restricted to approved programs and keep unattributed handling as is.

### 12.3 Liquidity-event distribution (Tessera and PreStocks)

Pre-IPO tokens have one corporate action that matters: proceeds from an IPO, a secondary sale or an SPV wind-down reaching every holder, including holders inside pools. This is a `Distribution` in the existing program; no on-chain changes.

- Issuer console: add an action template "Liquidity event proceeds" with fields for event name, source link, and `usdc_per_token`. It is labelled "issuer-declared" and "simulated" in the demo.
- Resolver: same Direct plus AMM adapters, pointed at the discovered pools, with the fee-aware invariant on.
- Holder view: for assets whose rights profile has `vote: false`, hide the vote action entirely and show the rights profile badges instead ("No voting rights", "Cash distributions", "Converts at liquidity event"). Do not demo a vote on a pre-IPO token under any circumstances.
- Demo: a wallet holding one Tessera token directly and inside a pool, a declared proceeds event, snapshot with the withheld-fee line visible, publish, claim. Repeat with one PreStocks token. Record both.

Done when: both tokens resolve on the fork with the corrected invariant at `100.0%`, both proceeds actions run end to end, the vote action is absent for both, and `docs/BOUNTIES.md` has a screenshot per track.

### 12.4 Pyth cash in lieu (`FEATURE_CASH_IN_LIEU`)

Non-cash actions (stock dividends, reverse splits, spin-offs) pay cash for fractional entitlements at the market price on the record date. Implement this without changing the program.

- Pricing source: Pyth. Verify in the Pyth docs the exact call to fetch a price at a given timestamp (the Benchmarks historical endpoint) and the feed IDs for the demo equities; record feed IDs in `packages/data/pyth/feeds.ts` with links. Use Hermes for a live price only for display.
- Session rule: Pyth equity feeds are marked closed outside exchange hours, and Pyth Pro is what covers pre-market through overnight on weekdays. Therefore the record slot for any cash-in-lieu action must fall inside a regular session. Default the record date from Pyth's published market-hours metadata for the feed if available; fall back to Backpack `/market-sessions`. Refuse to schedule a cash-in-lieu record slot on a weekend or holiday, with a clear error.
- Computation, in the resolver: for a declared ratio (for example a `1:10` reverse split), whole resulting share-equivalents stay in-kind (out of scope on-chain; recorded in the JSON), and the fractional remainder is priced at the Pyth price at the snapshot timestamp: `cash = fraction × price × ratio_adjustment`, in USDC micro-units.
- On-chain trick: publish it as a `Distribution` with `usdc_per_share_1e6 = 1_000_000` (the identity rate) and put the per-wallet USDC amount in the leaf's `entitlement` field. Document this "amount-based distribution" mode in `docs/ARCHITECTURE.md`. Add a resolver test that the identity-rate leaf pays exactly the computed cash.
- Holder view line item: "`3.4` fractional shares × Pyth `$182.11` at slot `N` = `$619.17`", with the Pyth feed ID and timestamp shown on the action page so it is auditable.

Done when: one cash-in-lieu action runs end to end on the fork for AAPLx with a Pyth-priced fraction, the weekend refusal is tested, and the README's Pyth section lists feed IDs, the timestamp query and the session rule.

### 12.5 Submission and README additions

- Submit form: select Tessera, PreStocks and Pyth. Two-line blurb per track:
  - Tessera: "Record-date look-through for T-tokens held inside DEX pools, with a transfer-fee-aware supply invariant and a liquidity-event proceeds distribution that pays pool-held holders without unwinding."
  - PreStocks: "Registry, rights profile and liquidity-event distribution for PreStocks tokens sourced from the PreStocks API, resolved through wallet and pool positions."
  - Pyth: "Cash in lieu for fractional entitlements priced at the Pyth price at the record timestamp, with record dates constrained to Pyth-published sessions."
- README: a "Pre-IPO assets" section with the rights profiles and their sources, the fee-aware invariant explained in three lines, the Pyth section, and the same disclaimer as everywhere else: issuer-defined entitlements, not legal ownership, and proceeds events in the demo are simulated.
- `docs/BUILD_LOG.md`: what each track added, what was cut, and time spent against the boxes.

### 12.6 Outreach hook (not code, do not skip)

The moment the Tessera demo runs, produce a shareable action page link and a 20-second clip. The user sends it to Tessera the same day. Put the link and clip path in `docs/BOUNTIES.md`.

### Kickoff for Phase 5 (the user pastes this after confirming the main submission is in)

> Read section 12 of `CLAUDE.md`. Do the discovery in 12.1 only: bounty text requirements, every Tessera and PreStocks mint with its token program and extensions, where each trades, the PreStocks API response shape, SPACEX's post-IPO status, and a rights profile per mint with sources. Produce the discovery report in `docs/BOUNTIES.md` and stop. Do not write adapter or resolver code until the user confirms.
