# Demo fixtures

One complete, hand-checked set of artifacts for the **demo business** (still to be chosen; see REQUIREMENTS.md → Open questions). Mocks return these files (rebound to real inputs by `bindFixture()`), the UI builds against them, and each step's tests use them as input. `npm run step -- <step> --from fixtures/demo` loads inputs from here by kind.

**Each owner writes their own fixture at CP1**, right after the lead merges the contracts:

| File | Written and kept valid by |
|---|---|
| `business-brief-input.json`, `business-brief.json` | Market Intelligence |
| `market-model.json` | Market Intelligence |
| `audience-sample.json` | Audience |
| `positioning-set.json` | Positioning & Experiments |
| `experiment-request.json` | Positioning & Experiments |
| `customer-responses.json` | Audience |
| `experiment-results.json` | Positioning & Experiments |
| `gtm-report.json` | Market Intelligence & Strategy |

Every file must pass its Zod schema and the validators, and CI checks this. The real recorded run used by **Try an example** lives separately in `fixtures/recorded-run/`.
