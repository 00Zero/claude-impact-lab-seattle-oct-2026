import { notFound } from "next/navigation";
import { readBusiness } from "@/app/_intake/workspace";
import { SavedRun } from "@/components/run/SavedRun";
import { Rail } from "@/components/shell/Rail";
import { Legend } from "@/components/shell/Legend";
import { Notice } from "@/components/turns/Notice";
import { DemoReplay } from "@/components/run/DemoReplay";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ business: string }>; searchParams: Promise<{ replay?: string; nolinks?: string }> };

export default async function RunPage({ params, searchParams }: Props) {
  const { business } = await params;
  const sp = await searchParams;
  const r = await readBusiness(business);
  if (!r) notFound();
  if ("error" in r) {
    return (
      <div className="app">
        <Rail />
        <main className="main"><div className="thread">
          <Notice title={r.error} tone="error"><ul className="open">{r.issues.map((i) => <li key={i}>{i}</li>)}</ul></Notice>
        </div></main>
      </div>
    );
  }
  const hideLinks = sp.nolinks !== undefined;
  if (business === "demo" && sp.replay !== undefined) return <DemoReplay brief={r.brief} hideLinks={hideLinks} />;
  return (
    <div className="app">
      <Rail badge={r.brief.mode === "demo" ? "Example · fictional data" : undefined}><Legend segments={r.brief.segments} /></Rail>
      <main className="main"><SavedRun slug={business} brief={r.brief} warnings={r.warnings} hideLinks={hideLinks} /></main>
    </div>
  );
}
