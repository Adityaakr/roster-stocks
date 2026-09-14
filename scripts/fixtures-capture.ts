/**
 * Capture a full mint snapshot from mainnet (read-only) as a replayable fixture.
 * Usage: pnpm fixtures:capture <mint> [<symbol>]
 * Writes fixtures/accounts/<symbol or mint>.json.gz containing every RPC read the resolver made.
 */
import "dotenv/config";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { RecordingReader, RpcReader, rpcUrlsFromEnv } from "@lookthrough/datasources";
import { defaultAdapters } from "@lookthrough/adapters";
import { defaultRules, runSnapshot, supplyPanel } from "@lookthrough/resolver";

async function main() {
  const [mint, symbolArg] = process.argv.slice(2);
  if (!mint) throw new Error("usage: pnpm fixtures:capture <mint> [symbol]");
  const urls = rpcUrlsFromEnv();
  const rpc = new RpcReader({ url: urls.mainnet, fallbackUrl: urls.mainnetFallback, logger: (m) => console.error(`[rpc] ${m}`) });
  const recorder = new RecordingReader(rpc);
  const started = Date.now();
  const set = await runSnapshot({
    reader: recorder,
    mint,
    adapters: defaultAdapters(),
    registry: new Set(),
    rules: defaultRules,
    actionId: "fixture",
    log: { info: (m) => console.error(`[info] ${m}`), warn: (m) => console.error(`[warn] ${m}`) },
    onProgress: (step, data) => console.error(`[${step}]`, JSON.stringify(data ?? {}))
  });
  const symbol = symbolArg ?? mint;
  mkdirSync("fixtures/accounts", { recursive: true });
  const file = `fixtures/accounts/${symbol}.json.gz`;
  const payload = { mint, symbol, slot: set.snapshotSlotActual, timestamp: set.snapshotTimestamp, recording: recorder.recording };
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(payload))));
  const panel = supplyPanel(set);
  console.log(JSON.stringify({ file, slot: set.snapshotSlotActual, accounts: set.accountsScanned, attributedPct: panel.attributedPct, unattributed: panel.byLabel, warnings: set.invariants.warnings, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
