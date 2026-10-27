# Collaboration

How five people build one app without stepping on each other, while keeping the process light enough to work at 2am.

## The three rules

1. **Stay in your folders.** ESLint enforces the import boundaries. To change someone else's area, ask them in chat first.
2. **Talk through contracts.** Modules only import `@/contracts` and `@/platform/*`. Contract changes follow the process below.
3. **Main always runs.** Every step has a mock. Merge small and often; if your live code isn't ready, your step stays on mock.

## Before kickoff (planning only)

- [ ] **Ask the organizers, in writing:** are pre-written code and scaffolding allowed, or only planning? Until we hear back, this folder is planning docs only.
- [ ] Decide the roles, the demo business, the simulation model, and hosting (open questions in REQUIREMENTS.md).
- [ ] Buy API credits so the demo key isn't on the lowest rate tier. Create **separate dev and demo keys**, each with a spend limit.

## Day-0 checklist (Nick, at kickoff, not before)

- [x] Create the GitHub repo `GTMagic` (public) and push the planning docs, including each module folder's README, as the first commit. The README's "Planned before the event" section says what was prepared in advance.
- [ ] Each owner's first PR adds **their own** module's code scaffold, so ownership shows in the history from the first hour.
- [ ] Add the 4 teammates as collaborators (Write access).
- [ ] Protect `main`: require a PR and passing CI; no force-push. Turn on "require review from code owners" (it only applies to `src/contracts/`; see CODEOWNERS).
- [ ] Replace the placeholder handles in `.github/CODEOWNERS`.
- [ ] Put the demo key and the team bypass token in the host's env vars; share the dev key privately.
- [ ] Post the repo link plus "read CONTRACTS.md first" in the team chat.

## Who owns what

| Path | Owner | Review needed? |
|---|---|---|
| `src/contracts/` | Lead | **Yes:** any teammate who isn't the author (CODEOWNERS) |
| `src/platform/`, `src/app/api/` | Lead | CI only |
| `src/app/` (pages), `src/components/` | Founder Experience | CI only |
| `src/modules/market-intelligence/`, `src/modules/reporting/` | Market Intelligence & Strategy | CI only |
| `src/modules/audience/` | Synthetic Audience | CI only |
| `src/modules/positioning/`, `src/modules/experiments/` | Positioning & Experiments | CI only |
| `fixtures/demo/<kind>.json` | Owner of the step that **produces** that artifact | CI only |
| `package.json`, lockfile, CI, config | Lead | CI only; tell the lead first |

Reviews outside `contracts/` are optional but encouraged: a quick 👀 from a teammate also shows teamwork in the history.

## Branches and PRs

- **Branch name:** `<your-name>/<short-topic>`, e.g. `maria/sampler-seeding`.
- **Small PRs:** under ~300 changed lines; merge at least twice a day.
- **Stay current:** `git pull --rebase origin main` before you push.
- **Squash-merge** once CI is green. Fill in the PR template; it takes 30 seconds.

## Changing a contract

1. Open a PR labeled `contract-change` that touches **only** `src/contracts/`, the affected fixtures, and CONTRACTS.md.
2. Prefer **additive** changes (new optional fields).
3. Post it in chat, tagging the owners who read that artifact. One non-author approval merges it.
4. Merge it *before* the PRs that use it.

## Conflict hot spots

| File | Rule |
|---|---|
| `package.json` / `package-lock.json` | Tell the lead before adding a dependency. On a lockfile conflict, take main's version and rerun `npm install`; never merge it by hand |
| `src/contracts/*` | Only via the contract process above |
| `.env.example` | Append only; every new variable gets a comment |
| `fixtures/demo/*` | Only the producing step's owner edits a fixture |

## Working on your step alone

You don't need the UI or anyone else's live code:

```bash
npm run step -- <step> --from fixtures/demo        # e.g. npm run step -- simulate --from fixtures/demo
npm run step -- <step> --from runs/<runId>         # rerun a step on a real run's saved artifacts
```

This loads the inputs your step needs (by artifact kind) from the folder, runs your step, validates the output, and prints it.

## Using Claude Code

The root `CLAUDE.md` holds these rules, so every teammate's Claude Code session follows the same boundaries. The lead owns it; keep it short.

## Syncs

- At each checkpoint (CP1/CP2/CP3): a 10-minute standup covering what's merged, what's blocked, and what's cut.
- Blocked for more than 30 minutes on someone else's piece? Say so in chat, switch to their mock, and keep going.

## After the hackathon

- [ ] Decide whether the demo URL stays up, who pays for it, and when it's shut down.
- [ ] Rotate or revoke the demo API key, and remove the host env vars if shutting down.
- [ ] Delete `runs/` on the host volume (founder data).
