/**
 * Full-page screenshots of every app page, for design review.
 *   node scripts/dev/screenshots.mjs http://localhost:3000 /tmp/shots
 * Run from apps/web (so @playwright/test resolves): cd apps/web && node ../../scripts/dev/screenshots.mjs
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "/tmp/shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`${page.url()} :: ${m.text().slice(0, 200)}`);
});
const pages = [
  ["landing", "/?demo=1", "table.table tbody tr"],
  ["portfolio", "/portfolio", "table.table"],
  ["assets", "/assets", ".asset-card"],
  ["asset", "/assets/apple", ".chart svg, .msg"],
  ["actions", "/actions", "table.table, .card"],
  ["issuer", "/issuer", ".steps"],
  ["adapters", "/adapters", "table.table"]
];
for (const [name, path, wait] of pages) {
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => undefined);
  await page.locator(wait).first().waitFor({ timeout: 40_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("shot", name);
}
console.log(errors.length ? `errors:\n${errors.join("\n")}` : "no console errors");
await browser.close();
