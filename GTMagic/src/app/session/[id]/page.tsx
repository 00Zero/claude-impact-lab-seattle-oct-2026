import { notFound } from "next/navigation";
import { sessionDir } from "@/app/_session/store";
import { LiveSession } from "@/components/session/LiveSession";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ nolinks?: string }> };

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { nolinks } = await searchParams;
  if (!sessionDir(id)) notFound();
  return <LiveSession id={id} hideLinks={nolinks !== undefined} />;
}
