# OneTrip: https://youtu.be/2GE_skZvpVo

**Know what's broken before you roll the truck.** Built for the Claude Impact Lab hackathon (2026-10-25). First trade: HVAC.

## The problem

When a customer calls about a repair ("my AC stopped cooling"), the contractor usually learns very little over the phone. The technician drives out, finds the actual problem, and often needs a part or tool that isn't on the truck. That means a second trip: another day the customer waits, and another slot the contractor can't bill.

Customers also don't want another app, another account, or a long form. And they can't be expected to describe equipment, read model numbers, or know which details matter.

## How OneTrip works

1. **Contractor creates a request.** They sign in, add the customer and the issue, and get a private link.
2. **The link goes out from the contractor's own phone**, by text, iMessage or WhatsApp. OneTrip never sends messages on its own.
3. **The customer takes guided photos first.** The link opens a mobile browser wizard with no app, no account and no login. Each photo offers Retake, Use anyway, or "I can't get this photo".
4. **Claude reads the photos and writes tailored questions.** Photos are analyzed while the customer keeps going, so they never wait on the AI. Questions come one per screen and always offer "Not sure". If the AI is unavailable, built-in fallback questions per trade are used.
5. **The contractor gets a one-screen service brief:** the equipment and model/serial, likely cause with confidence (High / Med / Low), parts and tools to bring, what to confirm on site, and the photos with AI notes. Every finding links back to the photo or answer it came from.
6. **Optional estimate.** AI drafts an estimate from the contractor's own price book. The contractor reviews and releases it; the customer sees it only after that.

**Safety and privacy:** the AI never tells customers to open covers, touch wiring, or handle gas. A burning smell, sparks or smoke trigger emergency guidance. Photos sit in private storage with GPS and other metadata stripped, and can be deleted on demand per request. The contractor sets a photo retention period (30–365 days); the cleanup job that enforces it is planned for the pilot.

**Stack:** Next.js (App Router) · Supabase (auth, Postgres, storage) · Anthropic API (`@anthropic-ai/sdk`) · Tailwind · shadcn/ui · Zod.

## Run it locally

### Prerequisites

- Node.js 20.9 or newer, and npm
- A [Supabase](https://supabase.com) project (the free tier works)
- An [Anthropic API key](https://console.anthropic.com)

### 1. Install

```bash
git clone https://github.com/AmoghAtreya/Claude-Impact-Lab.git
```

```bash
cd Claude-Impact-Lab && npm install
```

### 2. Set up Supabase

Apply the migrations in `supabase/migrations/` in filename order. They create the tables, row-level security policies and private storage buckets. With the [Supabase CLI](https://supabase.com/docs/guides/cli), link your project (its ref is in the project URL), then push:

```bash
npx supabase link --project-ref your-project-ref
```

```bash
npx supabase db push
```

Or paste each file, in order, into the dashboard's SQL Editor.

In **Authentication → URL Configuration**, add `http://localhost:3000/**` to the redirect URLs so sign-up and password-reset emails link back to your local app.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret keys (server only) |
| `INTAKE_LINK_SECRET` | Generate with `openssl rand -base64 32`. Changing it invalidates links already sent. |
| `ANTHROPIC_API_KEY` | Anthropic Console (server only) |

Optional: `SITE_URL` (the public base URL for intake links in production), `ANTHROPIC_MODEL`, `AI_WORKSPACE_DAILY_LIMIT` and `AI_GLOBAL_DAILY_LIMIT`. Never give a secret a `NEXT_PUBLIC_` prefix.

### 4. Start the app

```bash
npm run dev
```

Open http://localhost:3000, sign up as a contractor, finish onboarding, and create a request. Open its intake link on your phone (same Wi-Fi, using the Network URL that `npm run dev` prints) to try the customer side.

To look around without any setup, open `/demo/intake` (the customer wizard with sample data, nothing saved) and `/demo/brief` (a sample service brief).

Other scripts: `npm run lint`, `npm run build`, `npm start`.

### Project docs

- `docs/App_Summary.md`: product intent and confirmed requirements
- `docs/Technical_Specifications.md`: features, routes, data model, status model
- `docs/design/`: design direction, the clickable prototype, and design guardrails

### Setting it up as a business
1. Sign up with an email, then enter the business name, trade, contact details and timezone. Tick "Prepare estimates" if you want quotes.
2. Optional: on the Price book page, upload a price list or invoices (PDF, CSV, text or a photo), then review and approve the suggested items. HVAC shops can start from a template.
3. Create a request with the customer's name and what you already know, then copy or share the link by text, WhatsApp or email.
4. When the customer submits, open the request to read the brief and, if enabled, review and send the estimate.

### Impact on the business's operations
Today, a small HVAC or plumbing shop starts most jobs blind: the first visit is spent working out what's wrong, and if the fix needs a part that isn't on the truck, a second trip follows. OneTrip moves that diagnosis to before anyone leaves the shop. The technician sees the equipment, its model number and what the customer is reporting, so they can load the likely part and book the right amount of time. That turns more visits into one-trip fixes and frees the hours a return visit would have taken for another paying job. The office stops playing phone tag to gather details, because the customer answers once, on their own time, from their phone. And businesses that turn on estimates can send a realistic, owner-approved price range before the visit, so customers who decide to go ahead already know roughly what it will cost. Overall, intake becomes the step that plans the job instead of the first step of figuring it out.

## Team (Individual contributions noted below)

**Abdulsaboor — UX, Design & Product Storytelling Lead.** Led the user experience and visual direction: user journeys, wireframes and interface design. Shaped the problem statement and pitch narrative, guided final scope decisions, and connected the product experience to the demo story.

**Eddie — Customer Validation & Business Lead.** Gathered feedback from contractors and event participants, tested the intake flow from the customer's side, and documented usability findings. Wrote and tested the owner-facing README, and co-presented the product's business value.

**Amogh & Rahul — Technical Co-Leads, Full-Stack Development & Architecture.** Led the build across backend and frontend: the data model, contractor sign-up, job creation, shareable links and photo storage, plus the mobile intake form, camera capture, retake prompts and contractor dashboard. Owned integration and live deployment.

**Dhruv — Product Strategy, Development & Team Coordination Lead.** Proposed the business problem and turned it into the product's features, development workflow and end-to-end customer journey. Structured the development process (SDLC), reviewed the experience against the intended solution, ran twice-hourly alignment checks, and wrote the demo video script.
