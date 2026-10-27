# OneTrip: AI output and web app UX research (2026-10-25)

Legend: ✅ read in a primary source this session · ⚠️ secondary source, or recalled and not re-fetched. Verify before quoting on stage.

Mentor constraint: "nobody wants to read a wall of AI text, boil it down." Every finding below is filtered through that constraint.

---

## TL;DR: what to build

1. **The tech brief is a checklist card. It is not prose.** Put a verdict line on top ("Bring: 50A breaker, 6 AWG. Likely: failed breaker. Confidence: High"), then 5 fixed sections, each 3 to 5 items. Hide "why" behind a tap.
2. **Show confidence as High/Med/Low words and color, not percentages.** Each level carries an instruction ("Low: confirm on site before ordering parts"). When confidence is Low, show the top 2 or 3 causes instead of one.
3. **Every AI field is editable and shows its evidence.** Tapping a field opens the photo crop or the customer answer it came from. One tap marks a field wrong. The contractor's edits overwrite the AI's.
4. **The contractor app is a mobile web app with a bottom bar of 3 tabs: Jobs · Link · Settings.** "Add to Home Screen" is optional, and SMS is the main alert. Web push works only after the user installs the app on iOS.
5. **Login is an emailed 6-digit code** (with `autocomplete="one-time-code"`), with the magic link inside the same email as a backup. No passwords.
6. **Landing page:** the hero shows the brief on a phone next to the customer's photo. Above the fold: "Free. Open source. No credit card." Then a 3-step "how it works", a live demo link, and a GitHub link. Jobber and Housecall Pro show the conversion conventions; Cal.com shows how to signal "free and OSS" quietly.
7. **Visuals:** a light, high-contrast theme (not dark) for sunlight, a 16px base font, 48px touch targets, and green/amber/red status colors that always come with an icon and a word.

---

## 1. Human-AI interaction guidelines

### Microsoft HAX: 18 Guidelines for Human-AI Interaction (Amershi et al., CHI 2019)
Sources: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/ ✅ (the page confirms 18 guidelines grouped *initially / during interaction / when wrong / over time*) · paper: https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/ ⚠️ (list recalled from the paper)

| # | Guideline | OneTrip application |
|---|---|---|
| G1 | Make clear what the system can do | Onboarding line: "Reads model/serial plates, suggests likely causes and parts. It does not replace your on-site diagnosis." |
| G2 | Make clear how well it can do it | Confidence chip on every inference. Caveat footer when photos are blurry or few. |
| G3 | Time services based on context | Alert on submit. Show the brief before the drive, not at the door. |
| G4 | Show contextually relevant info | Only the fields this trade needs (an electrician sees panel/amperage, a plumber sees fixture/shutoff). |
| G7 | Support efficient invocation | "Re-run with new photo" when the customer adds media. |
| G8 | Support efficient dismissal | Hide any AI section with one tap. |
| G9 | Support efficient correction | Inline edit of model/serial/cause/parts. The edit sticks. |
| G10 | Scope services when in doubt | Low confidence: show N-best causes plus "Ask customer" buttons instead of one cause. |
| G11 | Make clear why | "Why?" opens the evidence: photo crop plus the customer answer quoted. |
| G15 | Encourage granular feedback | 👍/👎 per field, not per brief. |
| G16 | Convey consequences of actions | "Editing price updates the range the customer sees" (if the customer sees it). |
| G17 | Provide global controls | Settings: your rates, your trade, toggle price range visibility. |
| G5/6/12/13/14/18 | Social norms, bias, memory, learning, cautious updates, notify changes | Lower priority for a hackathon. Mention G13 (learning from corrections) as roadmap. |

### Google PAIR Guidebook: Explainability + Trust chapter ✅
https://pair.withgoogle.com/chapter/explainability-trust/
- **Calibrate trust, don't maximize it:** "Users shouldn't implicitly trust your AI system in all circumstances, but rather calibrate their trust correctly."
- **Categorical confidence** (High/Med/Low): the team sets the thresholds, and you should "clearly indicate what action a user should take under each category of confidence."
- **N-best alternatives:** "Showing multiple options prompts the user to rely on their own judgement." Best for low-confidence cases.
- **Numeric %:** "risky because they presume your users have a good baseline understanding of probability."
- **"The best explanation is likely a partial one."** Explain only what changes the decision. Scale the explanation to the stakes. Explain *why*, not just *what*, when stakes are high.
- Be transparent about **what data the system used**. That shows users what it *didn't* see (e.g., "no photo of the panel label").

