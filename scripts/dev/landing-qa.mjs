/**
 * Screenshots every landing section at 1280px and 390px into docs/landing-qa/ and rewrites docs/LANDING_QA.md.
 * Copy next to apps/web/e2e first so @playwright/test resolves: cp scripts/dev/landing-qa.mjs apps/web/e2e/_qa.mjs && (cd apps/web && node e2e/_qa.mjs)
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "../../docs/landing-qa";
const SECTIONS = [
  ["hero", "#hero", "The loss in one line, then the product revealed pixel by pixel."],
  ["brands", "#brands", "Serious institutions already named the problem this year."],
  ["check", "#check", "The reader tests a wallet before reading anything else."],
  ["works", "#works", "Four steps as tab cards; the image on the right follows the active card."],
  ["choice", "#choice", "The accordion cycles through the four options; the last one is the 2x2 with the empty corner filled."],
  ["feature", "#feature", "Two live actions, three next, all on the same root."],
  ["number", "#number", "Four measured figures counting up, with their slots."],
  ["problem", "#problem", "The statements make the failure concrete and the fix legible."],
  ["pricing", "#pricing", "Three audiences laid out like the plan table, each with a real figure."],
  ["questions", "#questions", "Boxed accordion, one answer open at a time."],
  ["cta", "#cta", "The closing line and the two doors."]
];
const browser = await chromium.launch();
const lines = ["# Landing QA", "", `Generated ${new Date().toISOString()} against ${base}. One screenshot per section at 1280px and 390px, with the feeling each section is meant to leave.`, ""];
let errors = [];
for (const [w, name] of [[1280, "desktop"], [390, "phone"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text().slice(0, 160)}`); });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  lines.push(`- ${name}: document scroll width ${scrollW}px at viewport ${w}px${scrollW > w ? " (HORIZONTAL OVERFLOW)" : ""}`);
  for (const [id, sel] of SECTIONS) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);
    await el.screenshot({ path: `${out}/${id}-${name}.png` });
  }
  await page.close();
}
lines.push("");
for (const [id, , feel] of SECTIONS) {
  lines.push(`## ${id}`, "", feel, "", `![${id} at 1280](landing-qa/${id}-desktop.png)`, "", `![${id} at 390](landing-qa/${id}-phone.png)`, "");
}
lines.push("## Console errors", "", errors.length ? errors.map((e) => `- ${e}`).join("\n") : "None.", "");
writeFileSync("../../docs/LANDING_QA.md", lines.join("\n"));
console.log("done", errors.length, "console errors");
await browser.close();
