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
