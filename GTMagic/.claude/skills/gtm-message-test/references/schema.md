# Files

The shapes follow `docs/CONTRACTS.md` (written there in TypeScript); fields marked *proposed* are additions (see `method.md`). IDs refer to `intake.json`: `seg_`, `lex_` and `ev_` IDs are intake's own.

Differences from CONTRACTS.md that apply to every file here, because skills pass files rather than stored artifacts:
- No `Artifact` envelope. Each file carries `schemaVersion: 1` at the top, like `intake.json`, and quality warnings sit in a top-level `warnings` list where there are any.
- A top-level `_note` starting with `FAKE` marks generated test data.

## message-drafts.json (you write it)

Module-private, like CONTRACTS.md's `*Draft` schemas: options carry no IDs of their own.

```ts
interface MessageDrafts {
  options: Array<{
    angle: string; headline: string; subheadline: string;     // headline ≤ 10 words, subheadline ≤ 30
    targetSegmentIds: string[]; lexiconIds: string[];          // ≥ 1 lexicon phrase the copy borrows
    evidenceIds: string[];
    valueProposition: string; differentiator: string; callToAction: string; assumptions: string[];
  }>;                                                          // 6–8, best first; extras are spares
}
```

## positioning-set.json (`build_test.py`)

CONTRACTS.md `PositioningSet`, round 1.

```ts
interface PositioningSet {
  schemaVersion: 1;
  round: 1;
  hypotheses: PositioningHypothesis[];   // generated + founder-current (if given) + decoy = 6
  warnings?: string[];                   // what the checks dropped or flagged (the envelope's warnings, without the envelope)
}
// PositioningHypothesis as in CONTRACTS.md, plus source "decoy" (proposed; a contract change).
// IDs hyp_1… are assigned by the script. The current message and decoy have empty
// targetSegmentIds, lexiconIds and evidenceIds.
```

## experiment-request.json (`build_test.py`)

CONTRACTS.md `ExperimentRequest`: `schemaVersion: 1`, `id: "exp_1"`, `round: 1`, `scenario { context, decision, channel }`, `stimuli [{ label, candidateId, text }]`, `orderings` (a Williams Latin square of labels: see "For the simulation skill"), `repeatCustomerIds`, `protocol { version, instructions, dimensionDefinitions }`, plus `fingerprint` (Addition, optional): 12 hex characters computed by code from everything else in the request (scenario, stimuli, orderings, repeat customers, protocol). It's opaque: compare it for equality, never recompute it. Skill files have no artifact envelope and IDs repeat when the test is rebuilt, so this is what tells answers to an older build apart.

## For the simulation skill

How to run the test in `experiment-request.json`, so the scoring can trust the answers:

1. **Orderings:** within each customer group, the *j*-th customer (counting from 0, in the order of `audience-sample.json`) sees `orderings[(⌊s × k / S⌋ + j) % k]` (`scripts/ordering.py` → `ordering_index`). *k* is the number of orderings; *s* is the group's position (from 0) among the groups that have at least one customer in `audience-sample.json`, in intake.json `segments[]` order; *S* is how many such groups there are. *j* depends only on the customer's position, so a skipped or retried call keeps its `orderingIndex`. Record that index as `orderingIndex`. Counting within each group means every group with at least *k* customers sees every ordering; starting each group at an evenly spaced row spreads the leftover customers, so with equal-sized groups the whole sample sees every ordering within one of equally often (unequal sizes drift a little: 48 customers over 5 groups and 6 orderings gives 7–9 showings). Counting across the whole sample instead can give one group only half the orderings when groups alternate.
2. **What each customer sees:** `scenario.context`, `scenario.decision`, `protocol.instructions` and `protocol.dimensionDefinitions`, then each stimulus in that ordering, then "none of these". Letter the options by **display position** (the first one shown is always "A") and map the letters back to stimulus labels in code, so a model's habit of favouring "A" doesn't land on the same option every time. **Never** show `candidateId`, the hypothesis `angle` or `source`, or which option is the owner's or the decoy.
3. **Answers:** the model answers by label; code maps labels to `candidateId`. A refusal or unusable answer becomes `status: "skipped"` with a `skipReason`, never a guess.
4. **Repeats:** each customer in `repeatCustomerIds` is asked again, in a separate call, with the same ordering **reversed**. Record the second answer with `isRepeat: true` and the same `orderingIndex`. If you resume interrupted runs by key, include `isRepeat` in the key (ARCHITECTURE.md's key is experimentId, customerId, orderingIndex, which would skip the repeat). If `repeatCustomerIds` is empty (no audience sample was ready when the test was built), repeat 10 customers taken round-robin across groups.
5. **Group sizes:** either equal numbers per group (CONTRACTS.md's `balanced` default) or intake's `sampleShare`. Every count is reported with its `n`, so either works; say which in your output.

## customer-responses.json (the simulation skill writes it)

CONTRACTS.md `CustomerResponses`. What this skill relies on:

- `experimentId` matches the request; one main response per `customerId`, plus one with `isRepeat: true` for each repeat customer.
- `requestFingerprint` (top level) is copied from the request's `fingerprint`. `evaluate.py` refuses a mismatch (answers to an older build) and warns when it's missing.
- `segmentId` is an intake segment ID; `orderingIndex` is the ordering the customer saw.
- `status: "answered"` responses have:
  - `choice` = a `candidateId` that was shown, or `"none"`, mapped from the label by code;
  - `ratings` for shown candidates, each with all five dimensions as integers 1–5.
  Anything else is counted as skipped `invalid-output`.
- `objections: [{ candidateId | null, text }]` (simulated; shown only as labeled simulated quotes).
- `_note` starting with `FAKE` marks generated test data, so every output says so.

## themes.json (you write the tags; code counts)

```ts
interface Themes {
  themes: Array<{ id: string; theme: string }>;                               // th_<word>, one plain sentence
  tags: Array<{ responseId: string; objectionIndex: number; themeId: string }>;  // one per objection, from --list-objections
}
```

## experiment-results.json (`evaluate.py`)

Carries `schemaVersion: 1`, and `_note` starting with `FAKE` when it was computed from FAKE responses, so a UI can tell.

CONTRACTS.md `ExperimentResults`: `experimentId`, `protocolVersion`, `answered`, `skipped`, `candidates[]` (`choiceCount`, `preferenceShare`, `dimensionMeans`, `segmentBreakdown`, plus `preferenceRange` *proposed*: a 90% Wilson interval for the share), `noneCount`, `segmentRanking[]` (`bestCandidateId` is `"none"` when nobody in the group chose a message), `icpVerdict`, `stability { bootstrapWinnerRate, repeatConsistency }`, `confidenceFlags[]`, `objectionThemes[]`, `limitations[]`.

Proposed additions: `messageVerdict` (`clear-winner` | `no-clear-winner` | `unreliable`), `recommendedCandidateId` (set only for a clear winner, never the decoy), and `checks [{ id: "decoy" | "winner" | "current-message" | "interest" | "consistency" | "customer-group" | "sample-size", status: "pass" | "warn" | "fail", detail }]`.
