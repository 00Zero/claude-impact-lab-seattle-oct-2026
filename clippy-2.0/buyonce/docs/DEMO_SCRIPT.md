# Demo script (about 4 minutes)

Cast: a baker who spends two evenings a month on supplier websites.

## Before you go on stage
- [ ] `python3 tools/demo.py --yes` and `python3 tools/sim_run.py` run clean on the laptop you'll present from. `sim_run.py` is the no-browser fallback that still shows every gate.
- [ ] Agree with the capture teammate which skill the live demo uses, and run `python3 tools/preflight.py <skill>` on it.
- [ ] `policy/policy.toml` exists (copy the example), with the bakery's rules visible.
- [ ] Record the SauceDemo purchase once, ahead of time, so the recording step shows a finished skill (or have a short clip ready as backup).
- [ ] Browser signed in and the Claude desktop app open. Have the terminal demo ready as the fallback if Wi-Fi fails.

## The beats

**1. The problem (20s).** "Small businesses do real work on vendor websites that were never built for AI. The owner is the integration layer."

**2. Teach it once (60s).** Record buying one item on a practice shop while narrating *why* ("I sort by price, but I never buy from anyone rated under four"). Show the generated `SKILL.md`: plain text the owner can read and edit. Point at the rules the interview wrote into `policy.toml`.

**3. Say what you need (30s).** Type or say: *"We're almost out of bread flour. Reorder 10 bags by Friday."* Show it pulling the budget and stock it knows about.

**4. The wow: it didn't pick the cheapest (60s).** Show the comparison. Say: "The cheapest vendor was **skipped**: its rating is below the owner's minimum. The pick is $38 cheaper than the fast option. It also noticed this puts the owner $55 over the supplies budget, so it's asking." Read the *why* lines aloud.

**5. One tap (30s).** Show the approval card. Approve. Show the single-use card capped at the approved total and the audit log line.

**6. It does the clicking (30s).** The agent fills the cart on the vendor's site and stops at the payment page. "The agent never sees a card number."

**7. Close (20s).** "Record a second vendor and it compares across both. The website didn't go away. The owner just stopped having to visit it."

## If something breaks
- Browser step fails: run `python3 tools/demo.py --yes` and narrate steps 3 to 5. The decision logic is the interesting part.
- A question about safety: open `docs/SAFETY.md` and read the three rules.
- A question about vendors changing their sites: skills record intent, and the agent falls back to reasoning, then stops and asks.

## Likely judge questions
| Question | Answer |
|---|---|
| Isn't record-and-replay already shipping? | Yes, in Cowork and Codex. We build on it. What's new is the buying judgment on top: rules, comparison across vendors, budget awareness, approval, spend cap. |
| What stops it overspending? | Three layers: the policy cap, the human approval, and a single-use card limited to the approved total. |
| Does a small business need a developer? | No. The inputs are a text policy and a recording. The scripts run on a stock Python. |
| What if the site changes? | The skill stores intent, not coordinates. If a step fails the agent tries once, then stops and asks. |
