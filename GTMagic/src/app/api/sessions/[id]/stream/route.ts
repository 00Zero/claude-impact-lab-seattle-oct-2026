import { stat } from "node:fs/promises";
import { join } from "node:path";
import { intakePath } from "@/app/_intake/workspace";
import { readSession, sessionDir } from "@/app/_session/store";

export const dynamic = "force-dynamic";

const POLL_MS = 1000;
const PING_MS = 15_000;

/** Server-sent events: `update` whenever the transcript or the linked save file changes. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dir = sessionDir(id);
  if (!dir) return new Response("Not found", { status: 404 });

  const mtimeOf = async (p: string | null) => (p ? (await stat(p).catch(() => null))?.mtimeMs ?? 0 : 0);
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let last = "";
      let sincePing = 0;
      let closed = false;
      const send = (event: string, data: string) => {
        if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      const tick = async () => {
        const s = await readSession(id);
        const key = `${await mtimeOf(join(dir, "transcript.jsonl"))}:${await mtimeOf(s?.business ? intakePath(s.business) : null)}`;
        if (key !== last) {
          last = key;
          send("update", JSON.stringify({ key }));
        }
        sincePing += POLL_MS;
        if (sincePing >= PING_MS) {
          sincePing = 0;
          send("ping", "{}");
        }
      };
      void tick().catch(() => undefined);
      timer = setInterval(() => void tick().catch(() => undefined), POLL_MS);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* the client already went away */ }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