### Apple HIG: Machine learning ⚠️ (page structure confirmed via search; body didn't render)
https://developer.apple.com/design/human-interface-guidelines/machine-learning · (Generative AI page: https://developer.apple.com/design/human-interface-guidelines/generative-ai)
- Splits guidance into **inputs** (explicit feedback, implicit feedback, calibration, **corrections**) and **outputs** (mistakes, multiple options, **confidence**, **attribution**, **limitations**).
- **Confidence:** translate values into concepts people understand. A bare "97% match" doesn't help them decide.
- **Attribution:** say *where* a suggestion came from ("Because you listen to pop"). For OneTrip: "From photo 2 (nameplate)".
- **Corrections:** don't depend on corrections to make up for weak output, because that erodes trust. Treat corrections as feedback.
- **Limitations:** separate "can't do well" from "can't do at all", and show users how to get the best results (photo tips for the customer).

### Shape of AI pattern library ✅
https://www.shapeof.ai/ (pattern catalog by Emily Campbell). Relevant patterns:
- **Governors:** Citations (`/patterns/citations`), References, **Verification** (`/patterns/verification`, which asks the user to confirm before the AI acts), Draft mode, Controls, Cost estimates.
- **Trust builders:** **Caveat** (`/patterns/caveat`, a short limitation note near the output), **Disclosure** (label AI content as AI), Footprints (trace of what the AI used), Consent, Data ownership.
- **Identifiers:** Color, Iconography, Name (a consistent visual marker for AI-generated content).
- **Inputs:** **Summary** (`/patterns/summary`), Regenerate, Inline action.

**Synthesis: the trust stack for each AI field:** `value` + `confidence word/color` + `source chip (📷 2 / 💬 Q3)` + `edit pencil`. Put one caveat line at the bottom of the brief, not in every field.

### Overtrust risks specific to OneTrip
- A wrong parts list causes the very second trip OneTrip promises to prevent. So **"Confirm on site" is a required section**, and Low-confidence causes never fill the parts list silently. Mark those parts "if cause B".
- Prices: show a **range** built from the *contractor's own rates*, labeled "estimate". Never a single number.
- Model/serial: show the **OCR text next to the photo crop** so a human checks it in 1 second (a Verification pattern).

---

## 2. Summary and briefing design

### SBAR (Situation, Background, Assessment, Recommendation) ✅
IHI: https://www.ihi.org/resources/Pages/Tools/SBARToolkit.aspx · NHS ELFT: https://qi.elft.nhs.uk/?p=10117
Developed at Kaiser Permanente (Michael Leonard, MD), adapted from the US Navy. It uses fixed sections with standardized prompts so the receiver knows where each kind of information sits, which cuts down on repetition. **This maps directly onto the brief:**

| SBAR | OneTrip section |
|---|---|
| Situation | Verdict line: what's wrong, how urgent |
| Background | Equipment: make/model/serial/age + customer's own words (1 line) |
| Assessment | Likely cause(s) + confidence + "why" |
| Recommendation | Bring (parts/tools) · Confirm on site · Price range |

### The Checklist Manifesto / Boeing checklist design ⚠️ (secondary summaries; primary is Gawande 2009)
https://www.shortform.com/blog/boeing-checklist/ · https://janmeppe.substack.com/p/how-to-make-a-good-checklist
- Pick a **pause point** (when the list is used) → for OneTrip that's **"before leaving the shop / supply house."**
- Choose a type. **READ-DO** means doing each item as you read it. **DO-CONFIRM** means doing the work from memory and then checking off. "Bring" is DO-CONFIRM (checkboxes while loading the truck). "Confirm on site" is READ-DO.
- **5 to 9 items** per list, often cited as a working-memory rule of thumb. Cover only the *dangerous, easy-to-miss* steps. Use exact, simple wording and the language of the trade.
- Implication: cap each section (Parts ≤ 7, Confirm ≤ 5). Put the overflow behind "+3 more".

