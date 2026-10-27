# Judging criteria and where we stand

Five criteria, equal weight, each 1 to 8. The aim is to be honest about each one.

| Criterion | What a 7-8 looks like | What we have | Gap to close |
|---|---|---|---|
| **Does it work** | Works end to end; a business could try it today | Comparison, gate, linter, preflight, and run controller work end to end against a scripted agent, with 49 passing tests | Run the controller with a live browser agent on a real or practice site; run the Stripe test card once; plug in the capture teammate's first real skill |
| **Ease of implementation** | Plug-and-play; clear README; no code needed | Plain-text policy and skills; stock Python only; README with a 30-second demo and setup steps | Verify the install steps on a clean machine; consider a first-run that writes the policy |
| **Impact on operations** | Changes how a core part of the business runs | Replaces the vendor-site loop for recurring supplies; adds budget and stock awareness and an audit trail | Get one real owner's numbers (hours saved, dollars saved vs. cheapest sticker price) |
| **Creativity** | Something judges hadn't thought of | The buying judgment on top of record-and-replay: explains why it *didn't* pick the cheapest, budget-aware, single-use spend cap | Cross-vendor demo with two real recorded sites |
| **Teamwork** | Every member had a distinct, visible role, and the team shows how they worked together | Roles and decisions log in `docs/TEAM.md`; each role has files it owns | Fill in names, keep the decisions log current, show the process in the pitch |

## Where judges may push
- "Record and replay already exists." Yes. We use it. The new part is everything after: rules, comparison, budget, approval, and a spend cap.
- "Does it actually buy things?" Today it runs the decision and approval parts end to end and drives checkout through the vendor skill. Show the live-browser run only after it has been rehearsed.
- "What if the AI is wrong?" Policy cap, human approval, and a single-use card cap, in that order.
