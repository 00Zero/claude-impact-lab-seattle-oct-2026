import { readBusiness } from "@/app/_intake/workspace";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const r = await readBusiness((await params).slug);
  return r ? Response.json(r) : Response.json({ error: "Not found" }, { status: 404 });
}
