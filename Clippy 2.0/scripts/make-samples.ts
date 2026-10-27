import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SAMPLES = ["invoice-cafe", "not-an-invoice"];

async function main() {
  const dir = path.join(process.cwd(), "samples");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  for (const name of SAMPLES) {
    await page.goto(pathToFileURL(path.join(dir, `${name}.html`)).href);
    const out = path.join(dir, `${name}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`wrote ${out}`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
