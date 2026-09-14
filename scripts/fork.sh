#!/usr/bin/env bash
# Start a surfpool mainnet fork on 127.0.0.1:8899 with MAINNET_RPC_URL as the datasource.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
PORT="${FORK_PORT:-8899}"
WS_PORT="${FORK_WS_PORT:-8900}"
ARGS=(start --no-tui -y --no-deploy --port "$PORT" --ws-port "$WS_PORT")
if [ -n "${MAINNET_RPC_URL:-}" ]; then
  ARGS+=(--rpc-url "$MAINNET_RPC_URL")
else
  echo "MAINNET_RPC_URL not set, using the public mainnet datasource (rate limited)" >&2
  ARGS+=(--network mainnet)
fi
mkdir -p .keys
if [ ! -f .keys/registrar.json ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile .keys/registrar.json
  echo "created .keys/registrar.json" >&2
fi
ARGS+=(--airdrop-keypair-path .keys/registrar.json)
echo "surfpool ${ARGS[*]}" >&2
exec surfpool "${ARGS[@]}"
