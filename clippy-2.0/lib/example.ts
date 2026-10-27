import fs from "node:fs";
import path from "node:path";
import type { AnalysisResult } from "@/lib/types";

// Read the saved real run at build time. No file, no "See a real example" button.
export function loadExample(): AnalysisResult | null {
  try {
    const file = path.join(process.cwd(), "fixtures", "real-run.json");
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as AnalysisResult;
    return Array.isArray(data.items) && data.items.length > 0 ? data : null;
  } catch {
    return null;
  }
}
