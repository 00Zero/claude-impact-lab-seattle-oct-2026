# ALongTable: Taste Index

Read this before you build anything people will see. It says how ALongTable looks, sounds and moves, and why, so you can handle the cases it doesn't list.

Four files work together:

| File | Job |
| --- | --- |
| `DESIGN.md` | The rules. Why things look the way they do. |
| `brand.css` | The tokens. Every color, size and shape as a CSS variable, plus component classes. |
| `brand.js` | The motion. The seat row and the few things that move. No dependencies. |
| `index.html` | The proof. One page that shows everything working. Open it next to your build and compare. |

Link `brand.css` instead of typing hex codes. If a value you need isn't a token, ask before inventing one.

---

## The one-line brief

Fresh basil on a clean table: a calm kitchen before service, everything prepped, nothing in the way.

---

## The feeling

Restaurant owners are busy and often stressed. ALongTable should feel like the opposite of a busy Friday night: calm, clean, unhurried and sure of itself. Every screen should leave an owner thinking "they've got this for me."

Guests get the same calm, plus the quiet excitement of a table filling up with new people.

---

## Who it's for

- **Restaurant owners** publish empty spaces and watch them fill. Many are busy, some are older, few are app-native. Their screens are the priority: the answer first in big type, plain words, one obvious next step, and a clear "here's what happens next" after every action.
- **Guests** find a table, join strangers, and show up. Their screens use the same tokens, with photos and the seat row doing the storytelling.

---

## Principles

1. **Calm is the feature.** Fewer things on screen, more space around them, no urgency tricks. After every action, say what happens next ("We'll text you when someone books.").
2. **Answer first.** Lead each screen with the one fact the person came for, in big type: "2 tables booked this week". Details come after.
3. **One basil action per screen.** Basil green marks the single thing to do next. If two things on a screen are basil buttons, one of them is wrong.
4. **A color means one thing, always.** Mint means booked. Apricot means filling up. Sky means information. Red means a problem and nothing else.
5. **Surfaces, not outlines.** Separate things with space and a change of surface, not with borders. A border appears only where someone has to see an edge, like a text field.
6. **The table is the product.** Show seats, not statistics. The seat row (one circle per seat, filled as people join) goes anywhere capacity matters.
7. **Readable at every age.** Body text is 16px or larger, tap targets 44px or larger, every text pairing passes WCAG AA, and there is no pale grey text.

---

## Functional to expressive

Every piece of ALongTable work sits somewhere on one scale, from functional to expressive. Where it sits decides how much of the brand layer it gets. The foundation is always the same small palette and one typeface; expression is added on top only where the piece can afford it.

This keeps ALongTable a branded house, not a house of brands: the owner's dashboard, a guest's confirmation and a table tent in the restaurant all read as the same brand.

| Stop | What lives here | What it uses | What it never uses |
| --- | --- | --- | --- |
| **Functional** | Owner dashboard, publish-a-space form, booking lists, notifications, emails and texts, settings, errors | Product palette only. Body and title type, one big headline number. | Brand colors as backgrounds, covers, illustration |
| **In between** | Guest discovery, event pages, booking confirmation, host profiles, onboarding | Everything functional, plus photos, event covers, the seat row at large size, display headlines | Brand color behind forms or status |
| **Expressive** | Website, social posts, campaigns, table tents, window stickers, menu inserts, signage | Full brand palette as backgrounds, hero type, polaroid collages, two-tone icons | Status colors used decoratively (mint, apricot, sky and red keep their meanings even here) |

### How to place a piece

- **Is someone trying to get a task done?** It's functional. Make it quiet and fast to scan.
- **Is someone deciding whether to go?** It's in between. Help them picture the evening.
- **Is someone meeting ALongTable for the first time?** It's expressive. Make them feel something.

When unsure, go one step more functional. Owners trust calm.

---

## Color

The palette has two layers, the way brands like Spotify and Uber separate them.

- **The product palette** is what people touch every day: clean neutrals, one action color, and four meaning colors. It never gets decorative.
- **The brand palette** adds deep basil and blush for the website, social posts, event covers and signage. These never appear on buttons, form fields or status.

