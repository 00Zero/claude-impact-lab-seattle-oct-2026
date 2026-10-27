import { listBusinesses } from "@/app/_intake/workspace";
import { listSessions } from "@/app/_session/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ businesses: await listBusinesses(), sessions: await listSessions() });
}
