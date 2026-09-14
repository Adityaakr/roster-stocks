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
- `GET /assets/search?q=apple&limit=…` result fields `assetId, name, symbol, category, primaryVariant{mint, kind, stockVariantTier, liquidityTier, market}, variants?`
- `GET /assets/resolve?mint=<mint>` fields `assetId, resolvedBy, mint, asset{assetId,name,symbol,category,aliases}, variant{mint,chain,kind,liquidityTier,trustTier,tags,issuer,issuerUrl,label}`
- `GET /assets/:assetId/variants?kind=tokenized_equity` per variant `mint, chain, kind, stockVariantTier (share_redeemable|cash_redeemable|not_redeemable), liquidityTier (tier1|tier2|tier3), market{price, liquidity, volume1hUSD, …, asOf}, decimals, symbol, name, advisory`
- `GET /assets/:assetId/markets?mint=<mint>&limit=50` per market `poolAddress, dex|venue, liquidity, baseMint, quoteMint, source, …`
- `GET /assets/:assetId/price-chart?mint=<mint>&interval=1H` candles `timestamp, open, high, low, close, volume`
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

0. Scaffold: monorepo, `pnpm verify` green with placeholder tests, `scripts/fork.sh`, clients return real data for `apple` and `AAPL.US`. Needs `TOKENS_API_KEY` from the user (still missing on 2026-09-14 evening; the base URL alone returns 401).
1. Resolver core: direct adapter, classification, unattributed bucket, visibility stat for AAPLx and SPYx, invariant test on a captured fixture.
2. Raydium CLMM and Kamino adapters, rules, tree, CLI `schedule` and `snapshot`. Alice resolves to 100 shares on the fork.
3. Anchor program, SDK, CLI `publish`, `fund`, `proof`. Claim and vote from the CLI, double claim rejected.
4. Web app, four pages, demo mode, design system, screenshots.
5. Demo, README, video script, pitch.
6. Buffer.

## How to run (kept current)

- Fork: `pnpm fork` (wraps `scripts/fork.sh`, port 8899, datasource `MAINNET_RPC_URL` or public mainnet).
- Verify: `pnpm verify`.
- Demo keypairs: `.keys/` (gitignored), created by `pnpm seed`.

## Probe findings from Phase 1 and 2 (2026-09-14 to 15)

- AAPLx mainnet fixture at slot 447038097: 62,070 token accounts, sum equals mint supply exactly (no warning), wallets hold 98.12% directly. Program-held: Kamino 0.89%, Raydium CLMM 0.51%, program `AjMx5My4YUDHMiCtLpTAtgkiUJgrpJnQqd5AcQnddHQW` 0.27% (no Anchor IDL, labelled "other programs"), System-owned PDAs 0.11%, owners without accounts 0.07%. SPYx at slot 447038453: 156,328 accounts, wallets 69.64%, program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` 20.21% (on-chain Anchor IDL name "pump"), Kamino 5.55%, Raydium 3.97%.
- Raydium pool `CKwJZ…` probe: 215 positions, vault 21.75 B raw; position amounts 21.29 B, owed fees 3.2 M, accrued (uncollected) fees 620 M, protocol 0.19 M, fund 0.86 M. Accrued fees are 2.9% of the vault, so the adapter computes them from tick arrays (`PositionUtils.GetPositionFees`). Reads are not atomic on mainnet, so the sum can differ from the vault by ±1%; the pro rata step to `vault − protocol − fund fees` absorbs it and dust goes to an unattributed row.
- Kamino AAPLx reserve probe: 293 obligations; `Σ depositedAmount` == cTokens in `collateral.supplyVault` == 138,324,471,773; `mintTotalSupply` 138,324,571,773 (100,000 cTokens unenumerated); zero wallet-held cTokens; `config.borrowLimit` 0. Obligation account size is `Obligation.layout.span + 8` = 3344 (the codegen layout excludes the discriminator); filters: memcmp 32 = lendingMarket and memcmp 96 + 136·i = reserve.
- On the fork: `surfnet_setTokenAccount` after a real ATA creation REPLACES the account with a 165-byte one (extensions dropped) and the balance set; Raydium `openPositionFromBase` (single-sided, `nft2022: true`, `TxVersion.V0`) and Kamino `buildDepositTxns` (split into a setup tx and a refresh + deposit tx, `initUserMetadata.skipLutCreation: true` because the SDK's LUT is created in the same tx and cannot be fetched) both succeed from that account. Kamino deposit of 4,000,000,000 raw minted 4,000,000,000 cTokens (rate 1:1) and the rule attributes exactly that.
- surfpool quirk: the first time a datasource-proxied account is returned by getProgramAccounts with `dataSlice`, the data can be the FULL account; later reads honour the slice. Adapters detect the full span and read absolute offsets.
- surfpool forwards `getTokenLargestAccounts` and `getTokenAccountsByOwner`+mint to the datasource even for locally created mints (Internal error when the datasource 429s). Use getProgramAccounts with a memcmp on the mint for holder lookups; the fork answers those for local accounts.
- Rate limits are the bottleneck: public mainnet enforces a per-method budget (~10 s window, "Too many requests for a specific RPC call"); Alchemy free tier rejects large getProgramAccounts by compute units. Reader policy: primary first, fallback per call, backoff in seconds, holder lookups at concurrency 2. Never run two heavy jobs at once. Hermetic demo path: `surfpool start --offline --snapshot <file>` from a `surfnet_exportSnapshot {"scope":"network"}` taken after one complete run.

## Known gotchas

- Public mainnet RPC rate-limits `getTokenLargestAccounts` (429) but served a filtered gPA of 61k accounts. gPA through the fork merges cheatcode-written accounts with datasource accounts (verified for a filtered query).
- `@kamino-finance/klend-sdk` 12 uses `@solana/kit` addresses; Raydium and spl-token use web3.js v1 `PublicKey`. Keep the resolver's own types as base58 strings and convert at the edges.
- Anchor 1.x TS client is `@anchor-lang/core` (release notes 1.0.0, PR #4141). Do not install `@coral-xyz/anchor`. `anchor test` defaults to surfpool; we run our own fork and pass `--skip-local-validator`. The 1.2.0 template ships `[lints.rust] unexpected_cfgs` so `#![deny(warnings)]` should pass; confirm with `anchor build` before promising it.
- AAPLx mint extensions (fork read): metadataPointer, permanentDelegate, defaultAccountState, scaledUiAmountConfig, pausableConfig (paused false), confidentialTransferMint, transferHook (programId = default pubkey, so no hook runs), tokenMetadata. A real ATA is 179 bytes (ImmutableOwner, PausableAccount, TransferHookAccount). `surfnet_setTokenAccount` creates the canonical Token-2022 ATA at 165 bytes with no extensions; `transferChecked` from it succeeded on the fork (verified three times) only because the hook program is unset. Seeding order: create the ATA with a real instruction first, then set the amount with the cheatcode, and check the size stays 179.
- surfpool 1.0.0 has `--ci`, `--snapshot <file>` and `surfnet_exportSnapshot {"scope":"network"}`; use them to capture fixtures and make `pnpm verify` hermetic. `surfnet_timeTravel {"absoluteSlot": n}` verified.
- Alchemy mainnet URL: point reads fine, `getProgramAccounts` and `getTokenLargestAccounts` rate-limited (429). Full scans go through the fork's datasource proxy or the public RPC.
- `surfnet_timeTravel.absoluteTimestamp` is in milliseconds; the Clock sysvar reports seconds.
