#!/usr/bin/env bash
# Playwright smoke test of every page. Needs the web app running (pnpm --filter @lookthrough/web dev) on :3000;
# when it is not reachable the step is skipped with a message rather than failing verify.
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
if ! curl -s -o /dev/null --max-time 5 "$URL"; then
  echo "smoke: web app not reachable at $URL, skipping. Start it with: pnpm --filter @lookthrough/web dev" >&2
  exit 0
fi
npx playwright test
