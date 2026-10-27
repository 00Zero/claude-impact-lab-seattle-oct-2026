// Speech to text for the shopping list: the browser records, ElevenLabs Scribe transcribes.
// No `runtime` export: cacheComponents rejects it, and Node.js is already the default.
export const maxDuration = 40;

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL = "scribe_v2";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

const NOT_SET_UP = "Voice input is not set up yet. Type your list instead.";
const NOTHING_HEARD = "Clippy didn't catch that. Try again a bit closer to the mic.";
const GENERIC_ERROR = "Clippy could not turn your voice into text. Please try again or type your list.";

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Send a voice recording.", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return fail("Send a voice recording.", 400);
  if (!audio.type.startsWith("audio/")) return fail("The recording must be an audio file.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return fail("That recording is too long. Keep it under a minute.", 400);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return fail(NOT_SET_UP, 503);

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "voice");
  upstream.append("model_id", MODEL);
  upstream.append("tag_audio_events", "false");

  try {
    const res = await fetch(ELEVENLABS_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("elevenlabs transcribe failed: status", res.status);
      return fail(GENERIC_ERROR, 502);
    }
    const data = (await res.json()) as { text?: unknown };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) return fail(NOTHING_HEARD, 422);
    return Response.json({ text });
  } catch (err) {
    console.error("elevenlabs transcribe failed:", err instanceof Error ? err.name : "unknown");
    return fail(GENERIC_ERROR, 502);
  }
}
