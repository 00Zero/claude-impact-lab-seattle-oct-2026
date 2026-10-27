# Spam-Test Protocol: Independent Before/After Validation

Agent instructions for validating Send Check's fix quality with the Email
Spam Tester MCP server. Read this whole file before the first tool call.

## What this proves and does not prove

The test isolates Send Check's content effect: same sender, same account,
two versions of one message — original vs Send Check's suggested fix. The
infrastructure checks (SPF, DKIM, DMARC, reverse DNS, TLS, blocklists) stay
constant across both sends, so any delta in content checks or provider
placement is attributable to the fix.

- VALID claim: "an independent deliverability instrument confirms the fix
  reduces bulk-mail content triggers" (slop phrasing overlaps with content
  spam signals).
- INVALID claim: anything about reply rates or recipient fit. No spam filter
  measures audience psychology. Never say the test "proves it gets replies."

## Prerequisites

1. The Email Spam Tester MCP tools are available: `get_test_address`,
   `wait_for_report`, `get_report`, `get_message_source`.
2. A corpus draft Send Check scored FIX or SCRAP, plus the suggested fix it
   produced. Both anonymized: no real names, companies, or addresses.
   Placement inboxes are PUBLIC test inboxes — subject and sender are shown
   on a public web page.
3. A human sender. The email must be sent by a person from the platform they
   really send from (their Gmail, their domain mail). Half the checks read
   what that platform adds. The agent reserves addresses and reads reports;
   it never sends.

## Procedure

Run A (original draft), then run B (fixed draft). Same human, same sending
account, same run of the protocol for both.

### Run A: the original draft

1. Call `get_test_address` with `include_placement: true`.
   The result contains: the test address, a report URL with a slug, a
   subject marker, and a list of recipient addresses.
2. Hand the human sender, verbatim, in one message:
   - every recipient address from the result (placement requires sending to
     ALL of them, not just the single test address)
   - the subject marker, with the instruction to put it in the subject line
   - the draft body to send, unmodified
   - the deadline: the address expires one hour after reservation and
     accepts exactly one message
3. After the human confirms they sent it, call `wait_for_report` with the
   slug and `timeout_seconds: 300`. This call BLOCKS until analysis is
   ready. Do not write a sleep-and-poll loop. Do not call it before the
   human confirms the send.
4. Record the result (see Results capture). Provider placement keeps
   filling in for up to 30 minutes; call `get_report` with the same slug
   later to pick up late placements.

### Run B: the fixed draft

5. Repeat steps 1–4 with a FRESH address (one address = one message) and
   the Send Check fixed version of the same draft. Same human, same
   sending account, same hour if possible.

### Compare

6. Diff the two reports:
   - content checks: which flags cleared between A and B
   - spam score delta (scores are comparable between runs)
   - placement delta per provider (inbox / spam / promotions)
7. If a finding points at a header and the sent message needs inspecting,
   `get_message_source` works for one hour after arrival.

## Results capture

Write to `corpus/validation/`:

- `run-a-<slug>.md` and `run-b-<slug>.md`: slug, report URL, send
  timestamp, sender platform, draft version used, content flags, score,
  placement table.
- `comparison.md`: the A/B table (flag-by-flag, score delta, placement
  delta) and the one-sentence claim the data supports, phrased per the
  claims discipline above.
- Add both report URLs to the README under "Independent validation" —
  report links are permanent and public; they are clickable receipts for
  judges.

## Failure modes

- `state: "waiting"` in a report means the email never arrived. Check the
  human actually sent it, to all recipients, before the address expired.
  If expired, reserve a fresh address; never reuse a slug.
- `wait_for_report` returning with partial data past its timeout is normal:
  take what it has, re-pull with `get_report` later.
- One message per address. A second send to the same address is dropped.
- If placement is missing but checks are present, placement is still
  filling: re-pull in 10–30 minutes, do not re-send.
- Do not test confidential content: report pages and placement inboxes are
  public to anyone with the link.

## Time budget

One A/B pair: ~20 minutes of agent time plus two human sends. Run by H5 so
final placement numbers land before the H6 video. One pair is enough for
the pitch; a second pair only if the build is green.
