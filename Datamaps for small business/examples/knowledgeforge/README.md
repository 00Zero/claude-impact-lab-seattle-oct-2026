# Example: a consultant's second brain

A datamap of the 398 notes in the `wiki/` folder of
[KnowledgeForge](https://github.com/internexio/knowledgeforge) (commit `63ded33`),
the knowledge base of solo consultant David Pedersen (Internexio).

- [`map.html`](map.html): download and open in a browser.
- [`insights.md`](insights.md): the groups, what each one covers, and what to do with it.
- [`labels.json`](labels.json): the group names Claude wrote from the briefing.

Made with:

```
uv run datamap prepare ../knowledgeforge/wiki --out out/knowledgeforge
# Claude reads out/knowledgeforge/briefing.md and writes labels.json
uv run datamap render --out out/knowledgeforge
```

The map and report contain text from KnowledgeForge, which is
Copyright 2026 David Pedersen and licensed under the
[Apache License 2.0](https://github.com/internexio/knowledgeforge/blob/main/LICENSE).
