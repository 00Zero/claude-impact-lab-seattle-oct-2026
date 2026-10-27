## What changed and why

<!-- One or two sentences. Link the TASKS.md item if there is one. -->

## How I tested it

- [ ] `npm test` passes
- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] Ran my step with `npm run step -- <step> --from fixtures/demo` (if I changed a step)
- [ ] An all-mock run still completes in the browser

## Checks

- [ ] Only touches folders I own (or the owner is a reviewer)
- [ ] **Contract change?** If yes: labeled `contract-change`, fixtures + CONTRACTS.md updated, affected owners requested
- [ ] New env var? Added to `.env.example` with a comment
- [ ] New dependency? Lead agreed
- [ ] Prompt text changed? `PROMPT_VERSION` bumped
- [ ] No secrets, no `any`
