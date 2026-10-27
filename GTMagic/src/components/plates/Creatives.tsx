/* What the owner already made: their own words, shown as owner text (never as a customer quote). */
import { money } from "@/app/_intake/format";
import { PLAIN } from "@/app/_intake/labels";
import type { Business, Creative } from "@/app/_intake/schema";
import { Tag } from "../evidence/Tag";
import { PlateFrame } from "./PlateFrame";

export function CreativesPlate({ creatives, business, updated }: { creatives: Creative[]; business: Business; updated?: boolean }) {
  if (creatives.length === 0) return null;
  const cur = business.pricing?.currency ?? "USD";
  return (
    <PlateFrame title="What you've already made" updated={updated} meta="Your own words, as you gave them. Results come from your campaigns, judged by code.">
      <ul className="lines creatives">
        {creatives.map((c) => (
          <li key={c.id}>
            <b>{c.format === "image" ? "Ad" : "Line"}</b>
            <div>
              {c.headline ? <span className="strong">{c.headline}</span> : null}
              {c.body ? <span className="sub">{c.body}</span> : null}
              {c.cta ? <span className="sub">Button: {c.cta}</span> : null}
              {c.imageDescription ? <span className="sub">Image (described): {c.imageDescription}</span> : null}
              <span className="borrowed">{[PLAIN.creativeStatus[c.status], c.channel ? PLAIN.channel[c.channel] : null].filter(Boolean).join(" · ")}</span>
              {c.performance ? (
                <span className="sub"><Tag text={PLAIN.adVerdict[c.performance.verdict]} variant={`v-${c.performance.verdict}`} />
                  {" "}{c.performance.costPerSignup != null ? `${money(c.performance.costPerSignup, cur)} per sign-up. ` : ""}{c.performance.verdictReason}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </PlateFrame>
  );
}
