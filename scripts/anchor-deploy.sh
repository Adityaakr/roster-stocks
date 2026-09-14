#!/usr/bin/env bash
# Deploy the program to the fork (idempotent: redeploys the same program id).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
mkdir -p target/deploy
cp programs/lookthrough/lookthrough-keypair.json target/deploy/lookthrough-keypair.json
anchor deploy --provider.cluster "${FORK_RPC_URL:-http://127.0.0.1:8899}" --provider.wallet .keys/registrar.json
