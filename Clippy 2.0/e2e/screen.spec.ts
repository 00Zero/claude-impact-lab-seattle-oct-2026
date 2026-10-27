import { expect, test } from "@playwright/test";

// Stand in for the browser's screen picker: "share" a canvas painted like a page.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;
      setInterval(() => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = "#000";
        ctx.font = "40px sans-serif";
        ctx.fillText("Bread flour 50 lb $72", 40, 100);
      }, 50);
      return canvas.captureStream(10);
    };
  });
});

test("capturing the screen attaches it as the invoice photo", async ({ page }) => {
  await page.goto("/app");
  await page.getByTestId("screen-btn").click();
  await expect(page.getByAltText("Invoice preview")).toBeVisible();
  await expect(page.getByText(/^screen-\d+\.jpg$/)).toBeVisible();
  await expect(page.getByTestId("submit-btn")).toBeEnabled();
});
