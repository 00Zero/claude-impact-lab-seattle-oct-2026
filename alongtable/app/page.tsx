import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { CalendarBlank, CalendarCheck, Clock, MapPin, Storefront, UsersThree } from "@phosphor-icons/react/ssr";
import { EventsRow } from "@/components/landing/events-row";
import { Motion } from "@/components/landing/motion";
import { Row } from "@/components/landing/row";
import { SpaceTile, cover } from "@/components/landing/cards";
import { ButtonLink } from "@/components/ui/button";
import { SeatRow } from "@/components/ui/seat-row";
import { listUpcomingEvents, type Event } from "@/lib/events";
import { listAvailableSpaces } from "@/lib/spaces";
import { dateParts, formatDate, formatTimeRange, seattleDateKey, upcomingDays } from "@/lib/time";

export const metadata: Metadata = {
  title: "ALongTable · Turn empty tables into thriving communities",
  description:
    "Restaurants list empty tables, anyone turns one into an event, and others reserve a seat. Find a gathering near you or host your own.",
};

// Runs before the first paint of the landing page (it sits in the server HTML), so the animated items are hidden
// from the start (see globals.css) instead of flashing visible and then fading in. Skipped for reduced motion.
// If the motion code hasn't taken over after 4 seconds, everything is shown rather than left hidden.
const MOTION_BOOT = `(function(){var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("motion");setTimeout(function(){if(!window.__landingMotion)d.classList.remove("motion")},4000)})()`;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-10 sm:py-16">
      <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      <Motion as="section" className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col items-start gap-5">
          <p data-reveal-item className="alt-label-text alt-secondary">Shared tables in Seattle</p>
          <h1 data-reveal-item className="alt-hero">Pull up a chair.</h1>
          <p data-reveal-item className="alt-lead alt-secondary max-w-md">
            Join a shared dinner at a restaurant near you, or open a table at yours.
          </p>
          <div data-reveal-item className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href="/events">Find an event</ButtonLink>
            <ButtonLink href="/spaces" variant="secondary">
              Host an event
            </ButtonLink>
          </div>
        </div>
        <Suspense fallback={<div className="alt-card h-[420px] animate-none bg-sunken" aria-busy="true" />}>
          <NextTable />
        </Suspense>
      </Motion>

      <Suspense fallback={<RowSkeleton />}>
        <Discover />
      </Suspense>

      <HowItWorks />
      <ForRestaurants />
      <Footer />
    </main>
  );
}

/** The soonest event that still has seats, shown large: the table is the product. */
async function NextTable() {
  const events = await listUpcomingEvents({ limit: 6 });
  const event: Event | undefined = events.find((e) => e.seatsLeft > 0) ?? events[0];

  if (!event) {
    return (
      <div className="alt-card flex flex-col items-start gap-3 !p-8">
        <h2 className="alt-h2">Be the first to host</h2>
        <p className="alt-secondary">No tables are open yet. Pick a restaurant space and start one.</p>
        <ButtonLink href="/spaces" variant="secondary">
          Host an event
        </ButtonLink>
      </div>
    );
  }

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const p = dateParts(start);
  const c = cover(0);
  const photoUrl = event.photoUrl ?? event.restaurantPhotoUrl; // the event's own photo, else the restaurant's

  return (
    <Motion>
      <div data-reveal-item className="alt-card flex flex-col gap-5 !p-4">
      {photoUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-photo bg-sunken text-white">
          <Image
            src={photoUrl}
            alt={event.photoUrl ? event.title : `Inside ${event.restaurantName}`}
            fill
            priority
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-ink/55" aria-hidden="true" />
          <div className="absolute inset-0 flex items-end justify-between p-5">
            <span className="flex items-baseline gap-3">
              <span className="alt-hero">{p.day}</span>
              <span className="alt-lead font-semibold">{p.month}</span>
            </span>
            <span className="alt-label-text uppercase tracking-wide">{p.weekday}</span>
          </div>
        </div>
      ) : (
        <div className={`${c.bg} ${c.text} flex aspect-[16/9] items-end justify-between rounded-photo p-5`}>
          <span className="flex items-baseline gap-3">
            <span className="alt-hero">{p.day}</span>
            <span className="alt-lead font-semibold">{p.month}</span>
          </span>
          <span className="alt-label-text uppercase tracking-wide">{p.weekday}</span>
        </div>
      )}
      <div className="flex flex-col gap-2 px-1">
        <p className="alt-label-text alt-secondary">Next table</p>
        <h2 className="alt-title">{event.title}</h2>
        <p className="alt-meta">
          <MapPin size={20} aria-hidden="true" />
          {event.restaurantName} · {event.location}
        </p>
        <p className="alt-meta">
          <CalendarBlank size={20} aria-hidden="true" />
          {formatDate(start)}
        </p>
        <p className="alt-meta">
          <Clock size={20} aria-hidden="true" />
          <span className="tabular-nums">{formatTimeRange(start, end)}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1">
        <SeatRow total={event.capacity} taken={event.capacity - event.seatsLeft} large animate />
        <ButtonLink href={`/events/${event.id}`} variant="secondary">
          {event.seatsLeft > 0 ? "Pull up a chair" : "See the table"}
        </ButtonLink>
      </div>
      </div>
    </Motion>
  );
}

