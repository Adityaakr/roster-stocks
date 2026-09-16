# Bounty tracks: discovery report (12.1)

Written 2026-09-16 on the `bounties` branch. Every address, extension and quote below was fetched in this session (Alchemy and public mainnet RPC, the vendors' sites and APIs, hackathons.solana.com, docs.pyth.network) and the load-bearing ones were re-read by the orchestrator, not just the explorer. No code was written. Section 12.1 said stop after this report.

## 0. The hackathon and the bounty text

**Stocklana**, https://hackathons.solana.com/hackathons/stocklana (submit at `/hackathons/stocklana/submit`). Prize pool 121,000 USD. Main track 100,000 USD; judging verbatim: "One question: could this be a real app that people will actually use? Judges look for a real user and problem, a working end-to-end demo, a reason it belongs on Solana, and quality of execution." "Infrastructure: price feeds, corporate actions, compliance, analytics" is a listed wedge.

**Deadline is contradictory on the page.** The rules paragraph says "Submissions close: Friday 18 September, 4:00pm ET"; the header, the countdown and the embedded page data say Sep 25, 2026, 20:00 UTC (4:00pm ET). Treat Sep 25 as operative and confirm with the organisers.

| Track | Prize | Requirement, verbatim | Required API, SDK, attribution |
|---|---|---|---|
| Tessera, "Best Use of Tessera, Pre-IPO stocks" | 6,000 USD | "Create a product or usecase with **OpenAI or Kalshi** T-Tokens. These products can utilize existing bonding curves such as Stonkfun, memes, or anything that drives value to pre-IPO Tessera tokens." | None stated. Links: docs.tessera.pe, product API `https://rest-api.tessera.pe/v1/public/token-details`, app.tessera.pe. No judging rubric. |
| PreStocks, "Best Use of PreStocks" | 5,000 USD | "Build your project using PreStocks (tokenized pre-IPO stocks). API: https://prestocks.com/api/prestocks Products: https://prestocks.com/products … Creativity, integration depth, and product quality are all things we'll consider!" | None stated beyond using the API. |
| Pyth, "Best use of Pyth market data" | 3 months of Pyth Pro access | "Build a Solana application where live financial data does real work. … Pyth provides access to both, including: Equity.US.AAPL/USD, the regular Apple equity feed; Crypto.AAPLX/USD, an xStock feed; Crypto.AAPLON/USD, an Ondo feed. … Judging: How central Pyth data is to the product, technical soundness and quality of the integration, and if the app exists post hackathon." | Resources: docs.pyth.network/price-feeds/pro, /pro/getting-started, /pro/mcp, MCP endpoint https://mcp.pyth.network/mcp. |

Consequences for the plan: the Tessera demo token must be tKalshi or tOpenAI, not tSpaceX. Meteora DBC and Clawpump are not entered, as briefed.

## 1. Tessera T-Tokens

Source of mints: https://docs.tessera.pe/technicals/on-chain-programs.md, confirmed by the public API and by the app bundle. Public API `GET https://rest-api.tessera.pe/v1/public/token-details` (no auth) returns `[{ id, name, symbol, code, sector, mint, markPrice, holders, markValuation }]`; on 2026-09-16: T-OpenAI markPrice 812.79, 8,259 holders; T-Kalshi 413.80, 2,605; T-SpaceX 423.00, 1,274.

| Symbol | Mint | Program | Decimals | Supply (raw) | Extensions on chain |
|---|---|---|---|---|---|
| tKalshi | `TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ` | Token-2022 | 9 | 1,557,907,001,585 | TransferFeeConfig (20 bps, maximumFee u64::MAX, withheld at mint 99,127,698), MetadataPointer, TokenMetadata |
| tOpenAI | `oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ` | Token-2022 | 9 | 684,825,114,702 | same (withheld at mint 1,358,902,222) |
| tSpaceX | `TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v` | Token-2022 | 9 | 1,189,973,352,648 | same (withheld at mint 12,357) |

Not present on any of the three (raw TLV walked, types 1, 18, 19 only): TransferHook, PermanentDelegate, DefaultAccountState, ScaledUiAmount, Pausable, ConfidentialTransfer. **The docs claim "Transfer Fee, Transfer Hook, Metadata Pointer, and On-Chain Metadata"; the chain has no transfer hook.** Mint and fee-config authority `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW`; freeze authority `7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o` (undocumented); `withdrawWithheldAuthority` differs per mint. Tessera token program `TESQvsR4TmYxiroPPQgZpVRoSFG8pru4fsYr67iv6kf`. The landing page mentions xAI; no T-xAI mint exists anywhere fetched.

**Where they trade** (tokens.xyz `resolve` indexes all three as `tokenized_equity`; `markets` verified against the owning program on chain):

| Mint | Pool | Program | Liquidity USD | Note |
|---|---|---|---|---|
| tKalshi | `CGYxcqLiJEoYapZrU7uVGBGfEE15pXDV4mB9AQ8Fsuff` tKalshi-USDC | Meteora DLMM `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo` | 651,508 | reserve_x `5Ws2vsPhYavUnxTh9ErdNGeMb8K9JE3Aw5YdQmfW1EVi` holds 1,129,496,178,735 raw = 72.5% of supply |
| tKalshi | `G13wvpXfYGkWfngC7e6dKdZtxc3D3hH13zbGDv2bMS4P`, `CMgRAGHVA4sgvPwrYTz1ovpBxTTAxVRVgfytgw8onQXW` | Raydium CLMM | 41,805; 21,991 | memecoin pairs (YES, BET) |
| tOpenAI | `2ZWxT3niYjyudmDMDVar9ajNE42RkwYdzZBh6TiMuKQY` tOpenAI-USDC | Meteora DLMM | 571,526 | reserve_x `DUWECDt8osW6K79wEFVPPPDW4ZUrtQZxzFXUCq8mnGk8`, 319,176,912,877 raw = 46.6% of supply |
| tOpenAI | `DJHsKKcd1wavQWAwkC4jJT7g9t7QFdbFGWnJcgfv84mC` and two more | Raydium CLMM | 142,058 and less | memecoin pairs |
| tSpaceX | `8obGpjiUu7QTJHK58YHCoz5HxobmrVP2x5zpMZu3c4BT` tSpaceX-USDC | Meteora DLMM | | 70.7% of supply |

Tessera's docs: "primary liquidity on Meteora"; launches through Meteora Alpha Vault. Kamino has no reserve for any T-Token.

**Rights profile, Tessera (both demo candidates)** with sources:

```ts
rights: {
  vote: false,                       // "Holders have no ownership, voting, or dividend rights in the underlying company" (docs, how-do-tessera-token-work)
  cashDistribution: true,            // "The stablecoin proceeds are allocated to token holders pro rata" at a Liquidity Event (docs, redemption); Terms §2.2 recourse only to Liquidity Event Proceeds
  conversion: "liquidity_event",     // Liquidity Event = IPO or Change of Control (docs, redemption); redemption by burning within a 90-day Redemption Period, unclaimed proceeds may be forfeited (Terms §2.2)
  redemption: "kyc_only",            // "No KYC required" to trade (docs, readme), but Terms §2.1 lets the Issuer require identity verification and refuse Excluded Persons; US and PRC excluded
  legalForm: "spv_loan_participation", // "A T-Token … is a loan participation right"; unsecured loan to a per-token issuer entity; Cayman SPC segregated portfolio holds the exposure (docs)
  transferFeeBps: 20,                // on chain; docs "0.20% per transfer", sender pays, split referrer and treasury
  sources: [
    "https://docs.tessera.pe/overview/how-do-tessera-token-work.md",
    "https://docs.tessera.pe/features/redemption.md",
    "https://docs.tessera.pe/features/token-system-and-fees/transfer.md",
    "https://docs.tessera.pe/technicals/on-chain-programs.md",
    "https://terms.tessera.pe/",
    "https://cdn.tesseralab.co/tessera/t-kalshi.json"
  ]
}
```

Notable quotes: "This is a loan product, not a security - token holders have no ownership, voting, or dividend rights" (token metadata JSON). "Note that '1:1' refers to token supply matching the verified units of underlying exposure — the loan to the issuer entity is unsecured." "If you do not redeem your tokens within the Redemption Period … You permanently lose your funds." Proof of reserve is a Chainlink DataLink asset count, attested about monthly.

## 2. PreStocks

`GET https://prestocks.com/api/prestocks` (no auth, no pagination) returns an array of 8 tokens; the full shape with an example is in `packages/data/prestocks/README.md` and the raw sample in `packages/data/prestocks/sample.json`. Fields: `name, symbol, description, image, external_url, contract_address, markPrice, markValuation, tokenPrice, impliedValuation, supply`. `supply` is the raw supply times the scaled UI multiplier (SPACEX 8,742.52 raw shows as 43,712.58).

All 8 mints are Token-2022, 9 decimals, all authorities `WV9PJN7XTmTLVwbutCLFxp8TyePee6Xq5mRq6Fti5Wc`, same extension set: **TransferFeeConfig 50 bps** (older fee 0 bps, so the fee is recent), TransferHook with program id null (no hook runs), **PermanentDelegate** (issuer can move or burn any balance), DefaultAccountState initialized, **ScaledUiAmount** (OPENAI 1.4861347 effective 2026-07-17, SPACEX 5 effective 2026-06-10, others 1), Pausable (not paused), ConfidentialTransfer mint and fee config, MetadataPointer, TokenMetadata. Holder accounts carry `transferFeeAmount`, so withheld fees sit inside token accounts as well as at the mint.

| Symbol | Mint | Supply (raw) | Token accounts (non-zero) | Withheld at mint |
|---|---|---|---|---|
| ANTHROPIC | `Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw` | 7,381,972,255,745 | 71,012 (37,430) | 321,697,096 |
| OPENAI | `PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF` | 1,901,955,954,294 | 58,648 (32,924) | 123,018,035 |
| POLYMARKET | `Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP` | 4,817,303,701,382 | 19,481 (9,607) | 299,430,364 |
| SPACEX | `PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh` | 8,742,515,849,291 | 17,981 (10,181) | 3,348 |
| ANDURIL | `PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB` | 11,805,980,166,317 | 15,568 (9,281) | 15,765,912 |
| NEURALINK | `PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S` | 2,595,388,468,199 | 12,478 (6,896) | 533,365,349 |
| KALSHI | `PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua` | 904,904,434,985 | 7,666 (4,473) | 3,358,985 |
| FIGUREAI | `PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd` | 3,012,929,745,084 | 1,779 (845) | 19,723,863 |

The sum of account balances is below mint supply on every token (ANTHROPIC by 7.48 tokens), consistent with withheld fees in token accounts: exactly what the fee-aware invariant in 12.2 is for.

**SPACEX after the IPO.** Still in the API and still has a page, but in wind-down: prestocks.com/spacex says "SpaceX has gone public! SpaceX PreStocks tokens must be swapped into $SPCXx or any other token before 11:59pm UTC on 12 March 2027, or they will expire worthless." SPCXx is `Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8` (Backed xStock, Token-2022, verified). FAQ rule: "Holders will have up to 9 months after IPO … to convert their PreStocks tokens into the equivalent tokenized public stock. After the 9-month post-IPO conversion deadline, the tokens will expire worthless." CoinGecko dates the IPO 12 June 2026. Not a demo candidate.

**Where they trade** (tokens.xyz indexes ANTHROPIC as `pre-pren1fvf`, `tokenized_equity`, `not_redeemable`): ANTHROPIC-USDC `ECQbBHaizQtQU7AGtfttR2LbZ229KPibgUsyTG659yq` on **Hadron** `HADRoNbLovyqhCsocfYQYB7QdfCAAinN9HTePvBCVDQ8` (870k USD), ANTHROPIC-SOL `EZyszDEx1LZDt7TsSFV8xdPi49sDKC3mdfv2MVMEQLtU` on Meteora DLMM (220k), `4pzMGcbwEzh1qpownp4nxmrKcsNEduUWaoG8ZaPA4HiK` on Meteora DAMM v2 (167k), plus Raydium CLMM memecoin pairs. Jupiter routes through Meteora DLMM, Hadron, HumidiFi and BisonFi. No Raydium USDC pool and no Kamino reserve for any PreStocks token.

**Rights profile, PreStocks** with sources (all from https://prestocks.com/faq, which is the only documentation; docs.prestocks.com does not resolve and the Terms are an unreadable Notion page):

```ts
rights: {
  vote: false,                        // "They do not confer any ownership, voting, dividend, information, or other legal rights."
  cashDistribution: true,             // cash M&A: "net proceeds will be distributed pro rata as USDC, which holders can convert their PreStocks into"; holders have 6 months to convert, then tokens expire worthless
  conversion: "liquidity_event",      // IPO: convertible "fully onchain, without KYC" into the equivalent tokenized public stock within 9 months of the IPO
  redemption: "none",                 // no issuer redemption; exit is "through onchain liquidity, even if the company never goes public"; arbitrage keeps the peg
  legalForm: "spv_economic_exposure", // "backed 1:1 by SPV exposure that tracks the price of the underlying private company" (API description); "fully backed by holding entities" (FAQ); counterparties undisclosed
  transferFeeBps: 50,                 // on chain since epoch 1032; FAQ "variable fees may be charged on conversions or transfers"
  sources: [
    "https://prestocks.com/faq",
    "https://prestocks.com/api/prestocks",
    "https://prestocks.com/spacex",
    "https://prestocks.com/documents/spacex-prestocks-attestation-report.pdf"
  ]
}
```

Also: "not available in the U.S., to U.S. persons"; "PreStocks is not a broker-dealer, investment advisor, exchange operator, transfer agent, custodian"; third-party attestation reports (BlockOffice) compare circulating supply to backing.

## 3. Pyth

**Price data is key-gated since 26 August 2026.** docs.pyth.network/price-feeds/core/fetch-price-updates: "Hermes now requires an API Key." docs.pyth.network/price-feeds/core/use-historical-price-data: "Required as of August 26, 2026 at 16:00 UTC. Every request must include an `Authorization: Bearer $PYTH_API_KEY` header." Verified live: `hermes.pyth.network/v2/updates/price/latest`, `/v2/updates/price/{ts}` and `benchmarks.pyth.network/v1/updates/price/{ts}` all return HTTP 401 without a key; with a bogus key they return 403 "Not entitled: feed … (asset type 'equity', instrument type 'spot')", so entitlement is per asset class. Pricing page: Free is "view-only through Pyth Terminal (no API permissions)", Starter 500 USD per month is crypto only, Pro from 2,500 USD per month covers equities. Whether a free Terminal key can read any feed through the API is unverified.

What stays public and is enough for the session rule: `GET https://hermes.pyth.network/v2/price_feeds?asset_type=equity` (and `crypto`) returns every feed with `attributes.schedule` and top-level `market_hours { is_open, next_open, next_close }`. Equity.US.* schedule: `America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C` (weekday regular session plus the holiday list). Crypto.*X feeds: `America/New_York;O,O,O,O,O,O,O;` (always open).

Feed ids (live from Hermes):

| Symbol | Id | Asset type, schedule |
|---|---|---|
| Equity.US.AAPL/USD | `49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688` | Equity, 0930-1600 ET weekdays |
| Equity.Index.AAPL/USD ("24/7") | `aaba35e6f33fb973bb2201d48a79ae24795affa6ba8bd50a93dcaf7da0030f36` | Equity, schedule attribute still 0930-1600 |
| Equity.US.SPY/USD | `19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5` | Equity |
| Equity.US.TSLA/USD | `16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1` | Equity |
| Equity.US.NVDA/USD | `b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593` | Equity |
| Crypto.AAPLX/USD (xStock) | `978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675` | Crypto, always open |
| Crypto.SPYX/USD | `2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14` | Crypto |
| Crypto.AAPLON/USD (Ondo) | `e6734de88a83d9d2fb33072adab319004700aefd069653aba30ba9e3cac056f2` | Crypto |
| Crypto.AAPLX/AAPL.RR (redemption rate) | `25babb83691a056fd65f879bfd7197eabd840aae741f69c87ccb31e204a979b2` | Crypto Redemption Rate |
| Crypto.SPYX/SPY.RR | `9e916cc00d292da2367646ffd6537d6b8d0c3f15e2d5891ac44aed31291811a9` | Crypto Redemption Rate |

Endpoints (from the live OpenAPI at pyth.dourolabs.app): historical `GET /v1/updates/price/{timestamp}?ids=…&parsed=true` on benchmarks (Hermes twin `/v2/updates/price/{publish_time}`), semantics "the first Pyth price update whose publish_time is >= the provided value"; response `parsed[].price { price, conf, expo, publish_time }` with price and conf as strings; interval route capped at 60 seconds and 100 ids; rate limit "10 requests every 10 seconds per IP". Latest: `GET /v2/updates/price/latest?ids[]=…`. Best practices: "US equity markets only trade during certain hours, and outside those hours, it's not clear what an equity's price is"; SDKs include a staleness check. Pyth Pro market hours: regular 9:30 to 16:00 ET, pre-market 4:00 to 9:30, post-market 16:00 to 20:00, overnight Sunday to Thursday 20:00 to 4:00; since March 2026 Pro carries forward the last price when a fresh aggregate cannot be produced. The redemption-rate feeds (xStock to underlying) are directly relevant to the multiplier story and were not in the brief.

Live Benchmarks samples for a weekday and a weekend timestamp could not be captured: both return 401.

## 4. What this means for the plan (decisions for you)

1. **Meteora DLMM adapter is now on the critical path.** 47 to 73 percent of each T-Token's supply sits in a Meteora DLMM pool, and PreStocks liquidity is Meteora and Hadron. The existing Raydium and Kamino adapters would attribute only the memecoin-pair CLMM positions. A DLMM adapter (positions by pool, bin liquidity to token amounts, `@meteora-ag/dlmm` math) is about half a day and is the one substantive piece of new resolver code. Hadron stays unattributed and labelled.
2. **Fee-aware invariant is required for both tracks, and PreStocks needs more than the brief expected:** 50 bp fee (not 20), a permanent delegate, and scaled UI multipliers on two mints. The scan must read each account's `transferFeeAmount.withheld_amount`, which means fetching full account data for fee mints rather than the 72-byte slice.
3. **Tessera demo token: tKalshi** (the bounty names OpenAI or Kalshi; tKalshi has 2,605 holders, so scans are quick, and 72.5 percent of supply in one DLMM pool makes the look-through obvious). tOpenAI is the alternative with 8,259 holders.
4. **PreStocks demo token: KALSHI** (`PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua`, 7,666 accounts, multiplier 1) for scan time, or ANTHROPIC (71,012 accounts, the deepest liquidity, 15 to 45 minutes per snapshot on the public RPC). I recommend KALSHI unless you get a fast RPC.
5. **Pyth needs a key before 12.4 can be built as specified.** Options: sign up at pythdata.app for a free Terminal key and test whether the equity or AAPLX feeds are entitled (unverified, the pricing page implies not); or ask the organisers whether bounty entrants get temporary Pro access. Without a key, the session rule and feed metadata still work and can be demoed, but the historical price at the record timestamp cannot be fetched. Say which route, and I will not start 12.4 until a key is in `.env`.
6. **Submission deadline** is ambiguous on the page (Sep 18 in the rules text, Sep 25 everywhere else). Confirm with the organisers.

## 5. Not verified

- Whether a free Pyth Terminal key grants API access to any feed, and Benchmarks retention.
- Tessera's freeze authority and per-mint `withdrawWithheldAuthority` (undocumented); the Chainlink proof-of-reserve values; the Accretion audit PDF.
- PreStocks Terms of Service text (Notion page with public access disabled); the "SPV" wording appears only in the API description.
- Kamino reserves for NEURALINK and OPENAI (PreStocks) were not checked (429); the other six have none.
- Meteora DLMM position math and its SDK have not been probed; that is Phase 12.3 work.

## 6. Outreach

Pending 12.3: the Tessera action page link and 20-second clip go here.
