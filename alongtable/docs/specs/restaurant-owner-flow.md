# Restaurant owner flow: onboarding, dashboard, insights preview

Build spec for Claude Code. Put this file at `docs/specs/restaurant-owner-flow.md` in the repo.

Written against `amarjahin/alongtable` at commit `fb8abfa` (Oct 25, 2026). The UI described here comes from the design prototypes ("ALongTable User Flow" and "ALongTable Owner Dashboard" canvases). Where the prototypes and the repo disagree, this spec says which one wins and why.

> **Revision (Oct 26, 2026), decided by the product owner after the first build:** the sign-up flow now follows the prototype's screens instead of §2.1–2.5. Steps are Find your restaurant (Google Maps link, "1 match" card, "This is my restaurant"), Confirm details ("Is this right?" summary with Edit), Pick dates (open days with "Suggested" chips plus shared Time, Seats per date, Where and Minimum spend), **House rules** (now in scope, built as §9 describes), and Review and publish (one Publish button with the §2.4 partial-failure behaviour), then Live. Back links sit left of the primary button. Still left out: the prototype's Account/email step (V0 sends no email) and "Tuesdays look quietest on Google" (no Popular times data). Selected tiles stay ink, not basil, per `brand/DESIGN.md`.

---

## 0. Read before you start

1. `CLAUDE.md`: read `brand/DESIGN.md` and use `brand/brand.css`. No hardcoded colors, fonts or sizes. Tailwind utilities from `app/globals.css` (`bg-sunken`, `text-ink-soft`, `rounded-card`…) are fine because they map to tokens.
2. `AGENTS.md`: this is Next 16. Check `node_modules/next/dist/docs/` before using an API you aren't sure about.
3. `README.md` → **AI workflows**. Keep its rules:
   - The AI never books or publishes anything.
   - Code checks the AI's output.
   - Progress streams to the page.
   - A labelled sample appears if the live call fails.
4. `data-model/README.md`. If you change the schema, change this document first.
5. **Ignore the root `SKILL.md` for this work.** It describes a different concept (ALongPartner, gold accents, prepaid prix fixe, Chinese copy) that conflicts with `brand/DESIGN.md`. Mention this to the team. Don't follow it.
6. Ship with `.claude/skills/push-to-main` (lint, build, one commit per logical change, push to `main`).

**V0 limits that shape this spec.** There are no accounts, no emails sent, no payments, and no owner approval step: `create_event_for_space` books instantly. The copy must not promise any of these. The prototypes said "We'll email you when a table is booked". Don't use that line; use "You'll see bookings on your dashboard."

---

## 1. What exists and what changes

| Area | Already built | This spec adds |
|---|---|---|
| `/restaurant/signup` | Google Maps link, then streamed research, review, AI spot suggestions as cards (Publish, Edit first, Skip). Sample restaurant fallback. Manual name and location in a `<details>` | A step indicator. A two-column layout on desktop. A better "couldn't find it" recovery. Suggestion cards become a **Pick dates** list with one **Publish N spaces** action. A **Live** success screen. The manual path continues into Pick dates |
| `/restaurant` signed out | A small "List your space" card | An owner welcome hero with an example card of what hosts will see |
| `/restaurant` signed in | Answer-first header, photo, notices, stat tiles, seats chart, calendar, space list with filters | A **Your next move** card, a **See insights** link, and open-space days marked on the calendar |
| `/restaurant/insights` | Nothing | A new page: a preview of future insights. Real numbers when there's enough history, otherwise a clearly labelled sample |
| Brand | Tokens, components, `alt-seat-in` and `alt-toast-in` keyframes | `.alt-switch`, `.alt-notice--filling` and a few motion keyframes, all built from existing tokens |

---

## 2. Onboarding: `/restaurant/signup`

### 2.1 Layout and step indicator

