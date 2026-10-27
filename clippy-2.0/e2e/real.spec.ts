import { expect, test } from "@playwright/test";

// Real API calls (Claude + Tavily). Run once, on desktop only, to keep cost down.
test.describe("@real", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "real tests run on desktop only");
  });

  const finished = (page: import("@playwright/test").Page) =>
    page.locator('[data-testid="results"], [data-testid="error"]').first();

  test("typed list gives results or a friendly error in under 75 s", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("list-input").fill("1000 12 oz paper hot cups");
    await page.getByTestId("submit-btn").click();
    await expect(page.getByTestId("progress")).toBeVisible();
    await expect(finished(page)).toBeVisible({ timeout: 75_000 });
    const text = await page.locator("body").innerText();
    for (const bad of ["NaN", "undefined", "$-0.00"]) expect(text).not.toContain(bad);
    await page.screenshot({ path: "e2e/screenshots/real-list.png", fullPage: true });
  });

  test("cafe invoice gives 5 items and savings above $0", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("upload-input").setInputFiles("samples/invoice-cafe.png");
    await page.getByTestId("submit-btn").click();
    await expect(page.getByTestId("results")).toBeVisible({ timeout: 85_000 });
    await expect(page.locator('[data-testid="item-row"]:visible')).toHaveCount(5);
    const total = (await page.getByTestId("total-month").innerText()).match(/\$([\d,]+\.\d{2})/);
    expect(total, "total-month shows a dollar amount").not.toBeNull();
    expect(Number(total![1].replace(/,/g, ""))).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/screenshots/real-invoice.png", fullPage: true });
  });

  test("a photo that is not an invoice shows the error card", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("upload-input").setInputFiles("samples/not-an-invoice.png");
    await page.getByTestId("submit-btn").click();
    await expect(page.getByTestId("error")).toBeVisible({ timeout: 75_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
