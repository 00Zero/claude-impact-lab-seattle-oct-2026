# platform

**Owner:** Lead · **Design:** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) → Orchestrator, AI client, Storage

Shared infrastructure that every step uses. Steps get it through `StepContext`; they never build their own. Every file imports `server-only`, so nothing here can leak into the browser.

## Layout (at scaffold time)

```
ai/              AiClient: the only place an Anthropic client is created
                 parse(), research() → CitedNotes, process-wide limiter, retry-once,
                 refusals + fallback, pause_turn, tool caps, cache warm-up, cost + budget caps, calls.jsonl
orchestrator/    {name, round} steps, persist-then-advance, per-run lock, retry rules,
                 boot sweep (INTERRUPTED), live-run cap + queue, mock/live switch, bindFixture()
store/           ArtifactStore (artifacts by ID) + per-run write queue (atomic temp+rename) + retention sweep
env/             Zod-validated env config (fails fast at boot)
ids/             IdAllocator: ctx.ids.next("cust") → deterministic, run-unique
privacy/         scrubPii(): emails, phone numbers, @handles
log/             structured logger ({ runId, step, round, event, ... })
rate-limit/      per-IP limiter + X-Team-Token bypass
```

## The API steps use (frozen in hour 1 of CP1)

```ts
interface StepContext { runId: string; round: 1 | 2; ai: AiClient; ids: IdAllocator; log: Logger; seed: number; signal: AbortSignal }

interface AiClient {
  // Structured output into a module's *Draft schema; throws AiCallFailed after one retry.
  parse<T>(schema: ZodType<T>, req: AiRequest): Promise<T>;
  // Web-search call; returns prose plus the raw citation objects that code turns into Evidence.
  research(req: AiRequest): Promise<CitedNotes>;
  // One call per distinct prompt prefix before a concurrent fan-out.
  warmCache(reqs: AiRequest[]): Promise<void>;
}

interface CitedNotes {
  text: string;
  citations: Array<{ url: string; title?: string; citedText: string }>;
}

// AiRequest names the step, so model, effort and prompt version come from config, not the caller.
```
