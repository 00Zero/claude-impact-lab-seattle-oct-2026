# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS prototype for the first skeleton (user's choice), to settle the design before framework work. The planned production app is Next.js App Router + TypeScript, Tailwind optional (docs/TECH_STACK.md).

## Users

Small-business owners and founders who are launching something, or who suspect their pitch isn't reaching the right buyer: a bakery adding catering, a two-person software company, a local gym repositioning. They are busy, not marketers, and want plain answers rather than "AI personas." Secondary audience: hackathon judges opening the public URL cold, with no account, often on a phone.

## Product Purpose

Reduce the cost of being wrong about your market. GTMagic answers three questions: who to go after first, what to say to them, and what cheap real-world test to try this week. Success means an owner gets a clear, honest answer in under 4 minutes (or instantly from the example) and knows what to do next.

## Positioning

Not one model's opinion. Every insight links to a real source; the synthetic audience talks like real customers using cited quotes; the answer comes from blind, counted choices among competing messages (including the owner's current headline, with "none of these" allowed). Recommendations are computed from counts in code; the model only explains them. It will honestly say "your guess was right" when it is.

## Operating Context

The interface is a single chat-led run (confirmed): GTMagic asks about the business in a conversation, the owner answers or clicks Try an example, and research, the live crowd, the results and the report arrive as rich cards inside the thread. Follow-up questions about the results happen in the same chat. A live run takes about 2.5 minutes, so the thread must keep the owner oriented while steps progress. Runs are reached only by an unguessable link, expire after 7 days, and can be deleted by the owner.

## Capabilities and Constraints

- Inputs: business description (required, ≤ 4,000 chars); optional name, website, price, best-customer guess, current headline (+ subheadline), pasted reviews/emails (≤ 10,000 chars).
- Pipeline steps shown to the owner in plain English: intake, research, audience, messages, test, results, report.
- About 48 synthetic customers see 4–6 messages plus the owner's headline and pick one or "none of these." Live crowd: one dot per customer, colored by choice, filling in live. This is the signature visual.
- Results always show counts and n, never bare percentages, plus how consistent the result is and plain-word confidence flags.
- Terminology: "customer groups" not "segments"; "how customers talk" not "lexicon"; "how consistent the result is" not "stability"; no "ICP."
- Open source, free to use; no payments, no accounts, no login.
- Thin evidence (niche/local business) produces a clear warning and a suggestion to paste reviews, never an error.
- Privacy note on input: "Don't paste personal or confidential information."

## Evidence on Hand

The demo data is `fixtures/demo/intake.json` (Intake Brief schema v1, `.claude/skills/gtm-intake/references/schema.md`) for KeepStrong, a fictional GLP-1 strength app, with the owner's answers in `fixtures/demo/intake-script.md` and `meta-ads.csv`. Everything in it is fictional and labelled so. No real recorded run, real customer quotes or simulation output exist yet; the prototype's crowd choices are placeholders and must be labelled as such. Health-related quotes are not shown beside source links in demo recordings (`?nolinks`).

## Product Principles

1. Four kinds of evidence never mix: owner beliefs, research evidence, synthetic results, real-world results.
2. Real quotes are real: shown as quotes with a source link. Simulated words always look different and are labeled "simulated."
3. The numbers decide, the model explains.
4. Honest labels: confidence is "exploratory" or "research-backed," never "validated"; a simulated share is never a conversion rate.
5. Drafts, not claims: generated copy has no testimonials, invented statistics, superlatives or competitor names, and is labeled "Draft: verify before publishing."

## Accessibility & Inclusion

Must work on a phone. Plain English throughout. Every data-fetching view has loading, empty and error states. Generated copy is rendered as text, never raw HTML.
