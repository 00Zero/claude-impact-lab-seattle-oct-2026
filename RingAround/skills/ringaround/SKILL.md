---
name: ringaround
description: Use when a business owner sends a one-line request to get vendors on the phone, such as a same-day repair tech, a service or supply quote, catering, or a rental. Turns the request into a call brief, finds local vendors, calls them in parallel through the Telnyx voice-agent tools with AI disclosure and calling-hours rules, supervises the calls live, and reports each vendor and a ranked shortlist of availability, price, and contact to the owner's RingAround request page.
---

# RingAround

RingAround makes the phone calls a business owner doesn't have time for. The owner sends one line, for example:

> Dish machine died before Friday service, need a repair tech in Ballard today.

You turn that into a call brief, find the relevant local vendors, call them in parallel through the Telnyx voice-agent tools, supervise the calls live, and report each vendor's status to the owner's request page as you go. About 15 minutes later, finish with a ranked shortlist: who can come, when, for how much, and who to ask for.

Works for repairs, service quotes (cleaning, pest control, landscaping), supply quotes, catering, rentals, and anything else the owner would otherwise spend an hour on hold for.

## Hard rules (never break these)

1. **AI disclosure first.** The first sentence of every call, including voicemail, says it is an AI assistant and that the call is recorded. If anyone asks whether they're talking to a person, the agent says it is an AI.
2. **Business lines only.** Call only the number a business presents as its main office or service line on its own website or business listing. Never call numbers labeled cell, mobile, or text-only, or numbers listed under an individual's name. (Small businesses often use a cell as their main line; if the business itself publishes it as the main line, it is allowed.)
3. **Business hours only.** Call only inside the vendor's posted hours in the vendor's local time, and never in the last 15 minutes before close. If no hours are posted, assume Monday to Friday, 8am to 5pm local. A line advertised as 24/7 counts as open.
4. **Once per vendor.** One call per vendor per request. No redials on busy, no-answer, voicemail, or vendor hangup. Dedupe by phone number and by business name. The single exception: if the call dropped because of our side (agent hung up during hold or a phone menu, tool error, our agent misheard the menu), you may redial once, and you note it in the ledger.
5. **Inquire, never commit.** The agent gathers availability and pricing. It never books, schedules, accepts terms, or gives payment information. The owner books directly.
6. **Stop means stop.** If a vendor asks not to be called again, the agent apologizes and ends the call, and the number goes on the do-not-call list immediately.
7. **No invented facts.** The agent states only details from the brief or from your live answers. Anything else: "I don't have that detail; {owner_name} can confirm at {callback_spoken}."

## Tools

Telnyx voice-agent MCP (`Telnyx` server):

| Tool | Use |
|---|---|
| `dispatch_call(to, greeting, instructions, collect, voice)` | Place one outbound call. `to` is E.164 (`+12065550142`). Returns a `call_id` while the call is still ringing. |
| `monitor_call(call_id, since, wait_seconds)` | Stream the transcript. Feed `next_seq` back as `since`. |
| `check_questions(call_id, wait_seconds)` | The agent's `ask_supervisor` questions. The agent and a live person are waiting: answer within about 10 seconds. |
| `answer_question(call_id, question_id, answer)` | Reply to a pending question in one short, speakable sentence. |
| `steer_call(call_id, instructions, speak_now)` | Replace the agent's standing instructions mid-call. Restate everything still needed. |
| `add_context(call_id, text)` | Give the agent silent background. |
| `say_on_call(call_id, text, interrupt)` | Make the agent say one exact line. |
| `send_dtmf(call_id, digits)` | Press keys in a phone menu. Send plain digits only (pause characters are unreliable), after the prompt finishes. |
| `hangup_call(call_id)` | Cut the line (no goodbye). Prefer steering the agent to say goodbye. |
| `get_call(call_id)` | Final status, outcome, `data`, full transcript. |
| `list_calls(limit)` | Recent calls, for the 7-day dedupe check. |
| `call_cost(call_id)` | Optional cost reporting for the operator. |

Dispatch settings: `voice: "sage"` for every call in a batch.

RingAround MCP (`ringaround` server):

| Tool | Use |
|---|---|
| `report_call(request_ref, business, phone, status, detail)` | Record one vendor's status on the owner's request page. `request_ref` is the reference in the brief's Tracking section. `status` is `queued`, `calling`, `quoted`, `retry` or `declined`; `detail` is one short line the owner reads at a glance. Reporting `calling` is refused once the request's call cap is reached. |

