/**
 * Compute "share of supply a wallet scan cannot see" for a mint, read-only against mainnet
 * (or from a captured fixture with --fixture <file>), and write apps/web/public/data/visibility/<mint>.json.
 * Usage: pnpm visibility <mint> <symbol> [--fixture fixtures/accounts/AAPLx.json.gz]
 */
import "dotenv/config";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ReplayReader, RpcReader, rpcUrlsFromEnv, type ReaderRecording } from "@lookthrough/datasources";
import { defaultAdapters } from "@lookthrough/adapters";
import { computeVisibility } from "@lookthrough/resolver";
import type { ChainReader } from "@lookthrough/core";

async function main() {
  const args = process.argv.slice(2);
  const fixtureIdx = args.indexOf("--fixture");
  const fixture = fixtureIdx >= 0 ? args[fixtureIdx + 1] : undefined;
  const positional = args.filter((a, i) => a !== "--fixture" && i !== fixtureIdx + 1);
  const [mint, symbol] = positional;
  if (!mint || !symbol) throw new Error("usage: pnpm visibility <mint> <symbol> [--fixture file]");

  let reader: ChainReader;
  if (fixture) {
    const payload = JSON.parse(gunzipSync(readFileSync(fixture)).toString()) as { recording: ReaderRecording };
    reader = new ReplayReader(payload.recording);
  } else {
    const urls = rpcUrlsFromEnv();
    reader = new RpcReader({ url: urls.mainnet, fallbackUrl: urls.mainnetFallback, logger: (m) => console.error(`[rpc] ${m}`) });
  }
  const stat = await computeVisibility({ reader, mint, symbol, adapters: defaultAdapters(), log: { info: (m) => console.error(`[info] ${m}`), warn: (m) => console.error(`[warn] ${m}`) } });
  mkdirSync("apps/web/public/data/visibility", { recursive: true });
  const file = `apps/web/public/data/visibility/${mint}.json`;
  writeFileSync(file, JSON.stringify({ ...stat, source: fixture ? `fixture ${fixture}` : "mainnet", generatedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ file, symbol, slot: stat.slot, timestamp: stat.timestamp, accountsScanned: stat.accountsScanned, programHeldPct: stat.programHeldPct, breakdown: stat.breakdownByProgram }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
