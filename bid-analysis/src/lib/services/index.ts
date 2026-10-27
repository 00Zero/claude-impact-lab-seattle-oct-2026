import { createFixtureServices } from "./fixtureServices";
import { createHttpServices } from "./httpServices";
import { createSupabaseCatalogLoader } from "./supabaseCatalog";
import type { ExplorerServices } from "./types";

export type { ExplorerServices } from "./types";

/**
 * NEXT_PUBLIC_DATA_MODE picks the backend:
 * - "live": workstream C's /api/v1 routes for everything.
 * - "hybrid": real open listings read from Supabase with the publishable key;
 *   accounts, profile reading and matching stay simulated and labeled.
 * - anything else: the isolated development fixtures and simulators.
 */
export function createServices(
  mode = process.env.NEXT_PUBLIC_DATA_MODE,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
): ExplorerServices {
  if (mode === "live") return createHttpServices(baseUrl);
  if (mode === "hybrid" && supabaseUrl && supabaseKey) return createFixtureServices({ mode: "live", load: createSupabaseCatalogLoader(supabaseUrl, supabaseKey) });
  return createFixtureServices();
}