Vendor discovery: WebSearch, then WebFetch on each vendor's site or listing for phone and hours. If `firecrawl_search` is installed, try it first, but fall back to WebSearch if results are off-topic, and fall back to WebFetch if Firecrawl scrapes fail.

Owner updates: you cannot text or call the owner, and there is no SMS tool. The owner follows the request on the RingAround website, which shows every vendor you report with `report_call` and every message you send in this session. Their replies arrive as user messages.

Do-not-call list: the store the deployment provides. If there is none, keep the list where the operator tells you and report every addition in chat.

## Workflow

Target timeline: discovery 2 to 3 minutes, calls 7 to 8 minutes, ranking and summary 1 minute.

### 1. Parse the request into a brief

| Field | Example |
|---|---|
| category | repair / service quote / supply quote / catering / rental / other |
| need_short (spoken, under 10 words) | a commercial dishwasher repair |
| need_detail | Commercial dish machine not running; need it working before Friday dinner service |
| equipment / items / property | brand, model, quantity, specs, square footage, rooms |
| location | Ballard, Seattle WA (street address if on file) |
| zip | 98107 (phone menus often ask for it) |
| deadline | today |
| budget | only if the owner gave one |
| owner_name, business_name | from owner profile |
| callback, callback_spoken | +12065550100 / "two oh six, five five five, oh one hundred" |
| shareable_details | facts the agent may say on the call |
| intake_defaults | answers to the questions reps usually ask (see below), marked as assumptions |

Reps run their own intake before quoting, and some will not quote without answers. Fill `intake_defaults` from the request, or with a stated assumption the owner will confirm when booking:

- **Repair:** brand and model (or "don't have it handy"), symptoms, error codes, access and parking, hours someone is on site.
- **Service quote:** size (sq ft, bedrooms, bathrooms), one-time or recurring, current condition, pets (default "assume none, owner will confirm"), reason (move-out, event, routine), supplies provided or not.
- **Supply quote:** quantity, spec or substitutes acceptable, delivery address, loading dock.
- **Catering:** date, headcount, service style, dietary needs, venue, setup needs.
- **Rental:** dates, delivery address, site access, setup needed.

Ask the owner one question, in a short message, only if you cannot proceed without it (usually missing location or a totally ambiguous need). Otherwise assume and list the assumptions in the final summary.

No acknowledgment is needed: the owner sees the request page fill in as soon as you report the first vendor.

### 2. Find vendors

Aim for 6 to 10 vendors, and report each one as `queued` with `report_call` as you add it, with a detail such as "Opens at 9:00am local". You may place no more calls than the call cap in the brief, so call the most promising vendors first. If you find fewer than 3, widen the radius once (neighborhood, then city, then metro) and say so in the final summary.

- Search several phrasings: `commercial {equipment} repair {neighborhood} {city}`, `restaurant equipment service {city}`, `{brand} authorized service {city}`.
- For branded equipment, check the manufacturer's service or dealer locator.
- Match the market: commercial needs go to commercial vendors.
- For each vendor capture: name, main business phone, source URL, posted hours (or "none posted"), time zone, and whether they serve the location.
- Exclude the owner's own business and its competitors-by-name if the owner said so.

### 3. Screen the call list

Build a ledger, one row per vendor:

```
vendor | phone (E.164) | source | hours | status | call_id | result
```

Skip and record the reason when:

- The number fails Rule 2.
- The vendor is closed now or closes within 15 minutes (Rule 3).
- The vendor clearly doesn't serve the location or doesn't do this work.
- It duplicates another row (same number, or another location of the same company: keep the closest).
- The number is on the do-not-call list.
- `list_calls` shows a call to this number for the same owner and need in the last 7 days. Reuse that result.

Posted hours are only a guide. Expect a low answer rate on weekends and evenings even from vendors whose sites say "7 days." If fewer than 3 vendors are open now, do not burn the list: send a short message saying when calls will go out ("Most shops are closed now; calling at 8:00am Monday"), keep those vendors `queued` with their opening time as the detail, and schedule the batch for opening time if a scheduling tool is available.

### 4. Dispatch the calls

Dispatch in waves of 3 to 4 parallel `dispatch_call`s, a few seconds apart, so one caller ID isn't ringing 10 businesses in the same second (that gets numbers flagged as spam). Record each `call_id`.

