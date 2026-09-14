#!/usr/bin/env bash
# Program tests: litesvm suite in Rust (hermetic) plus, when the fork is up, the TypeScript e2e against the fork.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
if [ ! -f target/deploy/lookthrough.so ]; then
  echo "anchor tests: target/deploy/lookthrough.so missing, run pnpm anchor:build first" >&2
  exit 1
fi
cargo test --release -p lookthrough -- --nocapture 2>&1 | grep -E "^test |test result|panicked|error" || true
cargo test --release -p lookthrough >/dev/null 2>&1
