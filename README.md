# Lookthrough

Lookthrough resolves a holder's tokenized-stock entitlements across wallets and DeFi positions at a record-date slot, publishes a verifiable Merkle root on Solana, and lets issuers distribute corporate actions without holders unwinding their positions.

```
                AAPL record date

        Wallet scanner        Lookthrough
              25                  100
            shares               shares

          75 shares recovered from DeFi positions

       Claim 25.00 USDC       Cast 100 votes
```

Everything in that picture comes from a run on a mainnet fork: Alice's 100 share equivalents of AAPLx are 25 in her wallet, 35 in a Raydium CLMM position and 40 deposited into Kamino, both opened with the protocols' own instructions. See "What is real and what is simulated" before you read any number here as more than it is.

## The problem

Tokenized stocks on Solana are composable. The moment a token enters a Raydium pool, a Kamino reserve, a basket or a vault, the program becomes the formal owner, and an issuer looking at wallet balances at a record date cannot tell who is economically entitled to a dividend, a vote, a spin-off or a tender offer. The two obvious fixes both fail: airdropping to token accounts pays program vaults that cannot account for it, and forcing holders to withdraw from DeFi for every record date drains liquidity.

This is the unresolved problem identified in Malinova, K. and Park, A., "Tokenized stocks for trading and capital raising", Research Policy 55(7), 2026, 105497, doi 10.1016/j.respol.2026.105497. Their proposed fix, an opt-in registry with a look-through into pool positions, is what Lookthrough translates into Solana primitives. The paper also flags the privacy trade-off of such a registry, which is repeated below.

## How it works

Four pieces.

1. **Opt-in registry.** A wallet signs once to register for corporate-action eligibility on a mint. On-chain PDA `["reg", mint, wallet]` with the registration slot. No identity, no KYC, no authority.
2. **Entitlement resolver.** At the snapshot slot, every token account of the mint is attributed exactly once. Wallet-owned accounts go to their wallet. Program-held accounts are looked through by adapters under issuer-defined pass-through rules: Raydium CLMM positions and Kamino Lend deposits in v1. Everything else stays unattributed, labelled by the owning program's on-chain IDL name or as "other programs", never guessed.
3. **Record-date proof.** Entitlements are hashed into a Merkle tree; the root, a sha256 of the published `entitlements.json` and the snapshot slot go on-chain. Anyone can download the set and recompute the root.
4. **Rights router.** Holders claim a USDC distribution or cast a weighted vote by presenting a proof. The program checks registration at or before the snapshot slot, inclusion, single use, and pays with checked arithmetic.

### The leaf, in bytes

```
leaf = keccak256(0x00 || action_id[32] || wallet[32] || mint[32] || snapshot_slot (u64 LE) || entitlement (u64 LE))
node = keccak256(0x01 || min(a, b) || max(a, b))          byte-wise comparison
```

Leaves are sorted by wallet bytes, zero entitlements are excluded, an odd node at any level is promoted unchanged, and proofs are the sibling list from the leaf upwards (at most 32). Entitlements are integers in 6-decimal share units (1 share = 1,000,000), computed as `raw × multiplier / 10^decimals` with exact decimal arithmetic and floored once per wallet. The TypeScript (`packages/core/src/merkle.ts`) and Rust (`programs/lookthrough/src/merkle.rs`) implementations share the vectors in `fixtures/merkle.json`.

### The invariants

Tested on a recorded mainnet fixture and on every snapshot:

1. `sum(rawAttributed) + sum(unattributed) == sum(raw balances of all token accounts for the mint)` in raw units. A soft check compares that sum with the mint supply and reports any delta, which is what catches an incomplete scan.
2. No `(wallet, container)` pair appears twice.
3. No container is attributed more than its balance.
4. Entitlements are computed for all wallets and only then filtered to registered wallets, so the supply panel is truthful regardless of registration.

### Pass-through rules (issuer-defined, `defaultRules` in `packages/resolver/src/snapshot.ts`)

- `direct`: 100% to the wallet.
- `raydium_clmm`: for each position, the token amount at the snapshot sqrt price plus owed and accrued fees; all positions scaled pro rata to the vault balance net of Raydium's protocol and fund fees (those are listed as unattributed); attributed to the position NFT's current holder; positions held by programs stay unattributed with a label.
- `kamino_lend`: each depositor's share of collateral tokens times the tokens physically in the reserve's liquidity vault. Economic exposure via the exchange rate is recorded separately. The AAPLx reserve has `borrowLimit` 0, so it is collateral-only and the two are equal; the UI says so and does not present a live lending scenario.

## What is real and what is simulated

