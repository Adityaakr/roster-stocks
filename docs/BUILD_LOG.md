# Build log

## Main track

- **Submission URL:** not recorded yet. Section 12 of `CLAUDE.md` (bounty tracks) is gated on this line being filled in.
- **Branch:** `feat/phase-0-scaffold` (six phase commits plus follow-ups, nothing merged to `main` yet).

### Phase checklist

| Phase | Acceptance | Result | Evidence |
|---|---|---|---|
| 0 | scaffold, `pnpm verify` green, clients return real data | passed 2026-09-14 | commit `fe08a9a`; Backpack live; tokens.xyz live from 2026-09-16 |
| 1 | resolver core, visibility stat, invariant test on a mainnet fixture | passed 2026-09-15 | AAPLx fixture slot 447,052,243, 61,972 accounts, 99.39% attributed, sum equals supply |
| 2 | Raydium and Kamino adapters, tree, `schedule` and `snapshot` | passed 2026-09-15 | Alice resolved to 100.000096 share equivalents on the fork (25 wallet, 35 Raydium, 40 Kamino) |
| 3 | program, SDK, `publish`, `fund`, `proof`; claim and vote from the CLI, double claim rejected | passed 2026-09-15 | litesvm suite 4 tests, merkle vectors 2 tests; fork demo checklist |
| 4 | four pages, demo mode, design system, screenshots | passed 2026-09-15, revised 2026-09-16 | Playwright smoke 8 tests on desktop and phone |
| 5 | `pnpm demo` green, video script, README, pitch | passed 2026-09-16 | 13 of 13 scene checks; `docs/video.md`, `docs/pitch.md`, `README.md` |

### Last full demo run (fork, 2026-09-16)

Snapshot slot 447,434,630, 99.20% attributed, double counted 0. Alice claimed 25.000024 USDC for 100.000096 share equivalents; double claim rejected; votes for 100.000096, against 50.000054, abstain 50.00.

## Bounty tracks

Not started. Gate: the submission URL above.