Why basil: it's a fresh herb green, so it belongs in a kitchen and reads as "go" without explanation. It's brighter and fresher than the deep coffee-shop greens, and the background stays a clean, barely-green off-white rather than beige.

### Product palette

| Token | Hex | Use it for |
| --- | --- | --- |
| `--alt-basil` | `#1E7A53` | The one main action per screen, links, the focus ring, your own seat. The ALongTable color. |
| `--alt-basil-hover` | `#18664A` | Hover and pressed state of basil buttons. |
| `--alt-ink` | `#15191A` | All text, taken seats. Never pure black. |
| `--alt-ink-soft` | `#5A6360` | Secondary text: addresses, times, helper text, open seats. |
| `--alt-page` | `#F5F6F2` | Page background. A clean off-white with a hint of green. |
| `--alt-surface` | `#FFFFFF` | Cards, sheets, inputs. |
| `--alt-sunken` | `#ECEEE8` | Quiet fills inside cards: grouped rows, tab tracks, empty states. |
| `--alt-divider` | `#E2E5DF` | Hairlines between list rows. Never around a card. |
| `--alt-field-border` | `#8D9592` | Text field and checkbox borders (3.1 against white, enough to see the edge). |
| `--alt-mint` | `#E2F0E7` | **Booked, confirmed, done.** Fill only. |
| `--alt-apricot` | `#FBE3D6` | **Filling up, needs a look soon.** Gentle, never alarming. Fill only. |
| `--alt-sky` | `#DCEAF3` | **Information.** "We'll text you", tips, neutral notices. Fill only. |
| `--alt-red` | `#B42318` | **A problem.** Errors and destructive actions only. |

### Brand palette (marketing, event covers, social; never controls)

| Token | Hex | Use it for |
| --- | --- | --- |
| `--alt-basil-deep` | `#0E3B2A` | Big brand blocks: website hero, table tents, social posts. White or mint text on top. |
| `--alt-blush` | `#F4D3DA` | Event covers, social tiles, the warm counterpoint to basil. |
| Mint, apricot, sky | as above | Also usable as cover and campaign backgrounds. |

No bright yellow, orange, neon or saturated pink. They read as urgency, and ALongTable's job is to remove urgency.

### Measured contrast (WCAG AA needs 4.5 for normal text)

| Text | white | page | sunken | mint | apricot | sky | blush |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ink | 17.7 | 16.3 | 15.1 | 15.1 | 14.4 | 14.4 | 12.8 |
| Ink soft | 6.2 | 5.7 | 5.3 | 5.3 | 5.0 | 5.0 | 4.5 |
| Basil | 5.3 | 4.9 | 4.5 | 4.5 | **4.3, don't** | **4.3, don't** | **3.8, don't** |
| Red | 6.6 | 6.1 | 5.6 | 5.6 | 5.3 | 5.4 | 4.8 |

White text on basil is 5.3 (6.9 on hover), on red 6.6 and on deep basil 12.5. Mint text on deep basil is 10.6.

### Color rules

- Basil text only on white, page, sunken or mint.
- Status chips are always a soft fill with ink text.
- An error message is red text on white or page, with a red icon. Never a red background with red text.
- Light mode only for V0. A dark mode is a later decision, not an improvisation.

---

## Type

One family: **Figtree**, free on Google Fonts (SIL Open Font License), variable weights 300 to 900. It's a close free stand-in for the friendly geometric sans used by Airbnb Experiences, which is the reference for how type should feel: big confident headlines, quiet body text, lots of space.

Hierarchy comes from size and weight, never from a second font.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `--alt-text-hero` | 64 / 1.0 | 800 | Landing page headline only |
| `--alt-text-display` | 44 / 1.05 | 800 | Page headlines and the answer-first number on dashboards |
| `--alt-text-h2` | 32 / 1.1 | 800 | Section headline |
| `--alt-text-title` | 24 / 1.2 | 600 | Card and event titles |
| `--alt-text-lead` | 18 / 1.5 | 400 | Intros, and body text on owner screens |
| `--alt-text-body` | 16 / 1.55 | 400 | Everything else you read |
| `--alt-text-small` | 14 / 1.4 | 600 | Chips, labels, metadata. Never for sentences. |

