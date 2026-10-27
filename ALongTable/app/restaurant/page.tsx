import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarBlank, CheckCircle, Clock, MapPin, Plus, Trash } from "@phosphor-icons/react/ssr";
import { Calendar } from "@/components/dashboard/calendar";
import { GuestsChart } from "@/components/dashboard/guests-chart";
import { ConfirmDelete } from "@/components/dashboard/confirm-delete";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { NextMoveCard } from "@/components/dashboard/next-move-card";
import { SpacesFilter } from "@/components/dashboard/spaces-filter";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeatRow } from "@/components/ui/seat-row";
import { isFilling, nextMove } from "@/lib/next-move";
import { getCurrentRestaurant } from "@/lib/session";
import { listSpaces, type Space } from "@/lib/spaces";
import { statsByDay, summarize } from "@/lib/stats";
import { formatDate, formatTimeRange, seattleDateKey, upcomingDays } from "@/lib/time";
import { cancelEventAction, deleteSpaceAction } from "./delete-actions";
import { simulateBookingAction, simulateReservationAction } from "./demo-actions";
import { uploadEventPhoto, uploadRestaurantPhoto } from "./photo-actions";

const DEMO = process.env.NODE_ENV === "development";

export const metadata: Metadata = { title: "My spaces · ALongTable" };

type Params = Promise<{ published?: string; registered?: string; month?: string }>;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export default function RestaurantPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="alt-secondary">Loading your spaces…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Mint = booked, apricot = filling up (three quarters full or more), sunken = still open. */
function statusChip(s: Space) {
  if (!s.event) return <Badge tone="neutral">Open</Badge>;
  if (s.event.seatsTaken >= s.event.capacity) return <Badge tone="booked">Full</Badge>;
  if (isFilling(s)) return <Badge tone="filling">Filling up</Badge>;
  return <Badge tone="booked">Booked</Badge>;
}

