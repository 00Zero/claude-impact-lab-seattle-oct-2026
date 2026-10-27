import { readBusiness } from "@/app/_intake/workspace";
import { agentState } from "@/app/_session/launcher";
import { readSession } from "@/app/_session/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession((await params).id);
  if (!s) return Response.json({ error: "Not found" }, { status: 404 });
  const r = s.business ? await readBusiness(s.business) : null;
  return Response.json({
    ...s,
    agent: agentState(s.id),
    brief: r && "brief" in r ? r.brief : null,
    briefUpdatedAt: r && "brief" in r ? r.updatedAt : null,
    briefIssues: r && "error" in r ? r.issues : [],
  });
}
