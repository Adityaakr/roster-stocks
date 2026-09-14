# 01. Phase 0 plan review (Prism, 2026-09-14)

Archetype BUILD, looped, one-way door (the program holds USDC and pays on Merkle proofs). Fleet: 7 lenses (first-principles, adversary, practitioner, security, data-integrity, testability/ops, regulatory/audience), then 3 skeptics on the 4 load-bearing design claims.

## 1. Recommendation

Keep the plan in `CLAUDE.md` and the phase order. Apply eight corrections before Phase 1 code: discover containers from program state rather than owner-program lookup; pause the fork clock during a resolve; keep invariants in raw units with a mint-supply soft check; convert the multiplier via its shortest round-trip string; subtract Raydium protocol and fund fees before pro rata scaling; attribute Kamino by cToken share including cTokens outside obligations; enforce `registered_at_slot <= snapshot_slot` and `entitlement > 0` on-chain; fix the wording on dividends, votes and "native shares". Pin `@anchor-lang/core` 1.2.0 and `@solana/kit` 2.3.0.

## 2. Why

- Kamino's vault owner is a PDA with no account on this market and a System-owned account on others (verified by two skeptics over Alchemy reads), so owner-program classification would return "unknown" or "wallet". Address matching from discovered Reserve accounts is deterministic.
- The hard invariant is closed under any subset of accounts; only mint supply catches an incomplete scan (first-principles, unrefuted).
- Raydium `collect_protocol_fee` and `collect_fund_fee` draw from `token_vault_0`, so the raw vault balance overstates LP entitlement (verified in the Raydium program source by skeptic A; 715,790 raw of 26.7 B on the AAPLx pool today).
- Anchor 1.0.0 moved the TS client to `@anchor-lang/core` (release notes, PR #4141; npm published 2026-09-04).

## 3. Steelman of the rejected options

- **Hard-coded known-vaults map.** Strongest case: it is explicit, auditable, and the demo needs one reserve and one pool. Rejected because it silently misses any new reserve or pool and because container discovery is one gPA per program, which the adapter interface already requires.
- **Skip the on-chain registration slot check, filter off-chain only.** Strongest case: the tree already filters, so the check is redundant and costs a comparison. Rejected because the program is the only party a judge can verify; resolver discipline is not.
- **Use `solana_program::keccak`.** Strongest case: it compiles under deny(warnings) with no extra dependency (proved by two skeptics). Rejected in favour of `solana-keccak-hasher` because the re-export is deprecated and the direct crate is what the deprecation note asks for.

## 4. Assumptions and falsifiers

- Raydium and Kamino CPIs accept a 165-byte source account for a hook mint with no hook program set. Falsifier: `openPositionFromBase` or `buildDepositTxns` failing with `InvalidAccountData` on the fork. Mitigation: create ATAs with real instructions before setting balances.
- surfpool's gPA merges cheatcode-written accounts for the full unfiltered scan (verified only for a filtered query). Falsifier: the seeded Alice account missing from the Phase 1 scan.
- The tokens.xyz key arrives; until then the tokens.xyz client is tested against fixtures only.

## 5. Open questions for the human

- `TOKENS_API_KEY` is still missing; the base URL alone returns 401.
- Whether to keep the Backpack session-aware record-date suggestion (practitioner flagged it as cuttable; the spec asks for it).

## 6. Evidence

Claims and how they survived. Grounding outranks cross-tier survival.

| Claim | Tier | Source |
|---|---|---|
| `@anchor-lang/core` 1.2.0 is the Anchor 1.x TS client | verified | npm registry, Anchor 1.0.0 release notes |
| Kamino supplyVault owner PDA has no account on this market; classification needs discovery, not a map | verified (premise), refuted (conclusion, 2 of 3) | Alchemy `getAccountInfo`, klend-sdk seeds.js, gPA memcmp offset 160 |
| Raydium vault includes protocol and fund fees; poolId offset 41, span 281 | verified | installed PoolInfoLayout walk, live pool decode, Raydium program source |
| Cheatcode-seeded AAPLx transfer succeeds on the fork | verified, conditional | three independent fork transfers; failed when the hook program was patched to Memo |
| keccak must come from `solana-keccak-hasher` | refuted (2 of 3) | two throwaway crates built under deny(warnings) |
| anchor-lang 1.2.0 does not re-export keccak | verified | anchor-lang-1.2.0/src/lib.rs:71-150 |
| AAPLx reserve is collateral-only (`borrowLimit` 0) | verified | klend-sdk Reserve.decode over Alchemy |
| xStocks are tracker certificates without voting rights; dividends reinvested via multiplier | supported | docs.xstocks.fi FAQ, Kraken FAQ |
| Paper citation Research Policy 55(7) 2026 105497 | supported | ScienceDirect and SSRN metadata |

Evidence summary: 6 verified, 2 supported, 0 unverified, 2 contradicted (struck as stated, premises kept).

> Cross-tier verification reduces instance- and tier-level error correlation but not shared-lineage blind spots. Treat cross-tier survival as weaker evidence than grounding.

## Telemetry
- divergence: 0.76 (evidence 0.97, conclusion 0.45) | threshold 0.30 UNCALIBRATED
- grounding: n/a
- models: draft=fable · lenses=7 forks · skeptics=2x-opus+1x-sonnet (cross-tier; version axis unavailable)
- claims: C0 grounded · C1 premise grounded, conclusion struck · C2 grounded · C3 grounded (conditional) · C4 struck · wording claims cross-tier-survived
- fleet: 7 lenses + 3 skeptics · token-multiple vs single-pass ≈ 8x

## Changelog
Loop ran one round; a second round was not needed because every lens finding was either applied or struck. Casualties: the known-vaults map and the keccak "must". Open risk: hook-mint CPIs on seeded accounts, unverified until Phase 2.