### Information hierarchy for a phone read in a truck
- **Inverted pyramid:** the decision (what to bring) goes above the fold. Evidence goes under a tap.
- **Glanceable:** each line is noun-first, ≤ ~40 characters, no sentences. "50A 2-pole breaker (Siemens QP)", not "The customer's panel appears to use…".
- **Progressive disclosure:** expandable rows. Photos are thumbnails that open full screen with pinch zoom.
- **Fixed section order every time.** The contractor learns where things are, as with SBAR, and stops reading top to bottom.
- **Actions in the thumb zone:** sticky bottom bar with `Call customer` · `Ask for photo` · `Mark ready`.

### Recommended tech-brief layout (390px wide phone)

```
┌───────────────────────────────────────┐
│ ← Jobs        Smith · EV charger  ⋯  │
│ 1.2 mi · submitted 14 min ago         │
├───────────────────────────────────────┤
│ 🟧 LIKELY: Breaker undersized for 48A │  ← verdict (SBAR "S")
│    charger      Confidence: MEDIUM ▸  │     tap ▸ = why
├───────────────────────────────────────┤
│ EQUIPMENT                    📷1 📷3  │  ← "B"
│ Siemens panel · 200A · ~2004  ✎       │
│ Model S2040B1200  ✓ matches photo ✎   │
├───────────────────────────────────────┤
│ OTHER POSSIBLE CAUSES (Medium → show) │  ← N-best, only if not High
│ • Loose lug at breaker        Low     │
├───────────────────────────────────────┤
│ BRING (5)                 ☐ all       │  ← "R", DO-CONFIRM
│ ☐ 60A 2-pole QP breaker               │
│ ☐ 6 AWG THHN, ~30 ft                  │
│ ☐ Torque screwdriver                  │
│ ☐ If loose lug: anti-oxidant paste    │
│ +1 more                               │
├───────────────────────────────────────┤
│ CONFIRM ON SITE (3)                   │  ← READ-DO
│ ! Wire gauge on existing run          │
│ ! Panel has 2 open slots              │
├───────────────────────────────────────┤
│ PRICE RANGE  $380–$620  (your rates)  │
├───────────────────────────────────────┤
│ ⓘ AI-generated from 4 photos + 6      │  ← caveat (Shape of AI)
│   answers. No photo of breaker label. │
├───────────────────────────────────────┤
│ [ Call ]  [ Ask for photo ]  [ Ready ]│  ← sticky thumb bar
└───────────────────────────────────────┘
```

Rules: no paragraph longer than one line on the main view. "Why" text (≤ 3 bullets, each citing 📷/💬) lives in a bottom sheet. Raw customer answers are under a "Customer said" accordion at the bottom.

### Confidence display spec
| Level | Visual | Instruction shown | Behavior |
|---|---|---|---|
| High | green chip + ✓ | "Prep as listed" | single cause |
| Medium | amber chip + ◐ | "Bring parts for top 2 causes" | show alternatives section |
| Low | grey/red chip + ? | "Confirm on site before ordering" | no single verdict. Show N-best + "Ask customer for: [photo of X]" button |
Never show a % on the main view. If the model's calibration is unknown (hackathon reality), derive the level from evidence: e.g. nameplate legible + symptom matches a known pattern → High.

---

## 3. Mobile web app patterns

### PWA vs plain responsive site
- iOS/iPadOS 16.4+ supports **Web Push and the Badging API only for Home Screen web apps**, not Safari tabs. The permission prompt must follow a user gesture. ✅ https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ · https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
- **Recommendation:** ship a responsive site plus a minimal manifest and service worker, so it's installable and the install never blocks use. Show an "Add to Home Screen for alerts" card *after* the first brief arrives, which is the value moment. Don't show it at signup. On iOS, show the Share → Add to Home Screen steps visually, because iOS has no `beforeinstallprompt`.

### Navigation: bottom tab bar, not hamburger
- NN/g: hidden navigation (hamburger) is less discoverable than visible or combo nav on mobile and desktop. ✅ https://www.nngroup.com/articles/hamburger-menus/ (secondary summary of figures: ~20% lower discoverability, ~15% slower on mobile ⚠️ https://www.smartinsights.com/digital-marketing-strategy/are-hamburger-menus-hidden-navigation-good-for-ux/)
- Contractor app has 3 destinations, so use a **bottom tab bar: `Jobs` (badge = new briefs) · `My Link` (share/QR of intake URL) · `Settings` (trade, rates, notifications)**. No hamburger.
- Jobs list is a card per request: customer name, 1-line verdict, confidence chip, age, "New" dot. Sort newest first. Filter chips: New / Ready / Done.

