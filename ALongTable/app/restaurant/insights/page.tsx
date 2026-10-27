import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@phosphor-icons/react/ssr";
import { NextMoveCard } from "@/components/dashboard/next-move-card";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { ForecastChart } from "@/components/insights/forecast-chart";
import { ButtonLink } from "@/components/ui/button";
import { SeatRow } from "@/components/ui/seat-row";
import { computeInsights, getInsightsInput, hasEnoughHistory, sampleInsights, SAMPLE_NEXT_MOVE } from "@/lib/insights";
import { nextMove } from "@/lib/next-move";
import { getCurrentRestaurant } from "@/lib/session";

export const metadata: Metadata = { title: "Insights · ALongTable" };

// A preview of future insights. Sentences are code templates filled from the
// numbers (no AI on this page), and the page shows either the restaurant's real
// numbers or the labelled sample, never a mix.

export default function InsightsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="alt-secondary">Loading your insights…</p>}>
        <Insights />
      </Suspense>
    </main>
  );
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

async function Insights() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/restaurant/signup");
  await connection(); // weeks and "days out" depend on today's date, so render per request

  const now = new Date();
  const input = await getInsightsInput(restaurant.id);
  const real = computeInsights(input, now);
  const isSample = !hasEnoughHistory(real);
  const i = isSample ? sampleInsights(now) : real;
  const move = isSample ? SAMPLE_NEXT_MOVE : nextMove(input.spaces, now, Boolean(restaurant.photoUrl));

  const expected = i.forecast.map((f) => f.expected);
  const [eLo, eHi] = [Math.min(...expected), Math.max(...expected)];
  const low = Math.min(...i.forecast.map((f) => f.low));
  const high = Math.max(...i.forecast.map((f) => f.high));
  const lateMatchesFilling = i.filling && i.lateWeekday === i.filling.weekday;

  const seeing = [
    i.bestWeekday && `${i.bestWeekday.name}s fill first: ${pct(i.bestWeekday.fillRate)} average fill across ${plural(i.bestWeekday.events, "event", "events")}.`,
    i.lateWeekday && `${i.lateWeekday}s fill late: most bookings arrive in the last 3 days.`,
    i.repeatGuests > 0 && `Guests are coming back: ${i.repeatGuests} of ${i.distinctGuests} booked a second table.`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-8">
      {isSample && (
        <p role="status" className="alt-notice alt-notice--info">
          <Info size={24} aria-hidden="true" className="alt-icon" />
          Sample data. This is what insights will look like. Yours appear after 8 events; you&apos;ve hosted {real.events}.
        </p>
      )}

      <header className="flex flex-col gap-2">
        <p className="alt-label-text alt-secondary">{restaurant.name} · Last 8 weeks</p>
        {/* Not AI: every number and sentence here is worked out from bookings, so no ALong AI tag. */}
        <h1 className="alt-display">{i.bestWeekday ? `Your ${i.bestWeekday.name}s are filling` : "How your tables are doing"}</h1>
        <p className="alt-lead alt-secondary">Here&apos;s what happened, and what we&apos;d do next.</p>
        <span className="alt-chip mt-1 self-start">Calculated from your bookings, no AI</span>
      </header>

      {(move || i.filling) && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <NextMoveCard move={move} className="lg:flex-[2]" />
          {i.filling && (
            <section className="alt-card flex flex-col items-start gap-3 lg:flex-1" aria-labelledby="filling-title">
              <span className="alt-chip alt-chip--filling">Filling up</span>
              <h2 id="filling-title" className="alt-title">
                {i.filling.weekday}, {i.filling.date} · {i.filling.daysOut === 1 ? "tomorrow" : `${i.filling.daysOut} days out`}
              </h2>
              <SeatRow total={i.filling.capacity} taken={i.filling.taken} count={false} />
              <p className="alt-secondary">
                {i.filling.taken} of {i.filling.capacity} seats booked.
                {lateMatchesFilling && ` Most ${i.lateWeekday} bookings arrive in the last 3 days.`}
              </p>
            </section>
          )}
        </div>
      )}

      <StatTiles
        items={[
          {
            label: "Booked sales (est.)",
            value: i.sales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
            note: "Guests booked × price per person",
          },
          { label: "Guests booked", value: i.guests.toLocaleString("en-US"), note: `Across ${plural(i.events, "event", "events")}` },
          { label: "Average fill", value: pct(i.fillRate), note: `Of ${i.seatsOffered.toLocaleString("en-US")} seats offered` },
          {
            label: "Guests who came back",
            value: pct(i.distinctGuests ? i.repeatGuests / i.distinctGuests : 0),
            note: `${i.repeatGuests} of ${i.distinctGuests} booked a second table`,
          },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="alt-card flex min-w-0 flex-col gap-1 lg:flex-[3]">
          <h2 className="alt-title">Seats booked per week</h2>
          <p className="alt-secondary">Last 8 weeks, with a forecast for the next 4</p>
          <p className="mt-3 font-semibold">
            About {eLo === eHi ? eLo : `${eLo}–${eHi}`} seats a week, likely between {low} and {high}.
          </p>
          <div className="mt-3">
            <ForecastChart weeks={i.weeks} forecast={i.forecast} />
          </div>
          <p className="alt-help mt-3">Based on {plural(i.events, "event", "events")}. The range narrows as you host more.</p>
        </section>

        {seeing.length > 0 && (
          <section className="alt-card flex min-w-0 flex-col gap-2 lg:flex-[2]">
            <h2 className="alt-title">What we&apos;re seeing</h2>
            <ul className="alt-list">
              {seeing.slice(0, 3).map((line) => (
                <li key={line} className="alt-row">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ButtonLink href="/restaurant" variant="quiet" className="self-start !px-0">
        ← Back to dashboard
      </ButtonLink>
    </div>
  );
}
