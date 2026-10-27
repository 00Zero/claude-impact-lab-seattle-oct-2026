# OneTrip design direction

**Prototype:** open `prototype/onetrip-flow-v3.html` in a browser. Use the Desktop/Phone toggle at the top; the optional features (mic, near-misses stat, parts link, price range) can be toggled. Demo scenario: Drew's AC stops cooling, and Coolside Heating & Air needs a capacitor.

## Decisions
- **Feel:** contractor = "a sharp apprentice handed me a clipboard" (dense, fast); customer = "a calm helper, done in 90 seconds" (big, one thing at a time).
- **Visual:** light theme, high contrast, high-vis green accent `#C5F23A` (dark text on it), Archivo headings, Inter body, JetBrains Mono for model/serial. Status: grey = waiting, green = brief ready / reviewed, red = safety only.
- **Customer wizard (`/i/[token]`):** welcome (business name and phone, effort "2 photos · ~3 taps · 90s", privacy line) → guided photos with an example and Retake / Use anyway / Can't get it → "Looking at your photos…" status → questions written from the photos, each with a "because" line, adaptive, no question count → review → sent (optional price range).
- **Contractor:** requests grouped *Needs your eyes / Waiting on customer / Done*; address on every card; new request = 3 fields + issue chips; share screen shows the exact message and "nothing is sent automatically". Desktop = two columns; phone = list → brief, bottom tabs Requests · Settings. Installable to the home screen.
- **Service brief:** sticky header (name, address, Call/Text/Directions) → verdict + confidence + one-line why + **See why** → Bring checklist → Confirm on site + "Also possible" → photo thumbnails with AI-note counts → More details (model/serial with copy, what the AI didn't see, answers, estimate) → Photos & privacy (Delete photos now) → sticky Ask for a photo / Mark reviewed.
- **Photo viewer:** full screen, **AI notes / Plain photo** toggle, numbered pins + matching notes, "From the customer's answers" for evidence a photo can't show. Pins are approximate; the notes are the source of truth.
- **Landing:** "Know what's broken before you roll the truck." + "One trip, not two…"; hero = a real customer photo with AI pins and a brief card; 3 steps; **Where OneTrip fits** (we don't sell leads; we start after the job is won); any trade; cost of a second trip (labeled estimates); privacy strip.
- **Privacy:** private storage, GPS stripped, auto-delete 30 days after done (7/30/90), delete-now button, customer told upfront, links expire after 7 days.

## Open items for engineering
- Pin coordinates: test Claude's approximate locations first; if they're inaccurate, use a text/object detector (e.g. Google Cloud Vision text boxes) or fall back to a notes list without pins.
- The spec lists password auth; the team decided on email codes (currently off for testing).

See `DESIGN_GUARDRAILS.md` for the competitor complaints we design against, and `research/` for the full design research.
