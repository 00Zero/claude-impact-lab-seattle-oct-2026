# Method

How the test is built and scored. **CONTRACTS.md** marks what follows `docs/CONTRACTS.md` and `docs/ARCHITECTURE.md` as written. **Addition** marks what's new in this skill. **Needs the lead's OK** marks proposals that change the agreed spec.

## Building the test (`build_test.py`)

- **Six options:**
  - 4 new options, the owner's current message and a decoy;
  - or 5 new options and the decoy when there's no current message.
  - Exits 1 unless intake.json is `ready`.
- **Drafts are checked in order and the first clean ones kept.** An option is dropped when it:
  - has no headline, or borrows no real customer phrase (a lexicon entry with `voice: "customer"`; gtm-intake tags the owner's own words `owner`);
  - lacks a subheadline while the others show one, or has a subheadline over 30 words;
  - breaks a messaging rule;
  - doesn't really use any customer phrase it cites: at least half of one cited phrase's key words must be in what customers see (gtm-intake's `uses_phrase`, copied exactly);
  - or repeats another headline, ignoring case and punctuation (the current message and the decoy included).
  Unknown segment, lexicon or evidence IDs are removed with a warning (CONTRACTS.md validator 1).
- **Messaging rules:**
  - gtm-intake's `MESSAGING_BANNED`, copied exactly. A test fails if they drift.
  - Its medical and drug rules apply only to health-related briefs, judged by the same signal gtm-intake uses. That keeps "Treat yourself" from blocking a bakery.
  - Plus, for every business: testimonials, ratings, superlatives, invented statistics and competitor names (the segments' `incumbents`).
  - Plus, for health briefs: condition names, weight-loss numbers and medical endorsements.
  - Numbers and time promises ("in 6 weeks") are cautions, not blocks.
  - The owner's own message is never dropped, only flagged.
- **Same shape (CONTRACTS.md):** every stimulus reads "Headline. Subheadline." in the same way, so punctuation can't single out the decoy. If the current message has no subheadline, every option shows its headline only.
- **Balance (Addition):** a warning when the new options are aimed unevenly at the customer groups. The group comparison mostly measures who the messages were written for.
- **The decoy (Addition; a contract change):** `The <category> for everyone` / `Everything you need, all in one place.`, built by code.
- **Labels and order:**
  - Labels A–F are shuffled with a seed derived from the options, so the decoy's label varies between businesses.
  - The orderings are a **Williams Latin square** (Needs the lead's OK; CONTRACTS.md says cyclic): every option appears in every position equally often, and right after every other option exactly once. A cyclic square always puts each option after the same neighbour.
  - Within each customer group, the *j*-th customer sees `orderings[(⌊s × k / S⌋ + j) % k]` (*s* among the *S* groups with customers in the sample): every group with at least *k* customers sees every ordering, and each group starts at an evenly spaced row so that, with equal-sized groups, the whole sample sees every ordering within one of equally often (plain `j % k` stacks every group's leftovers on the first rows: 9 vs 6 showings for 3 groups of 16 and 6 orderings). CONTRACTS.md change in #8.
- **Repeat subset (CONTRACTS.md):** 10 customers, round-robin across groups, chosen when `--audience` is given. Without it the simulation picks them.

## Scoring (`evaluate.py`, `stats.py`)

- **Validation (CONTRACTS.md validator 3):** a response counts as skipped `invalid-output` unless all of these hold:
  - its choice was shown;
  - its ordering exists;
  - every shown option has all five ratings as integers 1–5;
  - its segment is known.

  Repeats are kept apart.
- **Counts, shares and segment ranking (CONTRACTS.md):**
  - `preferenceShare` = chosen ÷ answered, with "none" in the denominator.
  - Segment `score = (1 − noneShare) × mean actionIntent of the chosen option ÷ 5`.
- **ICP verdict (CONTRACTS.md), with two safety rails (Addition):**
  - A tie doesn't count as `guess-holds`.
  - A group with fewer than 5 answers can't produce `different-segment`, and `guess-holds` needs the guess and every group it's compared with to have at least 5 (with nobody to compare against, it's `too-close-to-call`).
  - For `guess-holds`, a `customer-group` check reports how often the guess still came first in 500 reshuffles. Below 80%, it's a lead, not a finding.
- **Message verdict and checks (Addition):**
  - **Decoy** fails when it was chosen at least max(4, ⅔ × an average option's count). Its rank isn't used, so a couple of stray picks don't sink a strong result.
  - **Winner and current message:** the top option must be chosen more often than the runner-up, and more often than the current message, in ≥ 97.5% of 500 reshuffles. The top and runner-up are picked from the same data, so a nominal 95% bar behaves like 90%.
  - **Interest** blocks a winner when more than half chose "none", or "none" at least matched the top option.
  - **Consistency** blocks a winner when customers asked twice repeat their choice no more than luck plus 15 points, or when fewer than 5 were asked twice (no evidence isn't a pass). When one message is so popular that luck alone nearly guarantees a repeat, 9 in 10 repeating counts as steady; otherwise the bar would be over 100%.
  - **At least 30 answered.**
  - `clear-winner` requires all of these; `unreliable` means the decoy failed; anything else is `no-clear-winner`.
- **Ranges (Addition):** a 90% Wilson interval for each share, valid even at 0 of n: how much it could move with a fresh set of simulated customers from the same groups. It says nothing about real customers.
- **Stability (CONTRACTS.md):** the bootstrap winner rate and repeat consistency.
- **Confidence flags (CONTRACTS.md):**
  - `small-sample`: a group under 5 answers, including a group with none;
  - `everyone-agreed`: nobody chose none;
  - `nobody-interested`: over half chose none;
  - `unstable-winner`: bootstrap below 0.7;
  - `thin-evidence`: a group with fewer than 10 concern-tagged customer-voice excerpts (reviews and forum posts), counted exactly like gtm-intake;
  - `many-skipped`: over 10% skipped.
- **Objection themes:** Claude tags; code counts, warns about untagged objections, and copies up to 3 per theme as `simulatedQuotes`.

## What it can and can't detect (from simulation, 48 customers, 6 options)

| True situation | Result |
|---|---|
| One message at 40% vs 15% | Called a clear winner about 70% of the time |
| One message at 30% vs 18% | Called about 20% of the time; it needs ~150–200 customers |
| All options equal, or two tied | Called a winner in roughly 1.5–4% of runs |

Simulated customers can be more alike than real ones, so a lopsided result is a reason to test with real people, not proof.

## Needs the lead's OK

1. **`source: "decoy"`** on `PositioningHypothesis`. It widens an enum, so it's a contract change.
2. **Williams square and per-group ordering with offset start rows**, replacing the cyclic square and `orderings[i % k]` across the whole sample (in #8).
3. **ICP thresholds.** With truly equal groups, the agreed rules call `guess-holds` about 48% (2 groups) and `different-segment` about 14% of the time. Proposals:
   - require 95% of resamples for `different-segment`;
   - require the guess to come first in ≥ 80% for `guess-holds`;
   - allow at most 3 groups at 48 customers, or about 15 customers per group.
4. **ICP score.** Score each group on its highest would-act rating across all options, counting everyone, including those who chose none. The current score is mostly 1 − noneShare, because the chosen option's rating is high by construction.
5. **`everyone-agreed`:** fire below a 5% none-share rather than at exactly 0.
6. **Resume key:** include `isRepeat`. The current key would skip the repeat answer.
7. ~~**intake.json:** an optional `business.currentMessage { headline, subheadline }`.~~ Superseded: gtm-intake now stores the owner's ads and headlines in `creatives[]`, and `--current-creative` copies one by code. `business.currentMessage` is still read if present.

## Differences from CONTRACTS.md that need no OK

These follow because skills pass files rather than stored artifacts:
- No `Artifact` envelope; each file carries `schemaVersion: 1` and, where relevant, a top-level `warnings` list.
- `_note: "FAKE…"` marks generated test data.
- `bestCandidateId: "none"` when nobody in a group chose a message.
- Proposed optional result fields: `messageVerdict`, `recommendedCandidateId`, `checks`, `preferenceRange`.
