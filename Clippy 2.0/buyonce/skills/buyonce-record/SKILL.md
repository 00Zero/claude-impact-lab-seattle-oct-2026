---
name: buyonce-record
description: Turn an owner's recorded or narrated purchase on a vendor website into a reusable purchasing skill. Use when the owner says they recorded a task, wants Claude to learn how they order from a supplier, asks to turn a screen recording, shortcut, transcript, step list, or screenshots into a skill, or wants to add a new vendor. Captures the intent (not click coordinates), interviews the owner for their buying rules, strips credentials, writes skills/<vendor>-buy/SKILL.md from the template, and lints it.
---

# BuyOnce: learn a purchase from one demonstration

The owner shows you how they buy from a vendor, once. You turn that into a plain-text skill any agent can follow. The skill file is the product: the owner can open it, read it, and fix a line without touching code.

## Where recordings come from

Any of these works. Ask which the owner used, or take whatever they attached:

- **Claude Cowork "Record a skill"**: screen recording plus narration (desktop app, "+" menu).
- **Claude in Chrome "Teach Claude"**: a recorded browser workflow saved as a shortcut.
- **A narrated transcript**, a **step list**, or **screenshots** pasted into chat.
- **Nothing yet**: give the owner the narration guide below and ask them to record or write the steps.

## Narration guide to give the owner

Ask them to say these things out loud (or write them) while they buy something small and ordinary:

1. "I'm buying **{what}** from **{vendor}** because **{why}**." (the goal)
2. "I'm picking this one because **{reason}**." (every choice: size, brand, sort order)
3. "I'd never buy this if **{condition}**." (their deal-breakers)
4. "This is the page where I check **{price / delivery / stock}**." (the quote step)
5. "This is the point where I'd stop and think / ask someone." (the approval point)

The **why** is the valuable part. Clicks break when a site changes; reasons don't.

## Procedure

### 1. Extract intent, not clicks
From the material, list:
- **Goal** in one sentence.
- **Parameters**: what changes each time (item, quantity, deadline, delivery address, shipping speed).
- **Steps** written as intent: "Add {item} to the cart", never "click at (412, 96)". Mention a visible label or role only as a hint to find the control.
- **Where the quote lives**: which page shows price, shipping, tax, delivery date, stock.
- **Stop points**: where the skill must stop for the owner (always: before the final submit/pay).
- **Quirks**: logins, pop-ups, cookie banners, "are you sure" dialogs.

### 2. Interview the owner for their rules (one message, max five questions)
Skip any already answered in `policy/policy.toml` or the narration.
1. Which vendors are approved, and are any blocked?
2. Biggest order you'd allow? Anything you'd approve without being asked?
3. Minimum vendor rating, if any?
4. How firm are deadlines (a day late OK, or never)?
5. What's your monthly budget for this category, and where does it live (accounting tool, spreadsheet)?

Put the **rules** in `policy/policy.toml` (shared across vendors). Put only **site-specific how-to** in the vendor skill. If the owner records the same purchase on a second vendor, move anything that repeats into the policy.

### 3. Sanitize
Remove from your notes and from the skill: passwords, card numbers, bank details, API keys, one-time codes, personal phone numbers or emails that aren't needed. Replace logins with: "The owner's browser profile is already signed in; if it isn't, ask the owner to sign in themselves."

### 4. Write the skill
Copy `templates/purchasing-skill.template.md` to `skills/<vendor>-buy/SKILL.md` and fill every section. The folder name, the `name:` field, and the heading must agree (kebab-case, e.g. `harvest-wholesale-buy`). Keep the `<!-- buyonce:purchasing-skill -->` marker; the linter uses it.

Write the `description` so a different agent could tell, from that sentence alone, when to use this skill and for which vendor.

### 5. Lint
```bash
python3 tools/lint_skill.py skills/<vendor>-buy
```
Fix every FAIL.

### 6. Safe dry run
Run only the **quote phase** on the live site, with the owner watching if they want. It reads prices and puts nothing in a cart. If a step drifted, fix the skill. Do not run checkout during a dry run.

### 7. Report
Tell the owner in three lines: the skill's name and path, what it can do now (e.g. "get a quote and fill the cart, then stop"), and what you couldn't verify. Offer to record a second vendor so BuyOnce can compare.