### Auth: email OTP over pure magic link
- Magic links break on mobile in two ways. They open inside the email app's in-app browser, so the session lands in the wrong browser. And corporate scanners pre-fetch links, which spends the single-use token. Emailed codes keep the user in the original tab. ⚠️ https://www.hanko.io/blog/magic-links-vs-email-passcodes · https://appwrite.io/blog/post/appwrite-magic-link · https://ciamweekly.substack.com/p/complexities-of-magic-links
- Slack: "Sign in with email" → "Check your email for a confirmation code" (passkey as an alternative). ✅ https://slack.com/help/articles/212681477 · Notion and Linear also email login codes ⚠️ (observed, not re-verified).
- **SMS OTP autofill:** `<input inputmode="numeric" autocomplete="one-time-code">`, and end the SMS with `@onetrip.app #123456` for WebOTP (Chrome Android) and Safari autofill. ✅ https://web.dev/articles/sms-otp-form · https://developer.mozilla.org/en-US/docs/Web/API/WebOTP_API
- **Recommendation:** email → 6-digit code screen (one big field, auto-submit on the 6th digit, paste supported, "Resend in 30s"). The same email also contains a link as a fallback. Sessions last 30+ days, so contractors rarely log in again. Customers **never log in**: the intake is a public link per contractor.

### Notifications when a customer submits
| Channel | Pros | Cons | Use |
|---|---|---|---|
| **SMS** | Trades live in SMS. Works without install. | US A2P 10DLC registration required. Unregistered 10DLC traffic is blocked (error 30034). Toll-free verification is often faster. ✅ https://pages.twilio.com/10DLC-HelpArticles-WW | **Primary** (in the demo, toll-free number or test creds) |
| Web push | Free, rich, deep-links to the brief | iOS needs Home Screen install first. Opt-in friction. | Secondary, offered after the first brief |
| Email | Free, durable record | Slow to be seen in the field | Always send, as a record with the brief summary inline |
Content: `New OneTrip: Smith, EV charger. Likely undersized breaker (Med). Bring 60A QP. onetrip.app/j/abc`. Put the verdict in the notification itself so it's useful even if the contractor never taps.

### Empty state and onboarding for a brand-new contractor
- Onboarding = 3 questions max: **trade** (chips), **business name**, **hourly rate + trip fee** (pre-filled regional defaults, editable later). Then go straight to "Your link is ready."
- Empty Jobs state: don't leave it blank. Show (a) **your intake link + Copy / Share / QR** as the main CTA, (b) a **"See a sample brief"** card with demo data labeled SAMPLE, so they see the value before any customer acts (Shape of AI "Example gallery"/"Sample response"), and (c) "Send yourself a test request" to try the customer side.
- Wording: "No requests yet. Text this link to your next customer before you drive out."

---

## 4. Landing page for SMB/trades software

