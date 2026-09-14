#!/usr/bin/env bash
# Start a surfpool mainnet fork on 127.0.0.1:8899.
# Datasource: FORK_DATASOURCE_URL if set, else the public mainnet RPC. The fork proxies getProgramAccounts to the
# datasource, and the Alchemy free tier rate-limits those, so MAINNET_RPC_URL is deliberately not used here.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
PORT="${FORK_PORT:-8899}"
WS_PORT="${FORK_WS_PORT:-8900}"
ARGS=(start --no-tui -y --no-deploy --port "$PORT" --ws-port "$WS_PORT")
if [ -n "${FORK_DATASOURCE_URL:-}" ]; then
  ARGS+=(--rpc-url "$FORK_DATASOURCE_URL")
else
  ARGS+=(--network mainnet)
fi
if [ -n "${FORK_SNAPSHOT:-}" ]; then
  ARGS+=(--snapshot "$FORK_SNAPSHOT")
fi
mkdir -p .keys
if [ ! -f .keys/registrar.json ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile .keys/registrar.json
  echo "created .keys/registrar.json" >&2
fi
ARGS+=(--airdrop-keypair-path .keys/registrar.json)
echo "surfpool ${ARGS[*]}" >&2
exec surfpool "${ARGS[@]}"