- Page width goes from `max-w-xl` to `max-w-5xl`.
- **Desktop (≥ 1024px):** a two-column layout. The step list is on the left (fixed 240px). The step card is on the right (`max-w-[640px]`).
- **Under 1024px:** the step list is hidden and a top progress bar shows instead.

Steps and their mapping to `MapsSetup` stages:

| # | Label | `Stage` values |
|---|---|---|
| 1 | Find your restaurant | `link`, `researching` |
| 2 | Check details | `review`, `suggesting` |
| 3 | Pick dates | `suggestions` (before any publish succeeds) |
| 4 | Live | new stage `live` |

New component: `components/onboarding/steps.tsx`. Props are `{ current: 1 | 2 | 3 | 4 }`.

**Side list.** Each step is a 28px circle plus a label.
- Done steps: the circle is basil with a white check (Phosphor `Check`) and the label is semibold ink.
- The current step: the circle is ink with a white number and the label is weight 800.
- Later steps: the circle is sunken with an ink-soft number and the label is ink-soft.
- The heading above the list reads "List your restaurant".
- Use an `<ol>` and put `aria-current="step"` on the current step.

**Top bar.** It shows the text "Step 2 of 4 · Check details", then 4 segments, each 6px tall with fully rounded ends. Done and current segments are basil; later segments are divider.

**Motion.** Segment fill and circle color change over `--alt-dur-toast` with `--alt-ease`.

### 2.2 Step 1: Find your restaurant

Keep the Maps link form, the streamed progress list and the timeouts exactly as they are.

Change the error state so the owner always has a way forward. Today the error notice offers only "Try with a sample restaurant instead". Replace it with:

```
[problem notice]
We couldn't find that restaurant
{error message from the API, as today}
[secondary button] Enter my details myself      → opens the manual form and focuses "Restaurant name"
[quiet link]       Try with a sample restaurant
```

- Give the `<details>` element an `id` and control its `open` state from React, so the button can open it.
- An empty submit keeps today's message: "Paste your restaurant's Google Maps link."

**Manual path.** Today `signUp` registers the restaurant and redirects to the dashboard. Change it to continue into **Pick dates**:

- Move the manual form into `MapsSetup` as another way into the `review` stage, or call the same server actions from it.
- Register with `registerFromProfile(name, location)`.
- Call `getSuggestions({ name, location })`. `profileFromClient` accepts a profile with only a name and location, and `suggestSpots` then returns `basis: "estimate"`, so the existing estimate copy applies.
- Keep the "Already registered? Enter the same name and location to sign back in." notice. A returning owner should still be able to skip to the dashboard: show a quiet link "Go to my dashboard" on Pick dates.

### 2.3 Step 2: Check details

This is the existing `review` stage. Keep the editable name and location and the `ProfileDetails` block with sources.

Add a source chip above the fields:
- "From Google and the web" (`alt-chip alt-chip--info`) for a live profile
- "Sample restaurant" (`alt-chip`) when `isSample`
- "Added by you" (`alt-chip`) for the manual path

Buttons:
- Primary: "Looks right" (was "Looks right, continue"). While busy: "Finding good dates…"
- Quiet link (existing): "Use a different link"

### 2.4 Step 3: Pick dates (replaces the suggestion cards)

This is the screen the prototype introduced. Suggestions become a selectable list with one publish action.

```
H2   Which dates could use more guests?
Lead {existing basis copy: "Picked from your opening hours…" or "We couldn't confirm your opening hours, so these times are estimates…"}
     Nothing is posted until you tap Publish.

[list on a sunken panel, rows separated by divider hairlines]
  Tue, Oct 27 · Dinner 6–9 PM                        [switch]
  Main dining · 10 seats · $25 min · Quiet
  {reason, ink-soft, 15px}                  Edit first (quiet link)
  ...

[error, red, role=alert, only when 0 selected and Publish pressed]
  Pick at least one date to continue.

[primary]  Publish 2 spaces        (label counts the selected rows; "Publish 1 space")
[quiet]    Skip for now            → /restaurant?registered=1
```

