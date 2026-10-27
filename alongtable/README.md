# ALongTable

Turn empty tables into thriving communities.

ALongTable is a marketplace that connects restaurants with unused seating to people who want to organize or attend social events. Restaurants publish spaces, any user can book a space and create an event, and other users join by reserving a seat.

Source of truth: [V0 PRD (Google Doc)](https://docs.google.com/document/d/1KZRtQpz9H2RFnxD1zin12C5vj1YJKTTi/edit)

Database contract: [`data-model/README.md`](data-model/README.md)

Live app: **https://alongtable.vercel.app** (every push to `main` deploys automatically)

## Team

- **Lucy** — the idea, the business proposal, the slides, and the pitch.
- **Dhwani** — design.
- **Kemet** — guest UI and the APIs behind it: browsing spaces, creating an event, discovering events, and reserving a seat.
- **Lucas** — restaurant workflow, restaurant UI, the APIs for that side, and keeping the database up to date.
- **Amar** — deployment pipelines, the initial database, map integration, and AI integration.

Lucy defined the product the build followed. Dhwani's design is what both screens implement. Amar stood up the database and the deploy, Lucas extended that database for the restaurant side, and Kemet and Lucas built the APIs on top of it. The map and the AI sit on those same flows.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (ask the team),
                             # plus ANTHROPIC_API_KEY for the AI workflows
npm run dev
npm test                     # unit tests for lib/ (node --test, no extra dependencies)
```

Database scripts (run in the Supabase SQL Editor):

- `supabase/seed.sql`: add three restaurants plus sample spaces, events and reservations (Il Nido is left empty for the live demo). Safe to re-run.
- `supabase/seed-history.sql` (optional): give Harbor & Pine 8 weeks of past Tuesday and Thursday dinners with reservations, so `/restaurant/insights` shows real numbers instead of the sample. Run after `seed.sql`. Safe to re-run.
- `supabase/reset.sql`: wipe spaces, events and reservations before a demo run. Keeps restaurants. Run `seed.sql` afterwards to restore the sample data.
- `supabase/drop.sql`, then `schema.sql`, then `seed.sql`: rebuild from scratch after a schema change. Deletes all data.
- Migrations for an existing database, in this order: `supabase/add-photos.sql` (restaurant and event photos), then `supabase/add-coordinates.sql` (map pins on `/events`). Both are safe to re-run and keep your data; a fresh `schema.sql` already includes them.

---

## AI workflows

Two features use Claude (`claude-sonnet-5-5`) through the Anthropic SDK. Both need `ANTHROPIC_API_KEY` in `.env.local` (and on Vercel, where it's already set). Both follow the same rules:

- **The AI never books or publishes anything.** It searches, suggests and drafts; a person reviews and clicks.
- **Code checks the AI's output** before anyone sees it (only real spaces, only valid options, nothing outside opening hours).
- **Progress streams to the page** as newline-delimited JSON, so you can watch each step.
- **A labelled sample result** appears if the live call fails, so the demo still works offline.
- **AI-made content is tagged "ALong AI"** (`components/ui/ai-tag.tsx`) with a note on what the person still decides, so it's clear where the human is in the loop. Numbers worked out by code, like insights, are not tagged.

### 1. Event planner (for organizers)

**Where:** Host an event → **Plan with AI** tab (`/spaces?tab=plan`).

An organizer describes the gathering in plain language, e.g. *"Philosophy meetup for about 8 people, Wednesday evening, somewhere quiet, under $30 each."*

1. Claude calls a `search_spaces` tool (date range, minimum seats, max price per person, time of day) that filters `listAvailableSpaces()`. It searches again with looser filters if nothing matches.
2. Claude calls `submit_plan` with up to 3 spaces (best first, each with a one-line reason) and a drafted title, description and number of spots.
3. Each recommendation links to `/spaces/[id]/create-event?title=…&description=…&capacity=…`, which opens the normal create-event form prefilled. Publishing still goes through `createEventForSpace()`.

Guardrails: recommendations are dropped unless the space came back from a search; spots are capped at each space's capacity; if nothing fits (e.g. 30 people when the largest space seats 16), it recommends nothing and explains why.

| File | Purpose |
|---|---|
| `lib/planner.ts` | Tool definitions, the tool-use loop, plan validation |
| `app/api/plan/route.ts` | `POST { request }` → streamed steps, then `{ type: "plan" }` |
| `app/spaces/planner.tsx`, `app/spaces/sample-plan.ts` | The tab UI and the offline sample |
| `app/spaces/[id]/create-event/page.tsx` | Reads `title`, `description`, `capacity` from the URL as starting values |

Typical run: 5–13 seconds. Estimated cost: a few cents (2–3 Claude calls of a few thousand tokens each; not measured).

### 2. Restaurant setup from Google Maps (for owners)

**Where:** `/restaurant/signup` → **Your Google Maps link**. The page follows the design prototype's steps: Find your restaurant, Confirm details, Pick dates, House rules, Review and publish, then a Live screen.

1. **Read the link.** Share links (`maps.app.goo.gl/…`) are expanded by following redirects on Google Maps hosts only. The place name and pin come from the URL itself; Maps page content is never fetched (`google.com` is blocked for web fetch).
2. **Research the restaurant.** Claude uses Anthropic's server-side **web search** and **web fetch** (the restaurant's own site first) and returns a profile through a `submit_profile` tool: neighborhood, address, cuisine, price range, opening hours, seating areas, sources, and what it couldn't confirm.
3. **Owner reviews.** Name and location are editable; the other details are shown with their sources. Confirming registers the restaurant (or signs it back in).
4. **Suggest spots.** A second call suggests 3–5 spots for the next two weeks using only the publish form's options (`AREAS`, `SLOTS`, `CAPACITIES`, `PRICES`, `FEATURES`). Code drops any that fall outside opening hours, in the past, or duplicate a space the restaurant already has. If hours weren't found, the suggestions are labelled as estimates.
5. **Owner picks dates.** The next two weeks' open days appear with a switch each; ALong AI's picks carry a **Suggested** chip and the top two start on. One time, seat count, area and minimum spend apply to every chosen date (they default to the AI's top pick).
6. **House rules** (optional): common rules to tap, or the owner's own, saved to `restaurants.house_rules` and shown on the space and event pages.
7. **Review and publish.** One summary, one **Publish N spaces** button. Dates publish one at a time, so a failure stays with its date and **Try again** retries only what didn't go live. When all succeed, the **Live** screen confirms them.

If the lookup fails, the owner can **Enter my details myself** (name and neighborhood; suggestions are then labelled as estimates) or **Try with a sample restaurant**. Both continue through the same steps. If the suggestion call fails, Pick dates still lists the open days so the owner can choose.

House rules need `supabase/add-house-rules.sql` on an existing database; until then sign-up skips saving them.

Only name and location are saved; cuisine, hours and the rest are used for suggestions and not stored, so the data model is unchanged. Google's busy-hours ("Popular times") data isn't available, so "quiet" times are based on opening hours and typical restaurant patterns, and the copy says so.

| File | Purpose |
|---|---|
| `lib/onboarding.ts` | Link parsing, web research loop, spot suggestions and validation |
| `app/api/onboard/route.ts` | `POST { link }` → streamed steps, then `{ type: "profile" }` |
| `app/restaurant/signup/onboard-actions.ts` | Server actions: register, get suggestions, publish a suggestion |
| `app/restaurant/signup/maps-setup.tsx`, `sample-profile.ts` | The setup UI and the offline sample restaurant |
| `app/restaurant/new/page.tsx` | Reads `area`, `date`, `slot`, `capacity`, `price`, `features` from the URL |

Typical run: about 25–35 seconds for research plus 5–10 for suggestions. Estimated cost: roughly 5–15 cents per sign-up, mostly from the web pages Claude reads (not measured).

### Trying them locally

- Planner: open `/spaces?tab=plan` and click an example prompt. It needs available spaces, so run `supabase/seed.sql` first.
- Setup: paste a Google Maps link for a real Seattle restaurant, e.g. `https://www.google.com/maps/place/The+Pink+Door/@47.6103,-122.3425,17z`. Registering creates a real restaurant row, so use a test name (e.g. prefix `ZZ Test`) and delete it afterwards.
- To see the fallbacks, paste a non-Maps link (setup) or stop the dev server mid-request (planner), then choose the sample.

---

## Initial checklist: V0 build plan

V0 is **one web app with two interfaces** that demonstrates the complete booking journey. No payments and no auth: users identify themselves by name and email.

| UI | Who | Screens |
|---|---|---|
| Restaurant Owner (`/restaurant`) | Restaurant owners | Sign up, Publish space, View spaces + booking status, Insights preview |
| Landing (`/`) | Everyone | Landing page |
| Regular User (`/events`, `/spaces`) | Anyone | Discover events, Event details, Join event, Booking confirmation, Browse spaces, Space details, Create event, Event created confirmation |

### Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS**, mobile-first
- **Supabase (Postgres)** for persistence. Booking logic lives in Postgres functions so it is atomic and survives refresh.
- **Vercel** for hosting (one shared URL for the demo)

Why a real database instead of mock JSON: the PRD requires that bookings persist after a refresh, that a booked space disappears for everyone, and that a full event stops taking reservations. These checks need shared, transactional state.

---

### Done

- **Phase 0, setup:** Next.js app, Supabase project, shared header, Vercel deploy (every push to `main` deploys).
- **Phase 1, database:** `supabase/schema.sql` implements the data model and is live in Supabase.
- **Phase 2, Restaurant Owner UI:**
  - Restaurant sign-up (`/restaurant/signup`): register once by name and location, or sign back in with the same details. The restaurant id is kept in a cookie; `/restaurant/new` doesn't ask for name and location again.
  - Publish a space (`/restaurant/new`) with tile choices for area, day, time slot, seats, features and minimum spend.
  - Dashboard (`/restaurant`): only that restaurant's spaces, stat tiles, a guests chart, a calendar, a booked/open filter, and cancelling events or deleting spaces with confirmation.
  - Photos for restaurants and events (Supabase Storage).
  - Owner flow ([spec](docs/specs/restaurant-owner-flow.md)): a welcome hero on `/restaurant` when signed out; step-by-step signup matching the design prototype (find, confirm, pick dates, house rules, review and publish, live); a **Your next move** card (`lib/next-move.ts`, unit-tested) and open-space days on the calendar.
  - Insights preview (`/restaurant/insights`, linked from the dashboard as **See insights**): fill rate, estimated sales, returning guests, a weekly chart with a simple 4-week forecast, and weekday patterns, all worked out from the restaurant's past events (`lib/insights.ts`, no AI). It shows clearly labelled **sample data until the restaurant has hosted 8 events** across 4 weeks; run `supabase/seed-history.sql` to demo real numbers.
  - Dev only: "Demo: simulate booking" and "Demo: a guest joins" buttons under `npm run dev` write real rows; run `supabase/reset.sql` to clear them.
- **Phase 3, creating events:** browse spaces, space details, create event, event created (see checklist below).
- **Phase 4, joining events:** discover events, event details, join, booking confirmation (see checklist below).
- **Phase 5, landing page** at `/`.
- **Phase 8, AI workflows:** the event planner and restaurant setup from Google Maps (see [AI workflows](#ai-workflows)).
- **Maps:** Find events (`/events`) and Host an event → Browse spaces (`/spaces`) show a map of Seattle with the list on the right (below it on phones). Tapping a pin narrows the list to that restaurant. Pins come from the Google Maps setup or from geocoding the restaurant's location (OpenStreetMap). Needs `supabase/add-coordinates.sql` on an existing database.

### Phase 3: Regular User UI, creating events (≈3h)

- [x] **U1 Browse spaces** (`/spaces`): `listAvailableSpaces()`, each with restaurant, location, date, time and capacity. Now shown on a map with the list on the right.
- [x] **Space details** (`/spaces/[id]`): full details and a **"Book this space & create event"** button.
- [x] **U2 Create event** (`/spaces/[id]/create-event`): a form with title, description, number of spots (1 up to the space's capacity), and organizer name and email. It calls `createEventForSpace()`.
- [x] **Event created** (`/events/[id]/created`): a success screen with a link to the public event page.
- [x] Errors: show the returned `message` (e.g. when someone else just booked the space) and link back to `/spaces`.

✅ Done when: after an event is created, its space no longer appears in `/spaces`, the second space still does, and `/restaurant` shows the space as Booked.

### Phase 4: Regular User UI, joining events (≈3h)

- [x] **U3 Discover events** (`/events`): `listUpcomingEvents()`, each with title, description excerpt, date, time, location and **"X spots left"** (or a **Sold out** badge). Now shown on a map with the list on the right.
- [x] **Event details** (`/events/[id]`): full details, spots left, and a **Join** button that is disabled when the event is sold out.
- [x] **U4 Join event** (`/events/[id]/join`): a name and email form that calls `reserveSeat()`. Disable the button while submitting.
- [x] **Booking confirmation** (`/reservations/[code]`): confirmation code, event details, and "No payment collected."
- [x] Error states: show the returned `message` for `EVENT_FULL` and `ALREADY_RESERVED`.

✅ Done when: joining moves the event from 10 to 9 spots left on the list, detail and restaurant pages, and the count is unchanged after a refresh.

### Phase 5: Landing page (≈2h)

The landing page (`/`) is the first thing judges see. It should explain the product in five seconds and send each type of visitor to the right flow.

- [x] **Hero**: "Turn empty tables into thriving communities." A one-line subhead (restaurants fill slow nights, people meet over a shared table) and three CTAs:
  - **Find an event** → `/events` (primary)
  - **Host an event** → `/spaces`
  - **List your space** → `/restaurant`
- [x] **How it works**: three steps with icons. A restaurant lists a table, a user turns it into an event, and others join for a seat.
- [x] **Upcoming events**: the next 3 events from `listUpcomingEvents({ limit: 3 })`, shown as cards with spots left. Each card links to `/events/[id]`. If there are no events yet, show "Be the first to host" linking to `/spaces`. This proves the page reads live data.
- [x] **For restaurants**: a short pitch (fill off-peak seats, no setup cost, no payments in V0) with a **List your space** CTA.
- [x] **Footer**: one line about the project and hackathon, with a link to the repo.
- [x] Looks good at phone width, loads fast (server component), and has a page title and meta description set.

✅ Done when: from `/`, a first-time visitor reaches each of the three flows in one click, and a newly created event appears in "Upcoming events" after a refresh.

### Phase 6: Polish (≈2h)

Partly done: the new screens (maps, AI planner, Google Maps setup) were checked at phone width, but not every page has been reviewed, and there's no one-click reset yet.

- [ ] Mobile-first layout checked at phone width (375px)
- [ ] Loading, empty ("No events yet"), error and success states on every form
- [ ] Consistent date and time formatting in the Seattle timezone
- [ ] Make the reset script easy to run before the demo (an npm script or a hidden `/admin/reset` page)

### Phase 7: Demo verification (must all pass, from PRD §8)

Not run yet. Every feature it needs is built; run it end to end on the live site before the demo.

- [ ] 1. Restaurant owner publishes **two spaces with 10 seats each**.
- [ ] 2. User browses available spaces.
- [ ] 3. User books one space and creates **"Debating Pythagoras"** for 10 people.
- [ ] 4. The booked space disappears from available listings, and the second one remains.
- [ ] 5. Another user discovers the new event.
- [ ] 6. That user reserves one seat.
- [ ] 7. The event now shows **9 available seats**.
- [ ] 8. Restaurant owner sees that one space has been booked.
- [ ] 9. All data persists after a page refresh.
- [ ] Extra safety checks: a duplicate email is rejected, a full event blocks joining, and two people booking the same space at once leaves only one event.

### Phase 8: AI workflows ✅

Done. Two workflows are live: the **event planner** for organizers and **restaurant setup from Google Maps** for owners. See [AI workflows](#ai-workflows) for how they work.

---

## Data functions (`lib/`)

Pages call these from Server Components or server actions. They are server-only. Read functions belong inside `<Suspense>`.

| Page | Function |
|---|---|
| `/restaurant` | `listSpaces()` (`lib/spaces.ts`) |
| `/restaurant/new` | `createSpace(input)` (`lib/spaces.ts`) |
| `/spaces` | `listAvailableSpaces()` (`lib/spaces.ts`) |
| `/spaces/[id]` | `getSpace(id)` (`lib/spaces.ts`). Returns `null` if not found. Check `status === "available"` before showing the book button |
| `/spaces/[id]/create-event` | `createEventForSpace(input)` (`lib/events.ts`) |
| `/events`, landing | `listUpcomingEvents()` and `listUpcomingEvents({ limit: 3 })` (`lib/events.ts`). Sold-out events are included with `seatsLeft: 0` |
| `/events/[id]`, `/events/[id]/created` | `getEvent(id)` (`lib/events.ts`). Returns `null` if not found |
| `/events/[id]/join` | `reserveSeat({ eventId, name, email })` (`lib/events.ts`) |
| `/reservations/[code]` | `getReservation(code)` (`lib/events.ts`). Returns `{ reservation, event }` or `null` |

`createEventForSpace` and `reserveSeat` return `{ ok: true, data }` or `{ ok: false, code, message }`. Show `message` to the user. `code` is one of `SPACE_NOT_FOUND`, `SPACE_NOT_AVAILABLE`, `CAPACITY_INVALID`, `EVENT_NOT_FOUND`, `EVENT_FULL` or `ALREADY_RESERVED`. Unexpected database errors throw. Validate form fields (non-empty, email format) in the server action before calling.

## What's left

1. **Phase 7 demo run** on https://alongtable.vercel.app, start to finish, with fresh data (`supabase/reset.sql`, then `seed.sql`).
2. **Phase 6 polish:** a phone-width pass over every page, and an easy reset before the demo.
3. **Before judging:** the AI features use an Anthropic key that expires; swap in a fresh one on Vercel if judging runs past its expiry.

## Out of scope for V0

Payments, revenue sharing, reviews, chat, waitlists, recurring availability, guest cancellations, and auth (PRD §7). Restaurants can cancel events and delete spaces from their dashboard.
