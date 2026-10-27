# GTMagic: rules for Claude Code sessions

Helps small businesses and founders find who to target and what to say, using a synthetic audience grounded in real customer quotes. Read `docs/ARCHITECTURE.md` and `docs/CONTRACTS.md` before changing code.

## Boundaries (most important)

- Work only inside the folders the user owns (see `docs/COLLABORATION.md` → "Who owns what"). Ask before touching any other folder.
- A module in `src/modules/<name>/` may import only `@/contracts` and `@/platform/*`. Never import another module's files.
- Do not change `src/contracts/` unless the user says this is a contract change; follow the contract-change process in COLLABORATION.md.
- Every Claude API call goes through `src/platform/ai`. Never construct an Anthropic client inside a module.

## Grounding and honesty

- Code builds `Evidence` from citation objects or founder text. Never let model output become a quote, a URL, or an ID.
- Each LLM call parses into a module-private `*Draft` schema; code maps it to the contract and runs the validators.
- Recommendations are computed from counts in code; the model only explains them.
- Simulated words and numbers are always labeled "simulated." Never call them conversion rates, "validated," or style them like real quotes.
- Generated copy: no testimonials, invented statistics, superlatives, or competitor names; label it as a draft.

## Conventions

- TypeScript strict. No `any`, no `unknown`, no untyped `Record<string, …>`.
- Contract types come from the Zod schemas (`z.infer`). Never redefine them by hand.
- Count thresholds are warnings, not failures. A run must survive individual failed LLM calls.
- Every step has a mock that returns its fixture (via `bindFixture()`). Keep it working.
- Keep files under 300 lines. Prompts live in `prompts.ts` next to the step, each with a `PROMPT_VERSION` constant; bump it whenever the prompt text changes.
- Don't send `temperature`, `top_p`, or `top_k` (the API rejects them). Set `output_config.effort` explicitly.

## Commands

_Added at scaffold time:_ `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run step -- <step> --from fixtures/demo`.
