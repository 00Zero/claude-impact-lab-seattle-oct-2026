import { stopAgent } from "@/app/_session/launcher";
import { sessionDir } from "@/app/_session/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sessionDir(id)) return Response.json({ error: "No such session" }, { status: 404 });
  return Response.json({ ok: stopAgent(id) });
}