- Headlines of 24px and up get `letter-spacing: -0.02em`; display and hero sizes get `-0.03em`.
- Times, prices and seat counts use tabular numbers (`font-variant-numeric: tabular-nums`) so they line up.
- Weights in use: 400, 600, 800. Nothing else.

---

## Shape and space

- **Spacing** runs on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64. When in doubt, add space.
- **Corners are medium:** soft enough to feel friendly, firm enough to feel current.
  - Cards and sheets: 16px (`--alt-radius-card`).
  - Buttons and inputs: 10px (`--alt-radius-control`).
  - Chips, tags and inner rows: 8px (`--alt-radius-small`).
  - Photos: 12px, except polaroids, which are square with a white frame.
  - **Seats and avatars are round** (`--alt-radius-seat`), because a seat at a table is a circle.
- **Cards** are white on the page background with no border and no shadow. Separate list rows inside a card with a 1px divider.
- **Primary buttons** are 48px tall, basil fill, white text, no border.
- **Secondary buttons** are sunken fill with ink text.
- No gradients, no blur, no drop shadows, no outlines around cards or chips.

---

## Iconography

One icon family: **Phosphor Icons** (MIT license). Its rounded, friendly shapes match Figtree. In React, install `@phosphor-icons/react`:

```jsx
import { Chair, CalendarBlank } from "@phosphor-icons/react";

<Chair size={24} weight="regular" aria-hidden="true" />
```

Icons follow the functional-to-expressive scale:

| Stop | Weight | Color | Size |
| --- | --- | --- | --- |
| Functional | `regular` (outline) | Ink, or basil when the icon is part of an action | 20px inline with text, 24px on its own |
| In between | `regular` | Basil | 24 to 32px |
| Expressive | `duotone` | Ink outline, with the fill layer in mint, apricot, sky or blush | 48px and up |

### Core set

Use these for these meanings, everywhere. Don't swap in a different icon for the same idea.

| Meaning | Phosphor name |
| --- | --- |
| A seat | `Chair` |
| Guests, people at the table | `UsersThree` |
| Date | `CalendarBlank` (booked: `CalendarCheck`) |
| Time | `Clock` |
| Location | `MapPin` |
| Restaurant, space | `Storefront` |
| Dinner, food | `ForkKnife` |
| Drinks | `Wine` (daytime: `Coffee`) |
| Conversation, event theme | `ChatsCircle` |
| Notifications | `Bell` |
| Confirmed | `CheckCircle` |
| Information | `Info` |
| A problem | `WarningCircle` |
| Add, publish | `Plus` |
| Edit | `PencilSimple` |
| Share | `ShareNetwork` |
| Welcome, hello | `HandWaving` |
| Made by ALong AI | `Sparkle` |

### Icon rules

- An icon always sits next to a word, except in a few well-known controls (close, back, share) that get an `aria-label`.
- Icons are decorative to screen readers (`aria-hidden="true"`) when a word sits next to them.
- Never use soft colors (mint, apricot, sky, blush) for an icon's outline. They only fill the duotone layer.
- No emoji in the product. Emoji are fine in a guest's own event description.

---

## Photography

Photos are how ALongTable shows that the people and places are real. The reference is **222**: candid photos of everyday social moments in polaroid frames, never polished advertising.

### What to shoot

- **Hands and tables:** bread being passed, glasses meeting, a plate shared down the middle.
- **Faces mid-conversation:** people laughing or listening, not posing for the camera.
- **The room before service:** a set table, chairs pulled in, low light, the restaurant's real character.
- **Owners in their space:** behind the bar, at the pass, in the doorway. Owners are part of the brand.

### How it should look

