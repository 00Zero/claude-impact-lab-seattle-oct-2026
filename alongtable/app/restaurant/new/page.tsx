import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentRestaurant } from "@/lib/session";
import { AREAS, CAPACITIES, FEATURES, PRICES, SLOTS } from "@/lib/space-options";
import { upcomingDays } from "@/lib/time";
import { PublishForm, type SpaceDraft } from "./publish-form";

export const metadata: Metadata = { title: "Publish a space · ALongTable" };

export default function NewSpacePage({ searchParams }: PageProps<"/restaurant/new">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="alt-secondary">Loading…</p>}>
        {searchParams.then((query) => (
          <Content query={query} />
        ))}
      </Suspense>
    </main>
  );
}

type Query = Record<string, string | string[] | undefined>;

/** Preselect tiles from the URL (the AI setup's "Edit first" links). Unknown values are ignored. */
function draftFromQuery(query: Query, dayValues: string[]): SpaceDraft {
  const one = (k: string) => (Array.isArray(query[k]) ? query[k][0] : query[k]);
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => allowed.find((a) => a === v);
  const all = query.features === undefined ? [] : Array.isArray(query.features) ? query.features : [query.features];
  return {
    area: pick(one("area"), AREAS),
    date: pick(one("date"), dayValues),
    slot: pick(one("slot"), SLOTS.map((s) => s.value)),
    capacity: pick(one("capacity"), CAPACITIES.map(String)),
    price: pick(one("price"), PRICES.map((p) => p.value)),
    features: all.filter((f) => (FEATURES as readonly string[]).includes(f)),
  };
}

async function Content({ query }: { query: Query }) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/restaurant/signup");
  await connection(); // the day tiles depend on today's date, so render per request
  const days = upcomingDays(14);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="alt-h2">Publish a space</h1>
        <p className="alt-lead alt-secondary">
          Publishing as <span className="font-semibold text-ink">{restaurant.name}</span>, {restaurant.location}.
        </p>
      </header>
      <div className="alt-card !p-6 sm:!p-8">
        <PublishForm days={days} draft={draftFromQuery(query, days.map((d) => d.value))} />
      </div>
    </div>
  );
}