async function Discover() {
  const events = await listUpcomingEvents({ limit: 12 }); // reads the clock, so everything below is request-time
  const spaces = (await listAvailableSpaces()).slice(0, 8);
  const todayKey = seattleDateKey(new Date());
  const weekKeys = upcomingDays(7).map((d) => d.value);

  return (
    <div className="flex flex-col gap-14">
      {events.length === 0 ? (
        <section className="alt-card flex flex-col items-start gap-3">
          <h2 className="alt-h2">Upcoming events</h2>
          <p className="alt-secondary">No events yet. Book a restaurant space and be the first to host.</p>
          <ButtonLink href="/spaces">Host an event</ButtonLink>
        </section>
      ) : (
        <EventsRow events={events} todayKey={todayKey} weekKeys={weekKeys} />
      )}

      {spaces.length > 0 && (
        <Row title="Host your own dinner" href="/spaces" linkLabel="See all open spaces">
          {spaces.map((s, i) => (
            <li key={s.id} data-reveal-item>
              <SpaceTile space={s} i={i} />
            </li>
          ))}
        </Row>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading events">
      <div className="h-10 w-64 rounded-small bg-sunken" />
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[4/3] w-[272px] shrink-0 rounded-photo bg-sunken" />
        ))}
      </div>
    </div>
  );
}

const steps = [
  {
    icon: Storefront,
    title: "Restaurants list a table",
    body: "Owners publish empty seats for a date and time, and say how many people fit.",
  },
  {
    icon: CalendarCheck,
    title: "Someone turns it into an event",
    body: "Anyone books the space, names the gathering and sets how many spots are open.",
  },
  {
    icon: UsersThree,
    title: "Guests pull up a chair",
    body: "People browse events and reserve a seat with just a name and email.",
  },
];

function HowItWorks() {
  return (
    <Motion as="section" className="flex flex-col gap-8">
      <h2 data-reveal-item className="alt-h2">How it works</h2>
      <ol className="grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} data-reveal-item className="flex flex-col gap-3">
            <s.icon size={48} weight="duotone" aria-hidden="true" className="alt-icon alt-icon--lg alt-icon--fill-blush" />
            <h3 className="alt-title">{s.title}</h3>
            <p className="alt-secondary">{s.body}</p>
          </li>
        ))}
      </ol>
    </Motion>
  );
}

function ForRestaurants() {
  return (
    <Motion
      as="section"
      className="alt-band-deep flex flex-col items-start gap-8 rounded-card p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12"
    >
      <div data-reveal-item className="flex flex-col gap-3">
        <h2 className="alt-h2">Own a restaurant?</h2>
        <p className="alt-lead alt-secondary max-w-md">
          Fill your slow nights with guests who want to be there. Publishing an empty table takes a few taps, and it
          costs nothing to set up.
        </p>
        <p className="alt-secondary">No payments run through ALongTable yet.</p>
      </div>
      <div data-reveal-item className="shrink-0">
        <ButtonLink href="/restaurant" variant="secondary">
          List your space
        </ButtonLink>
      </div>
    </Motion>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-divider pt-8">
      <p className="alt-secondary">ALongTable is a V0 hackathon prototype connecting restaurants with people who want to gather.</p>
      <a href="https://github.com/amarjahin/alongtable" className="alt-link">
        View the code on GitHub
      </a>
    </footer>
  );
}
