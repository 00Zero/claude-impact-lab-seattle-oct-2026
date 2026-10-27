import { appendAnswer, askIsOpen, checkUpload, saveUpload, sessionDir } from "@/app/_session/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sessionDir(id)) return Response.json({ error: "No such session" }, { status: 404 });
  const form = await req.formData();
  const askId = String(form.get("askId") ?? "");
  const text = String(form.get("text") ?? "").slice(0, 10_000);
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!askIsOpen(id, askId)) return Response.json({ error: "That question is already answered or closed." }, { status: 409 });
  for (const f of files) {
    const check = checkUpload(f);
    if (check === "too-large") return Response.json({ error: `${f.name} is over 10 MB.` }, { status: 413 });
    if (check === "bad-type") return Response.json({ error: `${f.name} isn't a file type GTMagic reads.` }, { status: 415 });
  }
  const saved: string[] = [];
  for (const f of files) {
    const p = await saveUpload(id, f);
    if (p) saved.push(p);
  }
  const result = appendAnswer(id, askId, text, saved);
  if (result === "ok") return Response.json({ ok: true });
  if (result === "no-session") return Response.json({ error: "No such session" }, { status: 404 });
  return Response.json({ error: "That question is already answered or closed." }, { status: 409 });
}