/** Signed out: what ALongTable does for a restaurant, with an example of what hosts see. */
function OwnerWelcome() {
  return (
    <div className="flex flex-col items-center gap-12 lg:flex-row lg:py-8">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-5">
        <span className="alt-chip alt-chip--booked">For restaurants</span>
        <h1 className="alt-display">Turn your empty tables into full ones.</h1>
        <p className="alt-lead alt-secondary">
          Publish the seats you want to fill. Hosts book them and bring the guests. No setup cost.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/restaurant/signup">List your space</ButtonLink>
          <ButtonLink href="/restaurant/signup" variant="quiet" className="!px-0 sm:!px-3">
            Already registered? Sign in
          </ButtonLink>
        </div>
      </div>

      <article className="alt-card flex w-full max-w-md flex-col gap-4 !p-6 sm:!p-8" aria-label="Example of what hosts will see">
        <span className="alt-chip alt-chip--info self-start">What hosts will see, for example</span>
        <div className="flex flex-col gap-1">
          <h2 className="alt-title">Your restaurant</h2>
          <p className="alt-meta">
            <MapPin size={20} aria-hidden="true" />
            Your neighborhood · Tue · 6–9 PM
          </p>
        </div>
        <SeatRow total={10} taken={6} pop />
      </article>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: Params }) {
  const [{ published, registered, month: monthParam }, restaurant] = await Promise.all([
    searchParams,
    getCurrentRestaurant(),
  ]);

  if (!restaurant) return <OwnerWelcome />;

  await connection(); // the chart and calendar depend on today's date, so render per request
  const spaces = await listSpaces(restaurant.id);
  const summary = summarize(spaces);
  const stats = statsByDay(spaces);
  const todayKey = seattleDateKey(new Date());
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : todayKey.slice(0, 7);
  const chartDays = upcomingDays(14).map((d) => ({
    key: d.value,
    label: d.label,
    weekday: d.weekday,
    guests: stats[d.value]?.guests ?? 0,
    events: stats[d.value]?.events ?? 0,
    seats: stats[d.value]?.seats ?? 0,
    spaces: stats[d.value]?.spaces ?? 0,
  }));

  // Answer first: the one fact the owner came for, in big type.
  const answer =
    spaces.length === 0
      ? "No spaces yet"
      : summary.events === 0
        ? "No events booked yet"
        : `${plural(summary.events, "event", "events")} booked`;
  const detail =
    spaces.length === 0
      ? "Publish your first table and guests can start booking it."
      : `${plural(summary.guests, "guest", "guests")} booked · ${plural(summary.available, "space", "spaces")} still open`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="alt-label-text alt-secondary">
            {restaurant.name} · {restaurant.location}
          </p>
          <h1 className="alt-display">{answer}</h1>
          <p className="alt-lead alt-secondary">{detail}</p>
        </div>
        <div className="flex items-center gap-2">
          {spaces.length > 0 && (
            <ButtonLink href="/restaurant/insights" variant="quiet">
              See insights
            </ButtonLink>
          )}
          <ButtonLink href="/restaurant/new">
            <Plus size={20} aria-hidden="true" />
            Publish a space
          </ButtonLink>
        </div>
      </header>

      {/* ImageUpload takes no id, so the wrapper is the "Add a photo" next move's target. */}
      <div id="restaurant-photo" className="scroll-mt-4">
        <ImageUpload
          action={uploadRestaurantPhoto}
          photoUrl={restaurant.photoUrl}
          alt={`Inside ${restaurant.name}`}
          addLabel="Add a photo"
          changeLabel="Change photo"
          guidance="Add a photo of your real space, like a table set for service. It shows on your event cards, so guests can picture the evening. Only upload photos you have the right to use."
        />
      </div>

      {registered && (
        <p role="status" className="alt-notice alt-notice--success">
          <CheckCircle size={24} aria-hidden="true" className="alt-icon" />
          {spaces.length > 0
            ? "You're set up. Hosts can book your spaces now, and bookings show up here."
            : "You're set up. Publish your first space below and guests can book it."}
        </p>
      )}
      {published && (
        <p role="status" className="alt-notice alt-notice--success">
          <CheckCircle size={24} aria-hidden="true" className="alt-icon" />
          Your space is live. Guests can book it now.
        </p>
      )}

      <NextMoveCard move={nextMove(spaces, new Date(), Boolean(restaurant.photoUrl))} />

      <StatTiles
        items={[
          {
            label: "Est. revenue",
            value: summary.revenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
            note: "Guests booked × price per person",
          },
          { label: "Guests booked", value: summary.guests.toLocaleString("en-US") },
          { label: "Events booked", value: summary.events.toLocaleString("en-US") },
          { label: "Spaces open", value: summary.available.toLocaleString("en-US") },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="alt-card flex flex-col">
          <h2 className="alt-title">Seats booked</h2>
          <p className="alt-secondary mb-4">Booked out of total seats, next 14 days</p>
          <GuestsChart days={chartDays} />
        </section>

        <section className="alt-card">
          <Calendar month={month} todayKey={todayKey} stats={stats} />
        </section>
      </div>

      {spaces.length === 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="alt-h2">My spaces</h2>
          <div className="alt-card flex flex-col items-start gap-3">
            <p className="alt-title">No spaces yet</p>
            <p className="alt-secondary">Publish your first table to get started.</p>
            <ButtonLink href="/restaurant/new">Publish a space</ButtonLink>
          </div>
        </section>
      ) : (
        <SpacesFilter
          items={spaces.map((s) => {
            const start = new Date(s.startsAt);
            const end = new Date(s.endsAt);
            const seats = s.event ?? { seatsTaken: 0, capacity: s.capacity };
            return {
              id: s.id,
              kind: s.event ? ("booked" as const) : ("open" as const),
              node: (
                <li key={s.id} className="alt-card flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="alt-title">{s.label}</h3>
                    {statusChip(s)}
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="alt-meta">
                      <CalendarBlank size={20} aria-hidden="true" />
                      <span className="text-ink">{formatDate(start)}</span>
                    </p>
                    <p className="alt-meta">
                      <Clock size={20} aria-hidden="true" />
                      <span className="text-ink tabular-nums">{formatTimeRange(start, end)}</span>
                    </p>
                    {(s.description || s.priceInfo) && (
                      <p className="alt-secondary">{[s.description, s.priceInfo].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>

                  {s.event && (
                    <>
                      <p>
                        <span className="font-semibold">{s.event.title}</span>
                        <span className="alt-secondary"> · organized by {s.event.organizerName}</span>
                      </p>
                      <ImageUpload
                        action={uploadEventPhoto}
                        hidden={{ name: "eventId", value: s.event.id }}
                        photoUrl={s.event.photoUrl}
                        alt={s.event.title}
                        addLabel="Add event photo"
                        changeLabel="Change event photo"
                        size="sm"
                      />
                    </>
                  )}
                  <SeatRow total={seats.capacity} taken={seats.seatsTaken} />

                  <div className="flex flex-wrap items-center gap-1 border-t border-divider pt-3">
                    {s.event && (
                      <ConfirmDelete
                        action={cancelEventAction}
                        hidden={{ name: "spaceId", value: s.id }}
                        trigger={<><Trash size={20} aria-hidden="true" />Cancel event</>}
                        title="Cancel this event?"
                        description={
                          <>
                            <p>
                              &ldquo;{s.event.title}&rdquo; will be removed
                              {s.event.seatsTaken > 0
                                ? `, and the ${plural(s.event.seatsTaken, "guest", "guests")} who reserved will lose their seats.`
                                : "."}{" "}
                              The space opens up again, so someone else can book it.
                            </p>
                            {s.event.seatsTaken > 0 && (
                              <p className="alt-secondary">We don&apos;t notify guests yet, so let them know yourself.</p>
                            )}
                          </>
                        }
                        confirmLabel="Cancel event"
                      />
                    )}
                    <ConfirmDelete
                      action={deleteSpaceAction}
                      hidden={{ name: "spaceId", value: s.id }}
                      trigger={<><Trash size={20} aria-hidden="true" />Delete space</>}
                      title="Delete this space?"
                      description={
                        s.event ? (
                          <>
                            <p>
                              {s.event.seatsTaken > 0
                                ? `This removes the space, the event \u201c${s.event.title}\u201d and its ${plural(s.event.seatsTaken, "reservation", "reservations")}. It can\u2019t be undone.`
                                : `This removes the space and the event \u201c${s.event.title}\u201d. It can\u2019t be undone.`}
                            </p>
                            {s.event.seatsTaken > 0 && (
                              <p className="alt-secondary">We don&apos;t notify guests yet, so let them know yourself.</p>
                            )}
                          </>
                        ) : (
                          <p>This removes the space for good. Nobody has booked it yet.</p>
                        )
                      }
                      confirmLabel="Delete space"
                    />
                  </div>

                  {DEMO && (
                    <form className="border-t border-divider pt-4">
                      <input type="hidden" name="spaceId" value={s.id} />
                      {s.status === "available" ? (
                        <Button type="submit" variant="secondary" formAction={simulateBookingAction}>
                          Demo: simulate booking
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          variant="secondary"
                          formAction={simulateReservationAction}
                          disabled={s.event !== null && s.event.seatsTaken >= s.event.capacity}
                        >
                          Demo: a guest joins
                        </Button>
                      )}
                    </form>
                  )}
                </li>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
