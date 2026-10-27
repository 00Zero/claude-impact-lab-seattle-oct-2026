/* Past campaigns, judged by the script. Cost per sign-up = spend ÷ sign-ups (code); missing figures say so. */
import { money, num } from "@/app/_intake/format";
import { PLAIN } from "@/app/_intake/labels";
import type { Business, PriorExperiment } from "@/app/_intake/schema";
import { Tag } from "../evidence/Tag";
import { PlateFrame } from "./PlateFrame";

function targetLine(b: Business): string {
  const cur = b.pricing?.currency ?? "USD";
  const used = b.unitEconomics?.targetCpaUsed ?? b.targetCpa ?? null;
  if (used == null) return "No limit on cost per sign-up yet, so every result is too early to tell.";
  return b.unitEconomics?.targetCpaSource === "derived"
    ? `Judged against ${money(used, cur)}, the most you can spend per paying customer, worked out from your numbers.`
    : `Judged against your target of ${money(used, cur)} per paying customer.`;
}

const NR = "not recorded";

export function AdsPlate({ experiments, business, updated }: { experiments: PriorExperiment[]; business: Business; updated?: boolean }) {
  if (experiments.length === 0) return null;
  const cur = business.pricing?.currency ?? "USD";
  const files = [...new Set(experiments.flatMap((p) => (p.sourceFile ? [p.sourceFile] : [])))];
  return (
    <PlateFrame title={experiments.length === 1 ? "Your past campaign" : `Your ${experiments.length} past campaigns`} label="Your past ads" updated={updated}
      meta={`${targetLine(business)}${files.length ? ` From ${files.join(", ")}.` : ""}`}>
      <table className="board">
        <thead><tr><th>Ad</th><th className="num">Spent</th><th className="num hide-sm">Clicks</th><th className="num">Sign-ups</th><th className="num">Per sign-up</th></tr></thead>
        <tbody>
          {experiments.map((p) => {
            const { clicks, conversions } = p.metrics;
            const per = p.spend != null && conversions ? p.spend / conversions : null;
            const how = [PLAIN.channel[p.channel], p.conversionType ? PLAIN.conversionType[p.conversionType] : null, p.source === "manual" ? "Typed in by you" : null].filter(Boolean).join(" · ");
            return (
              <tr key={p.id}>
                <td>
                  <span className="strong">{p.message.headline ?? p.audience}</span>
                  <span className="sub">{p.audience}{how ? ` · ${how}` : ""}</span>
                  <span className="sub"><Tag text={PLAIN.adVerdict[p.verdict]} variant={`v-${p.verdict}`} /> {p.verdictReason ?? ""}</span>
                </td>
                <td className="num">{p.spend != null ? money(p.spend, cur) : NR}</td>
                <td className="num hide-sm">{clicks != null ? num(clicks) : NR}</td>
                <td className="num">{conversions != null ? num(conversions) : NR}</td>
                <td className="num">{per != null ? money(per, cur) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PlateFrame>
  );
}
