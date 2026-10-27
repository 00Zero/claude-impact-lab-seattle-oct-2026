import { planEvent, PlannerError } from "@/lib/planner";

// POST { "request": "philosophy meetup for 8, Wednesday evening, under $30" }
// Streams newline-delimited JSON, one object per line:
//   { "type": "step", "message": "Searching spaces: found 3 matches" }
//   { "type": "plan", "plan": Plan }        (last line on success)
//   { "type": "error", "message": "..." }   (last line on failure)

export const maxDuration = 60;

const MAX_REQUEST_LENGTH = 1000;

export async function POST(req: Request) {
  let request: unknown;
  try {
    request = (await req.json())?.request;
  } catch {
    request = undefined;
  }
  if (typeof request !== "string" || !request.trim()) {
    return Response.json({ error: "Describe the event you want to plan." }, { status: 400 });
  }
  if (request.length > MAX_REQUEST_LENGTH) {
    return Response.json({ error: `Keep the description under ${MAX_REQUEST_LENGTH} characters.` }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const plan = await planEvent(request.trim(), send);
        send({ type: "plan", plan });
      } catch (err) {
        console.error("planEvent failed", err);
        send({
          type: "error",
          message: err instanceof PlannerError ? err.message : "The planner hit a problem. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
