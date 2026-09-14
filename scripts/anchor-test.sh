#!/usr/bin/env bash
# Runs the Anchor program tests against the fork. Placeholder until Phase 3 adds programs/lookthrough.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f programs/lookthrough/Cargo.toml ]; then
  echo "anchor tests: no program yet (Phase 3), skipping" >&2
  exit 0
fi
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
anchor test --skip-local-validator --provider.cluster "${FORK_RPC_URL:-http://127.0.0.1:8899}"
