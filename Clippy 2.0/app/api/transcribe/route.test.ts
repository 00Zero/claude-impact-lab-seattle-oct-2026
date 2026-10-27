import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function request(audio?: Blob, name = "voice.webm") {
  const form = new FormData();
  if (audio) form.append("audio", audio, name);
  return new Request("http://localhost/api/transcribe", { method: "POST", body: form });
}

const voice = () => new Blob([new Uint8Array(2000).fill(1)], { type: "audio/webm" });

describe("POST /api/transcribe", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("rejects a request with no audio", async () => {
    expect((await POST(request())).status).toBe(400);
  });

  it("rejects a file that is not audio", async () => {
    const res = await POST(request(new Blob(["hi"], { type: "image/png" }), "x.png"));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says voice is not set up when the key is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const res = await POST(request(voice()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("not set up");
  });

  it("returns the trimmed transcript and calls Scribe correctly", async () => {
    fetchMock.mockResolvedValue(Response.json({ text: " 2 cases hot cups ", language_code: "eng", words: [] }));
    const res = await POST(request(voice()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "2 cases hot cups" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(init.headers["xi-api-key"]).toBe("test-key");
    const body = init.body as FormData;
    expect(body.get("model_id")).toBe("scribe_v2");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("hides upstream errors behind a friendly message", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const res = await POST(request(voice()));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("test-key");
  });

  it("asks to try again when nothing was heard", async () => {
    fetchMock.mockResolvedValue(Response.json({ text: "   " }));
    expect((await POST(request(voice()))).status).toBe(422);
  });
});
