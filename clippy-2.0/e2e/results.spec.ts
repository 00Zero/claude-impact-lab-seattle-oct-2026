import { expect, test, type Page } from "@playwright/test";
import type { AnalysisResult, ProgressEvent } from "../lib/types";

// Hand-made result for this test only. The real app never shows invented data.
const RESULT: AnalysisResult = {
  items: [
    {
      item: { id: "a", name: "12 oz paper hot cups", searchQuery: "12 oz paper hot cups 1000", packSize: 1000, unit: "each", qtyPerOrder: 2, pricePaid: 110 },
      best: { itemId: "a", store: "Test Store A", title: "Hot cups 1000 ct", url: "https://example.com/cups", price: 60, packSize: 1000, unit: "each", shipping: 5, confidence: "high", checkedAt: "2026-10-25T18:00:00.000Z", unitCost: 0.065, baseUnit: "each" },
      offers: [
        { itemId: "a", store: "Test Store A", title: "Hot cups 1000 ct", url: "https://example.com/cups", price: 60, packSize: 1000, unit: "each", shipping: 5, confidence: "high", checkedAt: "2026-10-25T18:00:00.000Z", unitCost: 0.065, baseUnit: "each" },
        { itemId: "a", store: "Test Store B", title: "Hot cups 1000 pack", url: "https://example.org/cups", price: 80, packSize: 1000, unit: "each", shipping: null, confidence: "medium", checkedAt: "2026-10-25T18:00:00.000Z", unitCost: 0.08, baseUnit: "each" },
      ],
      currentUnitCost: 0.11,
      savingsPerOrder: 90,
    },
    {
      item: { id: "b", name: "Bread flour", searchQuery: "bread flour 50 lb", packSize: 50, unit: "lb", qtyPerOrder: 1, pricePaid: 40 },
      best: { itemId: "b", store: "Test Store C", title: "Bread flour 50 lb", url: "https://example.com/flour", price: 41, packSize: 50, unit: "lb", shipping: 0, confidence: "high", checkedAt: "2026-10-25T18:00:00.000Z", unitCost: 0.82, baseUnit: "lb" },
      offers: [],
      currentUnitCost: 0.8,
      savingsPerOrder: 0,
    },
    {
      item: { id: "c", name: "Whole milk", searchQuery: "whole milk gallon", packSize: 1, unit: "gal", qtyPerOrder: 6 },
      best: null,
      offers: [],
      currentUnitCost: null,
      savingsPerOrder: null,
    },
  ],
  totalSavingsPerOrder: 90,
  totalSavingsPerMonth: 360,
  totalSavingsPerYear: 4320,
  ordersPerMonth: 4,
  suggestions: ["Buy your hot cups at Test Store A and save $90.00 per order."],
  generatedAt: "2026-10-25T18:00:00.000Z",
  notice: "Some items had no reliable price.",
};

async function mockApi(page: Page, events: ProgressEvent[], delayMs = 0) {
  await page.route("**/api/analyze", async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    });
  });
}

async function submitList(page: Page) {
  await page.goto("/app");
  await page.getByTestId("list-input").fill("1000 12 oz paper hot cups");
  await page.getByTestId("submit-btn").click();
}

test("results render with clean money and valid links", async ({ page }) => {
  await mockApi(page, [
    { type: "progress", message: "Reading your list" },
    { type: "progress", message: "Checking stores" },
    { type: "result", data: RESULT },
  ]);
  await submitList(page);

  const results = page.getByTestId("results");
  await expect(results).toBeVisible();
  await expect(page.getByTestId("total-month")).toHaveText("Save $360.00 per month");
  await expect(results).toContainText("$4,320.00 per year");
  await expect(results).toContainText("Some items had no reliable price.");
  await expect(results).toContainText("Buy your hot cups at Test Store A");

  const rows = page.locator('[data-testid="item-row"]:visible');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("per cup");
  await expect(rows.nth(1)).toContainText("per lb");
  await expect(rows.nth(2)).toContainText("No reliable price found.");

  const text = await page.locator("body").innerText();
  for (const bad of ["NaN", "undefined", "$-0.00", "-$0.00", "null"]) expect(text).not.toContain(bad);

  const links = page.locator('a:visible', { hasText: "Buy" });
  expect(await links.count()).toBeGreaterThan(0);
  for (const link of await links.all()) {
    expect(await link.getAttribute("href")).toMatch(/^https?:\/\//);
    expect(await link.getAttribute("target")).toBe("_blank");
    expect(await link.getAttribute("rel")).toContain("noopener");
  }

  await page.waitForTimeout(700); // let the page settle
  await page.screenshot({ path: `e2e/screenshots/results-top-${test.info().project.name}.png` });
  await rows.nth(0).getByRole("button", { name: /See other offers/ }).click();
  await expect(rows.nth(0)).toContainText("Test Store B");

  await page.screenshot({ path: `e2e/screenshots/results-${test.info().project.name}.png`, fullPage: true });

  await page.getByTestId("restart-btn").click();
  await expect(page.getByTestId("submit-btn")).toBeVisible();
});

test("no savings shows the good prices message", async ({ page }) => {
  await mockApi(page, [{ type: "result", data: { ...RESULT, totalSavingsPerOrder: 0, totalSavingsPerMonth: 0, totalSavingsPerYear: 0, notice: undefined } }]);
  await submitList(page);
  await expect(page.getByTestId("total-month")).toHaveText("You already pay good prices");
});

test("no prices given shows the best prices headline", async ({ page }) => {
  const items = RESULT.items.map((r) => ({ ...r, currentUnitCost: null, savingsPerOrder: null }));
  await mockApi(page, [{ type: "result", data: { ...RESULT, items, totalSavingsPerOrder: 0, totalSavingsPerMonth: 0, totalSavingsPerYear: 0 } }]);
  await submitList(page);
  await expect(page.getByTestId("total-month")).toHaveText("Here are the best prices Clippy found");
});

test("progress steps appear", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: "" });
  });
  await submitList(page);
  await expect(page.getByTestId("progress")).toBeVisible();
  await page.screenshot({ path: `e2e/screenshots/progress-${test.info().project.name}.png` });
  await expect(page.getByTestId("error")).toBeVisible({ timeout: 10_000 });
});