- Rows 1 and 2 are switched on by default. The rest start off.
- The switch is Base UI `Switch` (`@base-ui/react/switch`) with the new `.alt-switch` class (§5.1). Its `aria-label` is the row's date and time.
- "Edit first" keeps today's `/restaurant/new?…` prefill link.
- Publishing calls `publishSuggestion` for each selected row, one after another, so errors map to rows.
- While publishing, the button reads "Publishing…" and shows a spinner. Switches are disabled.
- **All succeed:** go to Step 4.
- **Some fail:** stay on this step and keep every selection.
  - Rows that published get an `alt-chip--booked` "Published" chip and their switch is removed.
  - Show this notice above the button:
    ```
    [apricot notice]  We couldn't publish 1 of 3 dates
                      Your choices are saved. Check your connection and try again.
    ```
  - The primary button becomes "Try again". It retries only the failed rows.
  - Use the apricot notice, not the red one: nothing is lost, and the owner just needs to retry.
- **No suggestions:** keep today's info notice and add a primary "Publish a space yourself" button → `/restaurant/new`.

### 2.5 Step 4: Live

This is a new `live` stage. It shows once at least one space published in this session.

```
[72px mint circle with a basil check that draws itself]
H2   Your space is live            | Your 2 spaces are live
Lead Hosts can book them now. You'll see bookings on your dashboard.

[one row per published space, sunken, staggered in]
  Tue, Oct 27 · Dinner 6–9 PM
  Main dining · 10 seats open                       <SeatRow total=10 taken=0 />

[primary] Go to my dashboard   → /restaurant?registered=1
```

The seat circles pop in one after another (§5.2).

### 2.6 Signed-out `/restaurant`: owner welcome

This replaces the small "List your space" card in `app/restaurant/page.tsx` when there's no `restaurant`.

- **Left column** (`flex-1 min-w-0`):
  - Chip "For restaurants" (`alt-chip alt-chip--booked`)
  - H1 (`alt-display`): "Turn your empty tables into full ones."
  - Lead: "Publish the seats you want to fill. Hosts book them and bring the guests. No setup cost."
  - Primary: "List your space" → `/restaurant/signup`
  - Quiet link: "Already registered? Sign in" → `/restaurant/signup`
- **Right column**, an example card (`alt-card`, `aria-hidden` on the decorative parts):
  - Chip "What hosts will see, for example" (`alt-chip--info`)
  - Title "Your restaurant"
  - Meta "Your neighborhood · Tue · 6–9 PM"
  - `<SeatRow total={10} taken={6} />` with the seats popping in
  - Use no real restaurant names. The card must read as an example.
- The two columns stack under 1024px.

---

## 3. Dashboard: `/restaurant` (signed in)

Keep everything that's there. Add the three items below.

### 3.1 "Your next move" card

New pure function `lib/next-move.ts`:

```ts
export type NextMove = {
  title: string;
  body: string;
  action?: { label: string; href: string };
  tone: "info" | "filling";
};

export function nextMove(spaces: Space[], now: Date, hasPhoto: boolean): NextMove | null
```

Place the card between the notices and `StatTiles`.
- It's an `alt-card`.
- The chip reads "Your next move". Use `alt-chip--info`, or `alt-chip--filling` when `tone` is `"filling"`.
- The title is `alt-title` and the body is ink-soft.
- The action is a **secondary** `ButtonLink`. The header's "Publish a space" stays the only primary.
- Render nothing when the function returns `null`.

Rules, first match wins. "Upcoming" means `startsAt > now`.

