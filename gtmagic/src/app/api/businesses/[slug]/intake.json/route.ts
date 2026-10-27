import { readFile } from "node:fs/promises";
import { intakePath } from "@/app/_intake/workspace";

export const dynamic = "force-dynamic";

/** The original save file, byte for byte (never the parsed object). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const path = intakePath((await params).slug);
  const bytes = path ? await readFile(path).catch(() => null) : null;
  if (!bytes) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="intake.json"' },
  });
}
