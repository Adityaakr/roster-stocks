
## 2026-09-15

- **Program tests run on litesvm, the demo on the fork.** Anchor 1.2's template ships litesvm Rust tests; they cover the security checklist hermetically in 0.02 s. The fork e2e (`tests/e2e/demo.test.ts`, `pnpm demo`) exercises the real Token-2022 AAPLx mint and the fork's USDC. Rejected: mocha tests against the fork only, which would tie every security test to a 10-minute snapshot.
- **sbpf v0 build.** litesvm 0.16 rejects sbpf v3 executables; v0 runs everywhere. Rejected: patching litesvm's feature set.
- **Vote reuses the distribution's entitlement set.** `snapshot --reuse-from` builds a second tree (new action id, same slot) so the demo needs one resolve, not two. The leaf format binds the action id, so the trees differ and receipts are per action.
- **Per-wallet live ledger is labelled estimated.** The holder page resolves one wallet live (direct, Raydium positions, Kamino deposits) without the pool-wide pro rata step; the record-date snapshot is the number that counts and the UI says so.
- **No hermetic offline fork.** surfpool's exported snapshot only holds individually fetched accounts; full scans are proxied. Kept the datasource-backed fork with a patient reader. A keyed RPC with generous getProgramAccounts (Helius) is the lever for a fast demo; the Alchemy free tier meters those calls by compute units.
- **Registrations happen before the record date in the demo.** The program enforces `registered_at_slot <= snapshot_slot`; the first fork snapshot (demo-dividend) predates the registrations, so its claims are rejected on purpose and the demo schedules a new record date after registering.
