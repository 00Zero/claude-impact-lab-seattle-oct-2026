// Normalizes data/funeral_homes.json (the pre-compiled WA-state dataset) into
// the funeral_homes table's actual columns and upserts it. Safe to re-run:
// rows are matched on `source_id` (the dataset's own stable `id`), so a
// repeat run updates in place instead of creating duplicates.
//
// Usage: npm run load-funeral-homes
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (service role is
// required because funeral_homes has no client-side insert/update policy).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  let contents: string;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env) && value) process.env[key] = value;
  }
}

loadEnv();

interface SourcePricing {
  direct_cremation_pkg?: number | null;
  full_service_cremation?: number | null;
  immediate_burial_pkg?: number | null;
  traditional_burial_pkg?: number | null;
  price_range_low?: number | null;
}

interface SourceRecord {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  phone: string | null;
  service_types: string[];
  pricing: SourcePricing | null;
  google_rating: number | null;
  yelp_rating: number | null;
}

interface FuneralHomeRow {
  source_id: number;
  name: string;
  address: string;
  county: string;
  zip: string;
  phone: string | null;
  cremation_capable: boolean;
  burial_capable: boolean;
  price_cremation: number | null;
  price_burial: number | null;
  rating: number | null;
}

function normalize(record: SourceRecord): FuneralHomeRow | null {
  if (!record.name || !record.county) return null;

  const serviceTypes = record.service_types ?? [];
  const cremationCapable = serviceTypes.includes("cremation");
  const burialCapable = serviceTypes.includes("burial");
  if (!cremationCapable && !burialCapable) return null;

  const pricing = record.pricing ?? {};

  return {
    source_id: record.id,
    name: record.name,
    address: `${record.street}, ${record.city}, ${record.state}`,
    county: record.county,
    zip: record.zip,
    phone: record.phone ?? null,
    cremation_capable: cremationCapable,
    burial_capable: burialCapable,
    price_cremation:
      pricing.direct_cremation_pkg ??
      pricing.full_service_cremation ??
      pricing.price_range_low ??
      null,
    price_burial:
      pricing.immediate_burial_pkg ??
      pricing.traditional_burial_pkg ??
      pricing.price_range_low ??
      null,
    rating: record.google_rating ?? record.yelp_rating ?? null,
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Fill these in .env (service-role secrets, never committed) before running this script.",
    );
    process.exit(1);
  }

  const sourcePath = path.resolve(__dirname, "..", "data", "funeral_homes.json");
  const source: SourceRecord[] = JSON.parse(readFileSync(sourcePath, "utf8"));

  const rows: FuneralHomeRow[] = [];
  let skipped = 0;
  for (const record of source) {
    const row = normalize(record);
    if (row) rows.push(row);
    else skipped++;
  }

  if (skipped > 0) {
    console.warn(`Skipped ${skipped} source row(s) missing name/county or any disposition capability.`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const batchSize = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("funeral_homes")
      .upsert(batch, { onConflict: "source_id" });
    if (error) {
      console.error(`Upsert failed on batch starting at row ${i}:`, error);
      process.exit(1);
    }
    upserted += batch.length;
  }

  console.log(`Upserted ${upserted} funeral home(s) from ${source.length} source row(s) (${skipped} skipped).`);
}

main();
