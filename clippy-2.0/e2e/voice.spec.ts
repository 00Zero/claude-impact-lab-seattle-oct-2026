import { expect, test } from "@playwright/test";

// Chromium's fake mic: no permission prompt, a test tone instead of a real voice.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

test("speaking fills the shopping list", async ({ page }) => {
  await page.route("**/api/transcribe", (route) => route.fulfill({ status: 200, json: { text: "50 lb bread flour" } }));
  await page.goto("/app");
  await page.getByTestId("list-input").fill("1000 12 oz paper hot cups");

  await page.getByTestId("mic-btn").click();
  await expect(page.getByTestId("mic-btn")).toContainText("Stop");
  await page.waitForTimeout(1200);
  await page.getByTestId("mic-btn").click();

  await expect(page.getByTestId("list-input")).toHaveValue("1000 12 oz paper hot cups\n50 lb bread flour");
  await expect(page.getByTestId("mic-btn")).toContainText("Speak your list");
  await expect(page.getByTestId("submit-btn")).toBeEnabled();
});

test("a transcribe error is shown next to the mic", async ({ page }) => {
  await page.route("**/api/transcribe", (route) =>
    route.fulfill({ status: 503, json: { error: "Voice input is not set up yet. Type your list instead." } }),
  );
  await page.goto("/app");
  await page.getByTestId("mic-btn").click();
  await page.waitForTimeout(600);
  await page.getByTestId("mic-btn").click();
  await expect(page.getByTestId("mic-error")).toContainText("not set up");
  await expect(page.getByTestId("list-input")).toHaveValue("");
});
