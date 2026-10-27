/* Send the owner's answer; failures come back as plain words, never as a thrown error,
   so the composer can keep what the owner typed. */
export type PostResult = { ok: true } | { ok: false; error: string };

export async function postAnswer(id: string, askId: string, text: string, files: File[], fetchFn: typeof fetch = fetch): Promise<PostResult> {
  const form = new FormData();
  form.set("askId", askId);
  form.set("text", text);
  for (const f of files) form.append("files", f);
  try {
    const r = await fetchFn(`/api/sessions/${id}/answer`, { method: "POST", body: form });
    if (r.ok) return { ok: true };
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "That didn't send. Try again." };
  } catch {
    return { ok: false, error: "Couldn't reach the GTMagic app. Is it still running? Your answer is still in the box." };
  }
}
