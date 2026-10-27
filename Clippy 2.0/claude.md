# Clippy 2.0 — hackathon. Code freeze 4:45 pm today.
A website where a small-business owner uploads a supply invoice photo or types a shopping list.
Clippy researches the same items at real stores with Tavily, calculates the real cost per unit
including shipping, and shows where each item is cheapest and how much the owner saves per order,
per month and per year, with a link to buy. Clippy never buys.

Stack: Next.js App Router + TypeScript + Tailwind. @anthropic-ai/sdk, @tavily/core, zod. Dev: tsx, vitest, @playwright/test.
Models: claude-sonnet-5-5 (invoice reading, offer extraction), claude-haiku-5-5 (list parsing, suggestions).

PARALLEL WORK: 6 agents (A–F) work at the same time. 
- Edit ONLY the files your prompt says you own. Do not install packages. Do not change lib/types.ts.
- If you need something from another agent's file, import it by the signature in your prompt. If it does not exist yet, use lib/mocks.ts (owned by Agent D).
- Never print or commit API keys.

Rules: all money math in lib/compare.ts; never guess a price; every price has a source URL and a date;
forced tool (tool_choice) + zod for every structured Claude output; keep code simple; test your part before you finish.