import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
});

test("submit is disabled without input", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Find cheaper supplies in seconds." })).toBeVisible();
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
  await page.getByTestId("list-input").fill("50 lb bread flour");
  await expect(page.getByTestId("submit-btn")).toBeEnabled();
  await page.getByTestId("list-input").fill("   ");
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
});

test("orders per month defaults to 4 and must be 1 to 30", async ({ page }) => {
  await expect(page.getByTestId("orders-input")).toHaveValue("4");
  await page.getByTestId("list-input").fill("50 lb bread flour");
  await page.getByTestId("orders-input").fill("31");
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
  await page.getByTestId("orders-input").fill("12");
  await expect(page.getByTestId("submit-btn")).toBeEnabled();
});

test("a 6 MB photo shows an error", async ({ page }) => {
  await page.getByTestId("upload-input").setInputFiles({
    name: "big.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024, 1),
  });
  await expect(page.getByTestId("error")).toContainText("5 MB");
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
});

test("a small photo shows a preview and can be removed", async ({ page }) => {
  await page.getByTestId("upload-input").setInputFiles("samples/invoice-cafe.png");
  await expect(page.getByAltText("Invoice preview")).toBeVisible();
  await expect(page.getByTestId("submit-btn")).toBeEnabled();
  await page.screenshot({ path: `e2e/screenshots/input-preview-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
});

test("input screen screenshot", async ({ page }) => {
  await page.getByTestId("list-input").fill("50 lb bread flour\n1000 12 oz paper hot cups");
  await page.screenshot({ path: `e2e/screenshots/input-${test.info().project.name}.png`, fullPage: true });
});