test("error event shows the error card with Try again", async ({ page }) => {
  await mockApi(page, [{ type: "progress", message: "Reading your photo" }, { type: "error", message: "That photo does not look like an invoice." }]);
  await submitList(page);
  await expect(page.getByTestId("error")).toContainText("does not look like an invoice");
  await page.screenshot({ path: `e2e/screenshots/error-${test.info().project.name}.png` });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Change my input" }).click();
  await expect(page.getByTestId("list-input")).toHaveValue("1000 12 oz paper hot cups");
});

test("400 response shows its message", async ({ page }) => {
  await page.route("**/api/analyze", (route) => route.fulfill({ status: 400, json: { error: "The photo is too large. Use one under 5 MB." } }));
  await submitList(page);
  await expect(page.getByTestId("error")).toContainText("too large");
});

test("real example loads with its label", async ({ page }) => {
  await page.goto("/app");
  const btn = page.getByTestId("example-btn");
  test.skip((await btn.count()) === 0, "no fixtures/real-run.json");
  await btn.click();
  await expect(page.getByTestId("results")).toContainText("Saved real result from");
  await expect(page.getByTestId("results")).toContainText("Prices may have changed.");
  const text = await page.locator("body").innerText();
  for (const bad of ["NaN", "undefined", "$-0.00"]) expect(text).not.toContain(bad);
  await page.screenshot({ path: `e2e/screenshots/example-${test.info().project.name}.png`, fullPage: true });
});

test("adding what you pay turns on savings on the comparison and the dashboard", async ({ page }) => {
  const items = RESULT.items.map((r) => ({ ...r, item: { ...r.item, pricePaid: undefined }, currentUnitCost: null, savingsPerOrder: null }));
  await mockApi(page, [{ type: "result", data: { ...RESULT, items, totalSavingsPerOrder: 0, totalSavingsPerMonth: 0, totalSavingsPerYear: 0 } }]);
  await submitList(page);
  await expect(page.getByTestId("total-month")).toHaveText("Here are the best prices Clippy found");

  await page.getByRole("button", { name: "Savings Dashboard", exact: true }).click();
  await expect(page.getByTestId("no-savings-yet")).toBeVisible();
  await page.getByTestId("no-savings-yet").getByRole("button", { name: "Add what you pay" }).click();

  // Cups: paid $110 per 1000, best $65 landed per 1000, 2 cases per order → $90 per order, 4 orders a month.
  const cups = page.locator('[data-testid="item-row"]:visible').filter({ hasText: "12 oz paper hot cups" });
  await cups.getByTestId("add-price-btn").click();
  await cups.getByTestId("price-paid-input").fill("110");
  await cups.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("total-month")).toHaveText("Save $360.00 per month");
  await expect(cups).toContainText("$0.11 per cup");

  await page.getByRole("button", { name: "Savings Dashboard", exact: true }).click();
  await expect(page.getByTestId("dashboard")).toContainText("$90.00");
  await expect(page.getByTestId("dashboard")).toContainText("$4,320.00");
  await expect(page.getByTestId("dashboard")).toContainText("1 item has a store price but no price from you");
});

test("the location is sent with the list and remembered", async ({ page }) => {
  let sent: string | null = null;
  await page.route("**/api/analyze", async (route) => {
    sent = route.request().postDataBuffer()?.toString() ?? "";
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify({ type: "result", data: RESULT }) + "\n" });
  });
  await page.goto("/app");
  await page.getByTestId("location-input").fill("Austin, TX");
  await page.getByTestId("list-input").fill("1000 12 oz paper hot cups");
  await page.getByTestId("submit-btn").click();
  await expect.poll(() => sent).toContain("Austin, TX");
  await page.reload();
  await expect(page.getByTestId("location-input")).toHaveValue("Austin, TX");
});