### What incumbents do ✅ (fetched 2026-10-25)
- **Jobber** (https://www.getjobber.com/): H1 "Run a stronger service business" · CTA "Start Free Trial" + "No credit card required" (×2) · app ratings with review counts in the hero (4.8 / 13,861 App Store) · big outcome numbers (100K+ businesses, 12 hrs/week saved) · named owner testimonials with business names (e.g. "Jobe & Sons Plumbing") · industry list · section titled "AI built for blue collar businesses."
- **Housecall Pro** (https://www.housecallpro.com/): H1 "Everything to run and grow your business" · email field in the hero + "Start free trial" + "No credit card required" · stats band (200K+ pros, 8+ hrs/week saved) · Capterra and award badges · visible phone number · testimonial with a hard number ("grew from 13 to 42 employees").
- **Cal.com** (https://cal.com/) shows how to present free and OSS: "Unlimited and free for individuals". OSS is a *secondary* signal (Self-hosted → GitHub, a License link in the footer), not the headline.

Patterns that convert for trades: **outcome in their words** (not "AI"), **named peers with business names and photos**, **numbers**, **"no credit card"**, a phone number, and the trades vocabulary.

### OneTrip landing page structure (one scroll, mobile first)
1. **Hero:** H1 benefit in trade language, e.g. **"Show up with the right part. The first time."** Sub: "Your customer snaps 3 photos. You get a one-screen brief: model, likely cause, parts to bring, price range." CTA **"Get your free link"**. Under it: `Free · Open source · No credit card · Works on any phone`. Visual: phone mock of the brief beside a customer photo of a panel.
2. **Pain stat strip:** "A second truck roll costs $120 to $400" (cite as an industry estimate; see ONETRIP.md, vendor numbers ⚠️) plus the team's own anecdote of the Tesla charger callback.
3. **How it works, 3 steps:** Text your link → Customer sends photos (60 sec, no app) → You get the brief.
4. **Live demo:** "Try it as a customer" opens a real intake with sample photos, then shows the resulting brief. This beats a video for a hackathon judge.
5. **Brief anatomy:** annotated screenshot calling out confidence, "why", and the bring-list.
6. **Honesty block:** "AI suggests, you decide. Every field shows its source and is editable." This turns the overtrust concern into a selling point.
7. **Free & open source:** GitHub link with star count, license name (MIT/AGPL), "Self-host it" one-liner. Keep it *below* the benefit, as Cal.com does. Trades buyers care about "free", developers and judges care about "OSS".
8. **Footer CTA** repeated + contact.
Skip: logo walls (no customers yet; fake ones damage trust), pricing table (one line "Free. Forever. For solo and small shops" is enough).

---

## 5. Visual design for trades / outdoor use

- **Light theme by default.** NN/g's review of the research: positive polarity (dark text on light) performed better on acuity and proofreading for normal-vision users, and the advantage grew at small text sizes. ✅ https://www.nngroup.com/articles/dark-mode/ Glare on a dark screen in sunlight also makes it act like a mirror. Offer dark mode as an option only.
- **Contrast:** body text ≥ 7:1 (WCAG 1.4.6 AAA, stricter than the 4.5:1 AA minimum), because sunlight washes out contrast. Use near-black `#111` on white, and avoid grey-on-grey secondary text (keep secondary ≥ 4.5:1). ⚠️ https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html
- **Touch targets:** 48×48 px minimum (Material 48dp; Apple 44pt; WCAG 2.5.8 AA floor is 24px, 2.5.5 AAA is 44px) with ≥ 8px spacing. Users may wear gloves or have dirty hands, so primary actions should be full-width 56px buttons. ⚠️ https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · https://m3.material.io/foundations/designing/structure (accessibility) · https://developer.apple.com/design/human-interface-guidelines/accessibility
- **Status colors (ok / warn / urgent):** green `#15803D`, amber `#B45309`, red `#B91C1C` (dark shades so white text on them passes AA). **Always pair color with an icon and a word** (✓ High / ◐ Medium / ! Low; "Urgent: no power"), so red-green colorblind users (~8% of men) and glare conditions still work. Reserve red for safety/urgency (e.g., scorch marks seen in the photo), not for "low confidence" alone. Use grey with "?" for that, so an uncertain AI doesn't look like an emergency.
- **Typography:** use a system font stack (`-apple-system, Roboto, …`) or Inter. Base 17px, section labels 13px uppercase semibold with letter-spacing, verdict 20 to 22px bold. Use **tabular numbers** for model/serial/prices (`font-variant-numeric: tabular-nums`) and a monospace for serials so O/0 and I/1 are easy to tell apart.
- **Tone:** utilitarian, like a tool rather than a SaaS dashboard. One accent color (safety orange or high-vis yellow works with the audience). Cards with 1px borders rather than soft shadows (shadows vanish in sunlight). No gradients behind text.
- **AI identifier:** one consistent marker (e.g. a small "AI" sparkle tag) on AI-derived fields only. Fields the contractor edited lose the tag and gain "edited by you" (Shape of AI: Disclosure + Footprints).

---

## Build checklist (priority order for demo)
1. Brief card with fixed SBAR-style sections, ≤ 1 line per item, verdict on top.
2. Confidence chip (H/M/L + instruction) and N-best when not High.
3. Source chips (📷/💬) + "Why" bottom sheet + inline edit on model/serial/cause/parts.
4. Caveat footer listing what the AI did *not* see.
5. Bottom tab bar (Jobs/Link/Settings), jobs list cards with verdict line.
6. Email OTP login, 3-question onboarding, empty state with link + sample brief.
7. SMS notification with verdict in the body (toll-free/test number for the demo).
8. Landing page: hero with phone mock + "Free · Open source · No credit card", 3 steps, live "try as customer" demo, GitHub.
