# BizOS — Your AI Front Desk

**Built at the Claude Impact Lab hackathon, Seattle (Oct 24–25, 2026).**

## What it does

If you run a small business, every email, DM, invoice question, and new-hire
question lands on **you**. BizOS gives you an AI staff that handles them —
**following rules you wrote, not rules a vendor wrote.**

## How it works (3 steps)

1. **Write your rules once** — plain text files, one per department
   (`support.rules.md`, `sales.rules.md`, `accounting.rules.md`, `hr.rules.md`).
   Example rule: *"Never refund more than $200 without my approval."*
2. **Messages flow in from any channel** (email, WhatsApp, web form) →
   an Orchestrator AI reads each one and hands it to the right department AI.
3. **The department AI answers using only your rules** — and every answer
   cites the rule it followed. Money and safety limits are enforced by
   **code, not by the AI**, so they cannot be talked around. Anything the
   rules don't cover waits in your approval queue instead of being guessed.

Your corrections become new rules automatically — the system gets more
capable every week you use it.

## What's in this folder

- [`BIZOS_DESIGN.md`](./BIZOS_DESIGN.md) — the full design document
  (architecture, message format, trust & safety model, MVP plan).
  Reviewed adversarially by multiple AI models; v1.2 integrates the findings.

## Status

🔨 Working demo being built at the hackathon (Sun, Oct 25).
Demo link and setup guide will land here after the event.

---
*Team BizOS · Claude Impact Lab · Seattle*
