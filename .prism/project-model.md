# Lookthrough project model (Prism code-truth layer)

## Architecture
Monorepo (pnpm 11 workspaces). `packages/datasources` (tokens.xyz and Backpack clients, zod at every boundary), `packages/core` (types, math, merkle), `packages/adapters` (PositionAdapter implementations), `packages/resolver`, `packages/sdk`, `apps/web` (Phase 4), `programs/lookthrough` (Anchor 1.2.0, Phase 3). Fork via `scripts/fork.sh` (surfpool 1.0.0).

## Invariants (cited)
- Supply conservation in raw units: attributed + unattributed == sum of raw balances of every token account for the mint at the snapshot (spec 5.4; `docs/01-phase-0-plan-review.md`).
- Secrets never reach the browser; the tokens.xyz key is used only in `packages/datasources/src/tokens.ts` from server code.
- Containers are discovered from program state, never from a hard-coded map (`docs/01-phase-0-plan-review.md`, C1).

## Danger zones
- Rounding when scaling Raydium positions to the vault base and when flooring share units (CLAUDE.md, "Resolver rules refined").
- Cheatcode-seeded token accounts are 165 bytes; hook-mint CPIs unverified (CLAUDE.md gotchas).

## Decision log
- 2026-09-14 Phase 0: plan reviewed by Prism; see `docs/01-phase-0-plan-review.md` and `DECISIONS.md`.

## Lessons
- The Kamino lending-market authority PDA can be absent on chain; never classify by owner-program lookup alone.

## Update 2026-09-15 (Phases 1 to 4)
- Architecture as built: `packages/{core,datasources,adapters,resolver,registrar,sdk}`, `programs/lookthrough` (Anchor 1.2, sbpf v0, litesvm tests), `apps/web` (Next 16, route handlers proxy tokens.xyz and Backpack, demo wallets server-signed), `scripts/` (fork, seed, demo, registrar CLI, probes).
- Invariants added: program checks `registered_at_slot <= snapshot_slot` and `entitlement > 0` (programs/lookthrough/src/instructions/claim.rs, cast_vote.rs); Raydium protocol and fund fees are unattributed rows (packages/adapters/src/raydiumClmm.ts); Kamino attributes by cToken share over `collateral.mintTotalSupply` (packages/adapters/src/kaminoLend.ts).
- Danger zones: RPC rate limits (public mainnet per-method budget; Alchemy compute units on gPA); surfpool proxies `getTokenLargestAccounts` and `getTokenAccountsByOwner`+mint to the datasource; `dataSlice` may be ignored on first proxied read.
- Lessons: Anchor 1.x moved the TS client to `@anchor-lang/core` and `CpiContext::new` takes a Pubkey; litesvm needs sbpf v0 and starts at slot 440,208,000; Turbopack needs extensionless relative imports.
