import { OnboardingError, placeFromMapsLink, researchRestaurant } from "@/lib/onboarding";

// POST { "link": "https://maps.app.goo.gl/…" }
// Streams newline-delimited JSON, one object per line:
//   { "type": "step", "message": "Searching the web: …" }
//   { "type": "profile", "profile": RestaurantProfile }   (last line on success)
//   { "type": "error", "message": "..." }                  (last line on failure)

export const maxDuration = 120;

export async function POST(req: Request) {
  let link: unknown;
  try {
    link = (await req.json())?.link;
  } catch {
    link = undefined;
  }
  if (typeof link !== "string" || !link.trim() || link.length > 2000) {
    return Response.json({ error: "Paste your restaurant's Google Maps link." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const place = await placeFromMapsLink(link);
        const profile = await researchRestaurant(place, send);
        send({ type: "profile", profile });
      } catch (err) {
        console.error("onboard failed", err);
        send({
          type: "error",
          message: err instanceof OnboardingError ? err.message : "We couldn't look up your restaurant. Please try again.",
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
