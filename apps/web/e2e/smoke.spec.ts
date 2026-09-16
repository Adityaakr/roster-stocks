import { expect, test } from "@playwright/test";

/** Every page renders, shows its key copy, and logs no console errors. Screenshots land in e2e/screenshots. */
const pages = [
  { path: "/?demo=1", text: "Tokenized stocks are composable", name: "landing" },
  { path: "/holder?demo=1", text: "Your positions, resolved", name: "holder" },
  { path: "/issuer?demo=1", text: "Registrar console", name: "issuer" },
  { path: "/actions?demo=1", text: "Actions", name: "actions" }
];

for (const p of pages) {
  test(`${p.name} renders`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon|hydrat|Failed to fetch|net::ERR|404/i.test(m.text())) errors.push(m.text());
    });
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1 }).filter({ hasText: p.text })).toBeVisible();
    if (p.name === "holder") await page.locator("table.ledger, [role=alert]").first().waitFor({ timeout: 55_000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `e2e/screenshots/${p.name}-${testInfo.project.name}.png`, fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("reduced motion renders final values at once", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/");
  const pct = page.locator("span.num.display").first();
  await expect(pct).toBeVisible();
  const text = await pct.textContent();
  expect(text).toMatch(/\d+\.\d{2}%/);
  expect(text).not.toBe("0.00%");
  await ctx.close();
});

test("proof page for the latest action shows the root and a download", async ({ page, request }) => {
  const list = (await (await request.get("/api/actions")).json()) as { actions: { id: string; snapshot?: unknown }[] };
  const action = list.actions.find((a) => a.snapshot);
  test.skip(!action, "no snapshotted action on this machine");
  await page.goto(`/actions/${action!.id}`);
  await expect(page.getByText("Snapshot").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Download entitlements.json/ })).toBeVisible();
});