- **Natural, warm light.** Evening light, candles, a lamp over the table. No studio lighting, no flash glare.
- **Real color, gently warm.** Don't push saturation or add heavy filters.
- **Close and imperfect.** Slight motion blur, a cropped elbow and an off-center frame are welcome. They read as real.
- **Real restaurants only.** Every venue photo shows the actual space being booked.

### How it's framed

- **Functional screens:** no decorative photos. A small square venue photo (12px corners) is fine in a list.
- **In between:** a large photo at the top of an event card (12px corners). Host photos are round.
- **Expressive:** polaroid collages of three to five photos, overlapping slightly, like pictures pinned up after a good night. Captions are short, in sentence case: "Last Wednesday at Café Pinot".

### Photo rules

- No stock photography, ever.
- Get consent from everyone recognizable, and from the owner for every venue photo.
- Never use a guest's photo in marketing without asking them first.
- Always set meaningful `alt` text: "Six people laughing around a candlelit table at Café Pinot", not "photo".

---

## Components

Built on **Base UI** (unstyled, accessible React primitives). Base UI renders the right ARIA roles and states, so the CSS styles those states directly: `[aria-checked]`, `[aria-selected]`, `[aria-disabled]`, `[aria-invalid]`, `:focus-visible`. Base UI's own `data-*` state attributes (for example `[data-disabled]` and `[data-checked]`) are styled alongside them. Pass the class names from `brand.css` through each part's `className` prop.

| Component | Class | Base UI part | Notes |
| --- | --- | --- | --- |
| Primary button | `alt-button alt-button--primary` | `Button` | Basil. One per screen. |
| Secondary button | `alt-button` | `Button` | Sunken fill, ink text. |
| Quiet button | `alt-button alt-button--quiet` | `Button` | Text only, for "Cancel" and "Back". |
| Danger button | `alt-button alt-button--danger` | `Button` | Red. Only inside a confirmation dialog. |
| Status chip | `alt-chip alt-chip--{booked, filling, info, problem}` | none | Mint, apricot, sky, red text on white. |
| Notice | `alt-notice alt-notice--{info, success, filling, problem}` | none | "Here's what happens next" messages. Apricot (`--filling`) is for "nothing is lost, have another look", such as a partial publish to retry. |
| Answer number | `alt-answer` | none | The big fact that leads a dashboard. |
| List row | `alt-list`, `alt-row` | none | Rows with a divider between them, inside a card. |
| Seat row | `alt-seats` | none | Rendered by `brand.js` from `data-alt-seats` and `data-alt-taken`. |
| Card | `alt-card` | none | White, no border, no shadow. |
| Text field | `alt-field`, `alt-label`, `alt-input`, `alt-help`, `alt-error` | `Field.Root`, `Field.Label`, `Field.Control`, `Field.Description`, `Field.Error` | Error in red with a sentence that says how to fix it. |
| Checkbox | `alt-checkbox` | `Checkbox.Root`, `Checkbox.Indicator` | Basil when checked. |
| Switch | `alt-switch`, `alt-switch__thumb` | `Switch.Root`, `Switch.Thumb` | On/off for a row, like choosing which dates to publish. Basil when on, field border when off. Styled from `[data-checked]` and `[data-disabled]`. Give it an `aria-label` that names the row. |
| Tabs | `alt-tabs`, `alt-tab` | `Tabs.List`, `Tabs.Tab` | Sunken track, white selected tab. |
| Dialog | `alt-dialog`, `alt-backdrop` | `Dialog.Popup`, `Dialog.Backdrop` | Confirmations before anything that can't be undone. |
| Toast | `alt-toast` | `Toast.Root` | "You're in", "Space published". |
| AI tag | `alt-chip alt-chip--info` + `Sparkle` icon, text "ALong AI" | none | On anything ALong AI wrote or picked (researched details, suggested dates, drafted events), followed by a short note on what the person still decides. React: `<AiTag>`. Never on numbers worked out by code or on things the person entered. |
| Polaroid | `alt-polaroid` | none | Wraps an `<img>` and an optional caption. Expressive only. |

### The seat row