| # | When | Title | Body | Action |
|---|---|---|---|---|
| 1 | No spaces at all | Publish your first space | Pick a quiet night. It takes a minute. | Publish a space → `/restaurant/new` |
| 2 | An upcoming event is ≥ 75% full and < 100% | {Weekday}'s event is filling up | {taken} of {capacity} seats are taken. Add the same night next week? | Add {Weekday}, {Mon D} → prefill link (below) |
| 3 | Every upcoming space is booked, or there are none upcoming | Add your next date | Hosts can only book what you publish. This copies your last space. | Add {Weekday}, {Mon D} → prefill link |
| 4 | There are upcoming open spaces and no photo | Add a photo | Your tables stand out when hosts can picture the room. | Add a photo → `#restaurant-photo`. `ImageUpload` takes no `id` prop, so wrap it in `<div id="restaurant-photo">` |
| 5 | Otherwise | (no card) | | |

**Prefill link.** Take the most recent space by `startsAt`. Map it to `/restaurant/new` query params:
- `area` = `label`, only if it's in `AREAS`
- `slot` = the `SLOTS` entry whose `start` equals the Seattle start time (same helper as `onboard-actions.ts`)
- `capacity`, only if it's in `CAPACITIES`
- `price` = the `PRICES` entry whose `info` equals `priceInfo`
- `date` = 7 days after that space's date, or the next same weekday that falls inside `upcomingDays(14)`

Drop any param that doesn't validate, so the form simply leaves that tile unselected. Rule 2 uses the filling event's space instead of the most recent one.

Unit-test `nextMove` with the five cases. If there's no test runner yet, make it a small script under `scripts/` or add a minimal runner.

### 3.2 "See insights" link

In the header's button group, put a `ButtonLink variant="quiet"` "See insights" → `/restaurant/insights` before "Publish a space". Show it only when there is at least one space.

### 3.3 Calendar: mark open-space days

In `components/dashboard/calendar.tsx`, a day with `spaces > 0 && events === 0` keeps the sunken fill and gets a 12px dashed basil ring (`border-2 border-dashed border-basil rounded-full`) in its top-right corner. Add a legend item: "Open space, not booked yet". Booked days stay mint.

---

## 4. Insights preview: `/restaurant/insights`

This is a demo of the future version. **It never mixes sample numbers with real ones.**

### 4.1 Data

New `lib/insights.ts`:

```ts
export type InsightsInput = {
  spaces: Space[];                                                   // listSpaces(restaurantId)
  reservations: { eventId: string; email: string; createdAt: string }[];
};
export async function getInsightsInput(restaurantId: string): Promise<InsightsInput>
export function computeInsights(input: InsightsInput, now: Date): Insights   // pure
export const SAMPLE_INSIGHTS: Insights                                // labelled sample, see 4.4
```

`reservations` is one query: `supabase.from("reservations").select("event_id, email, created_at").in("event_id", eventIds)`. No schema change is needed.

`Insights` fields, all computed from **past** spaces (`startsAt <= now`):

