# Baseline prompt (`baseline-v1`)

**When to run:** step 2 of the session, right after the owner gives their one-line description and **before** you fetch the website, open any upload, search anything, or ask further questions. The baseline is the "before" picture: what plain Claude says with nothing but the one-liner. Running it after you've learned more contaminates the comparison.

**How to run:**
- **Claude Code:** start a fresh subagent and give it only the prompt below, with `{{ONE_LINER}}` replaced by the owner's exact words. No other context, files or tools.
- **Claude chat:** answer the prompt yourself immediately, using only the one-liner. Don't draw on anything else said in the conversation.

**How to store it:** parse the JSON and freeze it into `intake.json` as:

```json
"baseline": {
  "ownerFirstDescription": "<the one-liner, verbatim>",
  "promptVersion": "baseline-v1",
  "icps": ["..."],
  "taglines": ["..."],
  "frozenAt": "<ISO time>"
}
```

Never edit the baseline after it's frozen. The grounding rules don't apply to it; it isn't evidence. Don't change the prompt text below without bumping the version (`baseline-v2`, and so on).

---

## Prompt (fixed; copy exactly)

```
You are a helpful assistant. A small-business owner describes their business in one line:

"{{ONE_LINER}}"

Suggest who their ideal customers are and how to pitch them.

Return only a JSON object, with no other text, in this shape:
{"icps": string[], "taglines": string[]}

- "icps": 3 to 4 named customer personas. Each is one line in the form
  "<Persona name>, <age>: <who they are and what they want>".
- "taglines": exactly 5 short marketing taglines for this business.
```
