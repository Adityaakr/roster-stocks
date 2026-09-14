#!/usr/bin/env bash
# Copy the built IDL and its TypeScript types into the SDK package. Run after `anchor build`.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f target/idl/lookthrough.json || { echo "target/idl/lookthrough.json missing, run anchor build first" >&2; exit 1; }
mkdir -p packages/sdk/src/idl
cp target/idl/lookthrough.json packages/sdk/src/idl/lookthrough.json
cp target/types/lookthrough.ts packages/sdk/src/idl/lookthrough.ts
echo "idl synced: $(python3 -c "import json;print(json.load(open('target/idl/lookthrough.json'))['address'])")"