| Field | Definition |
|---|---|
| `events` | Past spaces with an event |
| `guests` | Sum of `seatsTaken` over those events |
| `seatsOffered` | Sum of event `capacity` over those events |
| `fillRate` | `guests / seatsOffered` |
| `sales` | Same as `summarize().revenue` (guests × `pricePerGuest(priceInfo)`), labelled "est." |
| `repeatGuests` | Count of emails with reservations at 2 or more distinct events. Also report `distinctGuests` |
| `weeks` | The last 8 Seattle weeks (Monday start), each with `{ weekStart, seatsBooked, seatsOffered }` |
| `forecast` | The next 4 weeks. Each has `expected` = mean `seatsBooked` of the last 4 weeks (rounded), plus `low` and `high` = the min and max of those 4 weeks |
| `bestWeekday` | The weekday with the highest fill rate among weekdays with 2 or more events |
| `lateWeekday` | The weekday whose median lead time (reservation `createdAt` → space `startsAt`) is 3 days or less, if any |
| `filling` | The next upcoming event that is ≥ 75% and < 100% full (same rule as next-move #2) |

**Real mode** applies when `events >= 8` and the events span at least 4 distinct weeks. Otherwise the page shows **sample mode**.

### 4.2 Page layout

`app/restaurant/insights/page.tsx` is a server component. It redirects to `/restaurant/signup` when signed out.

```
[sample mode only, sky notice, role=status]
  Sample data. This is what insights will look like. Yours appear after 8 events; you've hosted {n}.

Eyebrow  {restaurant.name} · Last 8 weeks
H1       Your {bestWeekday}s are filling          (fallback: "How your tables are doing")
Lead     Here's what happened, and what we'd do next.

Row (wraps under 1024px)
  [card, flex 2]  Your next move    (same component as 3.1)
  [card, flex 1]  Filling up  (apricot chip)
                  Thursday, Oct 29 · 4 days out
                  <SeatRow total=10 taken=5 />
                  5 of 10 seats booked. Most {lateWeekday} bookings arrive in the last 3 days.
                  (Show this card only when `filling` exists. Drop the last sentence when there's no lateWeekday.)

StatTiles (4)
  Booked sales (est.)   ${sales}       note: Guests booked × price per person
  Guests booked         {guests}       note: Across {events} events
  Average fill          {fillRate}%    note: Of {seatsOffered} seats offered
  Guests who came back  {pct}%         note: {repeatGuests} of {distinctGuests} booked a second table

Row
  [card, flex 3]  Seats booked per week
                  Last 8 weeks, with a forecast for the next 4
                  About {expected range} seats a week, likely between {low} and {high}.
                  <ForecastChart />
                  Based on {events} events. The range narrows as you host more.
  [card, flex 2]  What we're seeing      (2–3 rows, divider hairlines, only those that apply)
                  {bestWeekday}s fill first: {pct}% average fill across {n} events.
                  {lateWeekday}s fill late: most bookings arrive in the last 3 days.
                  Guests are coming back: {repeatGuests} of {distinctGuests} booked a second table.

Quiet link  ← Back to dashboard
```

The sentences are code templates filled from computed numbers. **No LLM call on this page.** Don't claim causes ("because…"). State what the numbers show.

### 4.3 `components/insights/forecast-chart.tsx`

A client component. Follow the `GuestsChart` patterns: measure the container with `ResizeObserver`, set colors through `style` with `var(--alt-…)`, and include a `<details>` "View as table".

- **X axis:** 12 weeks, 8 past and 4 forecast. Label every other week ("Aug 31", "Sep 14", …) in 14px ink-soft.
- **Y axis:** 0 to a nice max (reuse the `niceStep` idea), with 4 or 5 divider gridlines.
- **Past:** a 3px basil line with 4.5px basil dots.
- **Forecast:** a 3px basil dashed line (`7 6`) starting from the last past point, with hollow dots (white fill, basil stroke).
- **Likely range:** a mint polygon from `low` to `high` under the forecast, starting at the last past point.
- **Today divider:** a dashed `field-border` vertical line between week 8 and week 9, labelled "Forecast" in 14px semibold ink at the top.
- **Legend above the chart:** a line swatch for "Booked", a dashed swatch for "Forecast", and a mint square for "Likely range".
- **Accessibility:** the `<svg role="img">` gets an `aria-label` summarizing the trend and the forecast range.

### 4.4 Sample data (sample mode only)

These numbers are consistent with each other. Keep them that way if you change any.

| Field | Value |
|---|---|
| Events, guests, seats offered | 16 events, 79 guests, 160 seats (10 per event) → 49% fill |
| Sales (est.) | 79 × $45 = **$3,555** |
| Repeat guests | 22 of 79 → 28% |
| Weeks (seats booked of 20 offered) | 7, 8, 9, 10, 11, 10, 12, 12 (sums to 79) |
| Forecast | expected 13, 13, 14, 14; low 11 and high 15, 15, 17, 17 |
| bestWeekday / lateWeekday | Tuesday (last four at least 90% full) / Thursday |
| filling | Thursday, 4 days out, 5 of 10 |
| Next move | "Open Tuesday with 12 seats". Body: "Your last four Tuesdays were at least 90% full." Action: **disabled** button "Available with real data" |
| Restaurant name | The signed-in restaurant's name. The sky banner already says the numbers are a sample |

---

## 5. Brand additions

Add these to `brand/brand.css` using tokens only, and note them in `brand/DESIGN.md` under Components and Motion.

### 5.1 `.alt-switch`

```css
.alt-switch { width: 52px; height: 32px; padding: 3px; border-radius: 999px; border: 0;
  background: var(--alt-field-border); display: inline-flex; align-items: center; cursor: pointer;
  transition: background var(--alt-dur-toast) var(--alt-ease); flex: none; }
.alt-switch[data-checked] { background: var(--alt-basil); }
.alt-switch[data-disabled] { opacity: .5; cursor: not-allowed; }
.alt-switch:focus-visible { box-shadow: var(--alt-focus); outline: none; }
.alt-switch__thumb { width: 26px; height: 26px; border-radius: 50%; background: var(--alt-surface);
  transition: transform var(--alt-dur-toast) var(--alt-ease); }
.alt-switch[data-checked] .alt-switch__thumb { transform: translateX(20px); }
```

Base UI renders `Switch.Root` (the `.alt-switch`) and `Switch.Thumb` (the `.alt-switch__thumb`). Check which data attributes it uses for checked and disabled in the installed version.

Also add an apricot notice. `brand.css` has the apricot token but no notice variant, and Pick dates uses one:

```css
.alt-notice--filling { background: var(--alt-status-filling); }
```

### 5.2 Motion

The durations already drop to 0 under `prefers-reduced-motion` through the tokens. Make sure each keyframe below also has `animation: none` in that media query.

| Name | Use | Spec |
|---|---|---|
| `alt-step-in` | Every onboarding step card when it mounts | opacity 0→1 and translateX(20px→0), `--alt-dur-seat`, `--alt-ease`. Going back uses −20px |
| `alt-seat-in` (exists) | Seat rows on the Live screen and the welcome card | 60ms stagger per seat (`style={{ animationDelay }}`) |
| `alt-pulse` | Loading placeholders (research steps, suggestions) | opacity 1→.45→1, 1s, infinite |
| `alt-rise` | Live rows and Pick-dates rows when they first appear | opacity 0→1 and translateY(8px→0), 300ms, 90ms stagger |
| `alt-draw` | The Live check mark | `stroke-dasharray: 40; stroke-dashoffset: 40→0`, 500ms, 350ms delay. Reduced motion: offset 0 |
| `alt-shake` | The Pick-dates list when Publish is pressed with nothing selected | translateX 0, −6, 6, 0 over 360ms. Retrigger by toggling a `key` |

Keep motion to these moments. No page-load animation on the dashboard.

---

## 6. Accessibility checks

- Every control is a real `<button>`, `<a>` or Base UI primitive, with targets at least 44px.
- Errors use `role="alert"`. Fields get `aria-invalid`, and the error text is linked with `aria-describedby`.
- Progress uses `aria-live="polite"` (it already does on the research list). The step indicator uses `aria-current="step"`.
- Seat rows always pair the circles with words (`SeatRow` already does).
- The chart has an `aria-label` and a table fallback.
- Status is never shown by color alone. Chips carry words: "Published", "Filling up", "Open".

---

## 7. Acceptance checks

Run these locally with `supabase/seed.sql` loaded, then on the Vercel preview.

**Onboarding**
1. On `/restaurant` signed out, the welcome hero shows. "List your space" opens `/restaurant/signup`.
2. With a valid Maps link, Steps 1→2→3 advance and the indicator updates on desktop and at 375px.
3. With a non-Maps link, the problem notice shows "Enter my details myself". That opens the manual form with focus on Restaurant name.
4. The manual path reaches Pick dates with the estimates copy.
5. On Pick dates, unchecking every row and pressing Publish shows "Pick at least one date to continue." and the list shakes. Nothing is created.
6. With 2 rows selected and Publish pressed, the Live screen shows "Your 2 spaces are live" with 2 rows, and both spaces appear on `/restaurant` and `/spaces`.
7. To check a failed publish, make `publishSuggestion` fail for one row, for example with a temporary dev-only flag. The apricot notice appears, the published row shows "Published", and "Try again" publishes only the failed row.

**Dashboard**

8. With no spaces, Next move shows "Publish your first space".
9. With all upcoming spaces booked, Next move shows "Add your next date", and its link preselects area, slot, capacity, price and date on `/restaurant/new`.
10. Use "Demo: a guest joins" until an event reaches 75%. Next move then shows "{Weekday}'s event is filling up".
11. Calendar days with an unbooked space show the dashed ring and the legend item.

**Insights**

12. With seed data (fewer than 8 past events), the sky "Sample data" banner shows and every number matches §4.4.
13. With 8 or more past events across 4 or more weeks (optional seed below), real numbers show with no banner. The chart's past line matches the weekly sums.

**Regression**

14. Phase 7 of the demo script in `README.md` still passes end to end.
15. `npm run lint` and `npm run build` are clean.

Optional: `supabase/seed-history.sql` gives Harbor & Pine 8 weeks of past spaces, events and reservations so real-mode insights can be demoed. Insert reservations directly with explicit `created_at` values, because `reserve_seat` stamps `now()`. Document it in `README.md`. It must stay safe to re-run, like `seed.sql`.

---

## 8. Build order (one commit each)

1. Brand: add `.alt-switch` and the motion keyframes, and update the `DESIGN.md` notes.
2. Onboarding step indicator and two-column layout.
3. Find-step recovery and the manual path continuing to Pick dates.
4. The Pick dates list, bulk publish and partial-failure state.
5. The Live screen.
6. The signed-out owner welcome on `/restaurant`.
7. `lib/next-move.ts` with tests, plus the dashboard card.
8. The "See insights" link and the calendar open-space marker.
9. `lib/insights.ts`, `SAMPLE_INSIGHTS` and `ForecastChart`.
10. The `/restaurant/insights` page.
11. (Optional) `seed-history.sql` and the README update.

Update `README.md`: tick the relevant items, and add Insights preview under the owner UI with a note that it uses sample data until there are 8 events.

---

## 9. Not in this build

These are in the prototypes but out of V0 scope or need decisions first:

- **Owner email and email notifications.** V0 has no email sending.
- **"Approve bookings first" toggle.** It needs a pending state in `create_event_for_space`.
- **House rules.** They need a `restaurants.house_rules text` column plus display on the space and event pages. To do it: change `data-model/README.md`, add `supabase/add-house-rules.sql` following the `add-photos.sql` pattern, add a textarea on Check details, and show the rules as mint chips on `/spaces/[id]` and `/events/[id]`.
- **Live forecasting beyond the simple 4-week mean and range.** Also anything using Google "Popular times", which isn't available through the official API.
- **Recurring availability.** It's listed as out of scope in the README.

---

## 10. Prompt to paste into Claude Code

> Read `docs/specs/restaurant-owner-flow.md` and build it in the order in section 8, one commit per step. Follow `CLAUDE.md` and `brand/DESIGN.md`. Ignore the root `SKILL.md` for this work. Before you change anything in `MapsSetup`, read `app/restaurant/signup/maps-setup.tsx` and `onboard-actions.ts` in full. Keep the AI rules from the README: the AI never publishes, code checks the AI's output, progress streams, and a labelled sample appears if a call fails. After each step, run `npm run lint` and `npm run build`. When you finish, run the acceptance checks in section 7, tell me which ones you couldn't verify, and push to `main` using the push-to-main skill.
