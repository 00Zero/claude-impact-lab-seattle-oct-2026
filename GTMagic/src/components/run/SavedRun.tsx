/* A saved business: every card from its save file, in story order. */
import type { IntakeBrief } from "@/app/_intake/schema";
import type { PlateId } from "@/app/_session/events";
import { Plate } from "../plates/Plate";
import { Notice } from "../turns/Notice";

const STORY: PlateId[] = ["baseline", "creatives", "economics", "ads", "constraints", "research", "evidence", "save"];

export function SavedRun({ slug, brief, warnings, hideLinks }: { slug: string; brief: IntakeBrief; warnings: string[]; hideLinks: boolean }) {
  return (
    <div className="thread">
      <div className="turn bot static">
        <p className="lede">{brief.business.name}</p>
        <p>{brief.business.description}</p>
      </div>
      {warnings.length > 0 ? (
        <Notice title="Some parts of this save file couldn't be shown.">
          <ul className="open">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      ) : null}
      {STORY.map((p) => <Plate key={p} plate={p} brief={brief} updated={false} hideLinks={hideLinks} downloadHref={`/api/businesses/${slug}/intake.json`} />)}
    </div>
  );
}