The seat row is how ALongTable shows capacity. One circle per seat:

- **Filled ink** = taken.
- **Filled basil** = yours.
- **Dashed outline** = open.

Always pair it with the words, for example "4 of 10 seats open". The circles are for glancing; the words are for screen readers and certainty. Above 12 seats, show a bar instead of circles.

---

## Motion

Motion is slow enough to feel calm and only ever confirms something the person did.

| What | How | Duration |
| --- | --- | --- |
| A seat fills | Fades in and grows from 80% to 100% | 300ms |
| Seats-left count changes | The number swaps, no counting animation | instant |
| Button press | Darkens to the hover color | 120ms |
| Toast | Fades in and rises 4px | 240ms |
| Onboarding step arrives (`alt-step-in`) | Fades in and slides 20px from the right (from the left when going back) | 300ms |
| Seats appear on a new space (`alt-seats--pop`) | Each seat pops in, one after another | 300ms each, 60ms apart |
| Rows appear for the first time (`alt-rise`) | Fade in and rise 8px, one after another | 300ms each, 90ms apart |
| Space goes live (`alt-draw`) | The check mark draws itself | 500ms, after 350ms |
| Nothing selected (`alt-shake`) | The list shakes 6px left and right once | 360ms |
| Loading placeholder (`alt-pulse`) | Fades between full and 45% opacity while work is in progress | 1s, repeats until loaded |

- Easing: `cubic-bezier(0.25, 0.1, 0.25, 1)` for everything. No overshoot, no bounce.
- Nothing moves on its own. No looping animations, no parallax, no auto-advancing carousels. The one exception is `alt-pulse` on a loading placeholder, which stops as soon as the content arrives.
- Keep motion to the moments in the table. No page-load animation on the dashboard.
- If the person has asked for reduced motion, everything is instant: the duration tokens drop to 0 and every keyframe above is set to `animation: none`.

---

## Voice

ALongTable talks like a calm, capable host: "We've got this."

- **Sentence case everywhere**, including buttons and headlines.
- **Short and specific.** Numbers over adjectives: "4 seats left", not "filling up fast".
- **Answer first:** "2 tables booked this week", then the details.
- **Always say what happens next** after an action: "Your space is live. We'll text you when someone books it."
- **Use the owner's words:** "space", "seats", "time", "booked". Never "inventory", "listing" or "capacity utilization".
- **No pressure.** No countdown timers, no "Hurry!", no exclamation marks.
- **Errors** say what happened and how to fix it, calmly: "That time overlaps another space. Pick a different end time."

| Say | Don't say |
| --- | --- |
| Pull up a chair | Book now! |
| 4 of 10 seats open | Only a few spots left, hurry! |
| You're in. We'll send the address the day before. | Reservation successfully confirmed |
| Publish a space | Create listing |
| Your space is live. We'll text you when someone books it. | Listing created. |
| That space was just booked. Here are two more nearby. | Error 409: Conflict |

---

## Do and don't

**Do**

- Lead every owner screen with the answer in big type.
- Put the seat row on every event and space card.
- Use one basil button per screen, for the thing the person came to do.
- Follow every action with a sentence about what happens next.
- Separate things with space and surfaces, not borders.
- Keep mint for booked, apricot for filling up, sky for information and red for problems, everywhere.
- Check the contrast table before adding any new pairing.

**Don't**

- Put borders or shadows around cards, chips or panels.
- Use soft colors as text, icons or thin lines.
- Use deep basil or blush on buttons, forms or status.
- Use bright yellow, orange, neon, or any color that reads as an alarm.
- Use red for anything except a problem.
- Use pure black, pale grey text, or any text under 14px.
- Use gradients, blur or glass.
- Use a second typeface, or weights other than 400, 600 and 800.
- Write "Hurry", "Get started", "Unlock" or "Seamless", or use exclamation marks.
- Animate anything the person didn't cause.

---

## One line for CLAUDE.md

```
Before you build anything visual, read brand/DESIGN.md and link brand/brand.css. Never hardcode a color, font or size that isn't a token there.
```
