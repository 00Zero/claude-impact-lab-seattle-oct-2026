import { expect, test } from "@playwright/test";
import type { AnalysisResult } from "../lib/types";

// Hand-made result for this test only. The real app never shows invented data.
const RESULT: AnalysisResult = {
  items: [],
  totalSavingsPerOrder: 0,
  totalSavingsPerMonth: 0,
  totalSavingsPerYear: 0,
  ordersPerMonth: 4,
  suggestions: [],
  generatedAt: "2026-10-25T18:00:00.000Z",
};

test("past searches show in History and survive a reload", async ({ page }) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify({ type: "result", data: RESULT }) + "\n" }),
  );
  await page.goto("/app");
  await page.getByTestId("list-input").fill("50 lb bread flour");
  await page.getByTestId("submit-btn").click();
  await expect(page.getByTestId("results")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  const item = page.getByTestId("history-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("50 lb bread flour");

  await item.click();
  await expect(page.getByTestId("results")).toBeVisible();

  await page.getByRole("button", { name: "Savings Dashboard", exact: true }).click();
  await expect(page.getByTestId("dashboard")).toBeVisible();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Delete 50 lb bread flour" }).click();
  await expect(page.getByTestId("history-item")).toHaveCount(0);
});
