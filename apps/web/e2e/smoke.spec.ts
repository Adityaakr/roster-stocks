import { expect, test } from "@playwright/test";

/** Every page renders, shows its key copy, and logs no console errors. Screenshots land in e2e/screenshots. */
const pages = [
  { path: "/?demo=1", heading: "Corporate actions for tokenized stocks, wherever the shares sit.", level: 1, name: "landing", wait: "table.table" },
  { path: "/portfolio?demo=1", heading: "Portfolio", level: 1, name: "portfolio", wait: "table.table, [role=alert]" },
  { path: "/assets", heading: "Assets", level: 1, name: "assets", wait: ".asset-card, [role=alert]" },
  { path: "/assets/apple", heading: /Apple/, level: 1, name: "asset", wait: ".chart svg, .msg.red, [role=alert]" },
  { path: "/actions?demo=1", heading: "Record dates", level: 1, name: "actions", wait: ".card" },
  { path: "/issuer?demo=1", heading: "Issuer console", level: 1, name: "issuer", wait: ".steps" },
  { path: "/adapters", heading: "Adapters", level: 1, name: "adapters", wait: "table.table" }
] as const;

for (const p of pages) {
  test(`${p.name} renders`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon|hydrat|Failed to fetch|net::ERR|404/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: p.level, name: p.heading })).toBeVisible();
    await page.locator(p.wait).first().waitFor({ timeout: 55_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/screenshots/${p.name}-${testInfo.project.name}.png`, fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("landing hero shows the live demo ledger or an honest fallback", async ({ page }) => {
  await page.goto("/");
  await page.locator("table.table").first().waitFor({ timeout: 40_000 });
  const badge = page.locator(".badge", { hasText: /live from chain|chain not reachable/ }).first();
  await expect(badge).toBeVisible();
});

test("assets directory opens an asset with a chart and its wrappers", async ({ page, request }) => {
  const probe = (await (await request.get("/api/tokens/curated?list=stocks&limit=1")).json()) as { configured?: boolean };
  test.skip(probe.configured === false, "tokens.xyz not configured on this machine");
  await page.goto("/assets");
  await page.locator(".asset-card").first().waitFor({ timeout: 40_000 });
  await page.getByRole("tab", { name: /Pre-IPO/ }).click();
  await page.locator("table.table tbody tr").first().waitFor({ timeout: 40_000 });
  await expect(page.locator(".badge", { hasText: /Tessera|PreStocks/ }).first()).toBeVisible();
  await page.goto("/assets/apple");
  await page.locator(".chart svg").waitFor({ timeout: 40_000 });
  await expect(page.locator("table.table tbody tr").first()).toBeVisible();
  await page.getByRole("tab", { name: "1W" }).click();
  await page.locator(".chart svg").waitFor({ timeout: 40_000 });
});

test("record page for the latest action shows the certificate and a download", async ({ page, request }) => {
  const list = (await (await request.get("/api/actions")).json()) as { actions: { id: string; snapshot?: unknown }[] };
  const action = list.actions.find((a) => a.snapshot);
  test.skip(!action, "no snapshotted action on this machine");
  await page.goto(`/actions/${action!.id}`);
  await expect(page.locator(".proof").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Download entitlements.json/ })).toBeVisible();
});

test("cluster endpoint names the program and the cluster", async ({ request }) => {
  const j = (await (await request.get("/api/cluster")).json()) as { cluster: string; programId: string };
  expect(["fork", "devnet"]).toContain(j.cluster);
  expect(j.programId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});