- **Real:** the mints (AAPLx `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`, SPYx `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W`) with their Token-2022 scaled UI amount extension, the Raydium CLMM pool `CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y`, the Kamino xStocks market reserve `CKJbqakbPGyhziowm19LPYz636UszuezfkitmpRtcLSH`, every other holder on mainnet, and the program running on a surfpool fork of mainnet.
- **Simulated:** the issuer. A registrar keypair we operate publishes actions. The USDC distribution is funded by a demo wallet. Alice, Bob and Carol are local keypairs whose AAPLx balances were set with the fork's cheatcode (their Raydium and Kamino positions were then opened with real instructions, and the fork's recorded mint supply was raised by the seeded amount so the supply check stays honest).
- **Lending scenario:** collateral-only. Nothing is borrowed from the AAPLx reserve, so "payment in lieu owed by borrowers" is zero and the UI never implies a live lending scenario.
- **Supply warning on the fork:** the fork pins the AAPLx mint account locally (its supply was raised by the seeded amount) while it proxies every other account from live mainnet, so between a seed and a snapshot mainnet minting can make the token-account sum drift above the pinned supply by a few shares. The resolver reports this as a warning with the delta rather than hiding it; on the recorded mainnet fixtures the sum matches supply exactly.
- **Snapshot semantics:** standard RPC cannot read state at a past slot. A record date is scheduled as a future slot; the resolver runs once that slot is reached and writes the slot it actually read into every leaf and the on-chain metadata. On the fork this is a consistent view. Against mainnet it is "a consistent view at or shortly after the record slot", and the path forward is an archival RPC that serves `getProgramAccounts` at a slot.
- **The "100 shares" number:** the resolver returns what the rules produce. In the fork runs Alice resolved to 99.94 to 100.00 share equivalents depending on how far the pool state and the vault balance had drifted apart between two datasource reads; the UI shows six decimals and never rounds a figure to hide that.

## The visibility stat

Computed by `pnpm visibility <mint> <symbol>` from a full scan of every token account of the mint (`fixtures/accounts/*.json.gz` hold the recorded reads), written to `apps/web/public/data/visibility/`. Numbers below are from mainnet on 2026-09-14.

| Mint | Slot | Token accounts | Held by programs | Of which |
|---|---|---|---|---|
| AAPLx | 447,052,243 | 61,972 | 1.88% | Kamino Lend 0.89%, Raydium CLMM 0.52%, other programs 0.47% (largest: a program whose on-chain IDL is named byreal_clmm, 0.11%) |
| SPYx | 447,038,453 | 156,328 | 30.35% | one program with on-chain IDL name "pump" 20.21%, Kamino Lend 5.55%, Raydium CLMM 3.97%, other 0.62% |

For both mints the scanned token accounts sum exactly to the mint supply.

## Supported positions

| Position type | Adapter | Status |
|---|---|---|
| Direct Token-2022 and SPL Token balances | `direct` | implemented |
| Raydium CLMM positions (NFT holder) | `raydium_clmm` | implemented |
| Kamino Lend deposits (obligations and cTokens) | `kamino_lend` | implemented |
| Meteora DLMM | `meteora_dlmm` | stub, unattributed with label |
| Orca Whirlpool | `orca_whirlpool` | stub, unattributed with label |
| Baskets and index vaults | `baskets` | stub, unattributed with label |
| Backpack omnibus | `backpack_omnibus` | stub, unattributed with label |

## Wording

Entitlements here are issuer-defined pass-throughs across composable on-chain positions. Lookthrough never determines legal beneficial ownership. xStocks are tracker certificates: they carry no voting rights, and their dividends are reinvested and reflected in the mint's scaled UI multiplier, which applies to every raw balance including pool vaults. On xStocks, Lookthrough's value is votes an issuer chooses to route, non-cash actions, and cross-wrapper consistency; the vote in the demo is a simulated issuer showing the rail. Backpack and Superstate tokens are tokenized claims and entitlements whose issuers may pass through cash and votes. Lookthrough does not issue, offer or market any security, and xStocks are not offered to US persons.

## Run it

Prerequisites: Node 22, pnpm 11, Rust stable, solana-cli 4.x, anchor-cli 1.2.0 (`avm`), surfpool 1.0.0.

```
cp .env.example .env            # optional: TOKENS_API_KEY for the issuer console's stock search
pnpm install
pnpm fork                       # terminal 1: surfpool mainnet fork on 127.0.0.1:8899
pnpm anchor:build && pnpm anchor:deploy
pnpm seed                       # Alice, Bob, Carol: balances, Raydium position, Kamino deposit
pnpm demo                       # the five scenes, prints a checklist with transaction signatures
pnpm --filter @lookthrough/web dev   # http://localhost:3000/?demo=1
```

Registrar CLI: `pnpm registrar schedule|snapshot|register|publish|fund|claim|vote|proof|tally`. The web issuer console calls the same functions.

Tests: `pnpm verify` runs typecheck, lint, unit tests (adapters on recorded mainnet fixtures, the invariant test, Merkle vectors) and the program's litesvm security suite. `pnpm test:e2e` runs the five scenes against the fork. A snapshot on the datasource-backed fork takes 5 to 15 minutes because every position holder lookup is proxied to a public RPC; a keyed RPC with generous `getProgramAccounts` shortens it.

## Who would use it

Issuers and transfer agents get a record-date process that survives composability. Lending protocols and AMMs get depositors who are not disenfranchised. Wallets that already run native voting rails are customers of an open interface, not competitors: they can read the same tree and present the same proofs. Holders keep their positions.

## Roadmap

More adapters (Meteora DLMM, Orca, baskets, Backpack omnibus), a ZK proof of holdings so registration does not link a wallet to an intent, archival snapshots at the exact record slot, and native mint and redeem through the Backpack Securities rail once those endpoints are in the public docs (they were not on 2026-09-14; the rail here only maps securities to mints).

## Privacy caveat

Registering publishes an on-chain record that a wallet opted in for a mint, and claims and votes are public transactions. Lookthrough holds no identity data, but a registered wallet is linkable to its DeFi positions and its votes. The paper flags this trade-off.

## Licence

MIT.
