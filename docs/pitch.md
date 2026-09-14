# Five slides

## 1. The problem

Tokenized stocks on Solana are composable: Raydium pools, Kamino reserves, baskets, vaults. Shareholder infrastructure is not. When a token enters a program, the program is the formal owner. At a record date an issuer looking at wallet balances cannot tell who is entitled.

Read from mainnet on 2026-09-14: 30.35% of SPYx supply and 1.88% of AAPLx supply sit in programs, invisible to a wallet scan.

The two obvious fixes fail. Airdropping to token accounts pays vaults that cannot account for it. Forcing holders to withdraw for every record date drains liquidity. Malinova and Park (Research Policy, 2026) name this as the unresolved problem and propose an opt-in registry with a look-through into pool positions.

## 2. What Lookthrough does

One sentence: it resolves a holder's entitlements across wallets and DeFi positions at a record-date slot, publishes a verifiable Merkle root on Solana, and lets issuers distribute corporate actions without holders unwinding anything.

Four pieces: opt-in registry, entitlement resolver, record-date proof, rights router.

## 3. The one screenshot

AAPL record date. Wallet scanner: 25 shares. Lookthrough: 100 shares. 75 recovered from DeFi positions. Claim 25.00 USDC. Cast 100 votes.

Everything in that screenshot came from a run on a mainnet fork: a real Raydium CLMM position and a real Kamino deposit opened with the protocols' own instructions.

## 4. Why it can be trusted

- Supply conservation is an invariant, not a feature. Every token account is attributed once; attributed plus unattributed equals supply, or the run fails.
- Unknown holders are labelled from their on-chain IDL name or as "other programs". Nothing is guessed.
- The leaf format is documented in bytes. Anyone can download the entitlement set, recompute the root, and verify a wallet in the browser.
- The program enforces registration at or before the snapshot slot, inclusion, and single use, with checked arithmetic. Security tests cover double claims, bad proofs, unregistered wallets, late registration, deadlines, underfunding and u64 limits.
- What is simulated is labelled: the issuer role, the demo wallets, the USDC that funds the distribution.

## 5. Who uses it and what is next

Issuers and transfer agents get a record-date process that survives composability. Lending protocols and AMMs get an open interface so their depositors are not disenfranchised. Wallets with native voting rails become customers of the interface, not competitors. Holders keep their positions.

Next: more adapters (Meteora, Orca, baskets, Backpack omnibus), archival snapshots at the exact slot, a ZK proof of holdings so registration does not link a wallet to an intent, and native mint and redeem through the Backpack rail once it is in the public docs.