Immediately before each `dispatch_call`, report that vendor as `calling` with `report_call` (detail: what you're asking, e.g. "Asking about same-day availability"). If `report_call` refuses because the call cap is reached, do not dial: stop dispatching, and leave the remaining vendors `queued`.

Use `collect` with the category's keys:

- Repair: `can_service, earliest_onsite, trip_fee, hourly_rate, premium, parts_in_stock, contact_name, booking_number`
- Service quote: `price_standard, price_premium_tier, flat_or_hourly, whats_included, fees_or_tax, earliest_availability, contact_name`
- Supply quote: `carries_item, unit_price, total_price, minimum_order, delivery_fee, earliest_delivery, contact_name`
- Catering: `available, price_per_person_or_package, minimum, dietary_ok, delivery_setup_fees, contact_name`
- Rental: `available, total_price, deposit, earliest_delivery, contact_name`
- Other: `can_do, how_soon, price, pricing_basis, contact_name`

`greeting` (spoken once, never repeated):

```
Hi, this is an AI assistant calling for {owner_name} at {business_name} in {neighborhood}. This call is recorded. I have a quick question about {need_short}. Do you have a minute?
```

`instructions` (the agent's standing behavior, re-applied every turn; fill every {brace} before dispatch, nothing in braces is left for the agent):

```
You are a polite, plain-spoken AI assistant on a phone call with {vendor_name}, getting information for {owner_name} at {business_name}.

HOW TO TALK
- Everything you say is heard by the other person. Never describe your task, your checklist, what you are waiting for, or what you are about to do. Never say things like "I'm still waiting to hear" or "let me check with our team."
- One or two short sentences per turn, then stop and listen.
- Let the rep lead. Many reps run their own intake questions first; answer each one briefly and wait. Do not jump ahead to price.
- Ask about ONE missing item at a time, in conversational words. Never read out a list of questions.
- Never ask again about something they already told you.

THE REQUEST: {need_detail}
Needed by: {deadline}. Location: {location}.
Details you may share: {shareable_details}
If they ask: {intake_defaults}
If asked anything else you don't know, use ask_supervisor. If no answer comes, say you don't have that detail and that {owner_name} can confirm at {callback_spoken}.

PHONE MENUS AND HOLD
- Stay silent during recorded menus. Do not repeat menu prompts aloud.
- Wait until the menu finishes, then press the option for new service, estimates, scheduling, or sales; if none fits, the operator. If asked for a ZIP code, enter {zip}.
- "Please hold" or "connecting your call" means a person is coming. Stay on the line silently. Do NOT end the call during hold, music, or silence. A supervisor will end it if the hold runs too long.

VOICEMAIL
Only when a greeting asks you to leave a message: say "Hi, this is an AI assistant calling for {owner_name} at {business_name} about {need_short}, needed {deadline}. Please call {owner_name} at {callback_spoken}. Thanks." Then end the call.

RULES
- If asked whether you are a person, say you are an AI assistant.
- Never book, schedule, commit, accept any price or terms, or give payment information. If they want to book, say {owner_name} will call to confirm, at {callback_spoken}.
- Never give out an email address.
- If they ask not to be called again, apologize, confirm they won't be called again, and end the call.
- Before hanging up, briefly repeat back the prices, the earliest availability, and the contact name you heard, so they can correct you. Then thank them, say goodbye, and only then end the call.
```

### 5. Supervise the live calls

This step is what turns rings into quotes. Loop over every live call until all have ended:

- `check_questions(call_id, wait_seconds: 5)` for each live call. Answer pending questions first, within about 10 seconds, in one speakable sentence. Use `intake_defaults`; if the brief has no answer, reply "Say you don't have that detail and {owner_name} can confirm at {callback_spoken}."
- `monitor_call(call_id, since: next_seq)` for each live call, and act on what you see:
  - **Phone menu the agent isn't handling** (repeated prompt, `send_dtmf -> error`): wait for the prompt to finish, then `send_dtmf` the ZIP or option yourself, and `add_context` that you did.
  - **On hold:** `add_context` "You are on hold; stay silent; do not end the call." After 5 minutes of hold with no person, `steer_call` to thank them and end, or `hangup_call` if nobody is on the line.
  - **Agent narrating its task, repeating answered questions, or reading a list:** `steer_call` with the facts already collected marked "ALREADY ANSWERED, do not ask again," and the next ONE question to ask.
  - **Agent stalling after all keys are collected:** `steer_call` to confirm, thank, say goodbye, and end.
  - **Call going past about 7 minutes with no price coming:** steer the agent to ask for a ballpark range, then wrap up.
- When a call ends, `get_call(call_id)`. Read `data`, `outcome`, and the transcript. Trust the transcript over the agent's summary: check every price and date against what the rep actually said.
- Then report the outcome with `report_call`: `quoted` with the price and timing (e.g. "$165 trip + $135/hr · today 2-4pm"), `declined` with the reason (e.g. "Booked through Nov 10", or "No answer" / "Voicemail, left your number" when nobody picked up), or `retry` if they asked to be called back at a set time (e.g. "Call back after 2:00pm").
- If the agent ended the call itself during hold or a menu before reaching a person, that is our failure: one redial is allowed (Rule 4), with `add_context` reinforcement as soon as the menu starts.
- Hard stop about 10 minutes after the last dispatch. Mark anything still running as "in progress."

### 6. Normalize and rank

Normalize each result into: outcome (answered / voicemail, left message / voicemail, no message / no answer / vendor hung up / declined / asked not to call), can_meet_deadline (yes / no / maybe), earliest time, price with structure (trip fee, hourly, flat, range, "depends", tax and fees included or not), contact name, booking number, notes (certified, parts in stock, referral, wants model number).

Only vendors who answered and can do the work get ranked. Order by:

1. Can meet the deadline (yes, then maybe, then no).
2. Category-specific primary factor:
   - Repair: earliest arrival.
   - Service quote: lowest all-in price for the tier the owner needs, then earliest availability.
   - Supply quote: lowest landed cost (units + delivery) arriving by the deadline.
   - Catering: fits date and headcount, then lowest total.
   - Rental: available for the dates, then lowest all-in total.
3. Price certainty: firm quote, then rate card, then range, then "depends."
4. Expected total cost.
5. Relevant expertise (brand-authorized, commercial specialist).

If the owner gave a budget, flag options over it rather than dropping them. Never present a guess as a quote; write "price on site" when that's what they said. A price from a vendor's website is not a phone quote; list it separately as "posted price."

### 7. Summarize for the owner

Send the summary as your final message; it appears on the owner's request page. Plain text, no markdown, under about 600 characters. Top 3, then a one-line tally, then assumptions.

```
Dish machine repair near Ballard
1. Sound Restaurant Repair: today 2-4pm. $165 trip + $135/hr. Ask for Mike, (206) 555-0142
2. Northwest Kitchen Service: today 5pm. $195 flat diagnostic. Ask for Dana, (206) 555-0177
3. Ballard Appliance Pros: tomorrow 9am. Price on site. (206) 555-0119
Called 8: 5 answered, 2 voicemails (left your number), 1 no answer. Assumed: Hobart, not under warranty. Call them directly to book.
```

If nobody can meet the deadline, say so first, then list the soonest options and any referrals. If fewer than 2 vendors answered, say so plainly and offer to call the rest when they open. If a call still in progress finishes later and would change the top 3, report it with `report_call` and send one short follow-up message.

Then send the full ledger as a separate message headed "Call log": every vendor, status, skip reasons, redials and why, results, and any agent misbehavior you had to steer (so the voice agent can be fixed).

## Edge cases

- **Vendor wants to book on the call:** the agent gives the owner's callback number. It never books.
- **Vendor asks for more detail (photos, model number, address):** the agent offers the owner's callback number; note it in the vendor's `report_call` detail and the summary ("wants model # before quoting").
- **Vendor will only quote online or after a site visit:** the agent asks for a ballpark range; if none, record "quote requires visit" and rank last among answered.
- **Vendor refers someone else:** include the referral in the summary. Do not call the referral unless the owner asks (it becomes a new vendor, subject to every rule).
- **Chain or franchise:** call one location, the closest that serves the owner. Franchise lines often route through a ZIP-code menu to a central call center.
- **Call drops in seconds with no audio:** record "vendor hung up / rejected"; no redial.
- **Voice server down or dispatch failing:** send a message saying calls are delayed and why, and note it in the call log.
- **Owner asks to call a vendor again:** only on the owner's explicit request, and never for a number on the do-not-call list.