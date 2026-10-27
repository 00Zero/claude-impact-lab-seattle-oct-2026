import type { FitTier } from "@/lib/contracts";
import type { ExplorerAssessment, ExplorerOpportunity } from "./types";

/** What the explorer may say about fit. Unassessed is a state, never a tier (SRS 11.3). */
export type FitDisplay = { kind: "assessed"; tier: FitTier } | { kind: "pending" } | { kind: "unavailable" } | { kind: "not_assessed" };

const NOT_ASSESSED: FitDisplay = { kind: "not_assessed" };

/**
 * Indexes assessments for the active profile revision only. Older revisions,
 * and assessments of an outdated opportunity version, are dropped so a late
 * response can never relabel newer results (SRS REC-07).
 */
export function indexCurrentAssessments(
  assessments: Iterable<ExplorerAssessment>,
  revision: number,
  opportunities: readonly Pick<ExplorerOpportunity, "id" | "version">[] = [],
): ReadonlyMap<string, FitDisplay> {
  const versions = new Map(opportunities.map((o) => [o.id, o.version]));
  const index = new Map<string, FitDisplay>();
  for (const a of assessments) {
    if (a.profileRevision !== revision || index.has(a.opportunityId)) continue;
    const current = versions.get(a.opportunityId);
    if (current != null && a.opportunityVersion && current !== a.opportunityVersion) continue;
    if (a.state === "pending") index.set(a.opportunityId, { kind: "pending" });
    // An "assessed" record without a tier is not evidence of any tier.
    else if (a.state === "assessed" && a.tier) index.set(a.opportunityId, { kind: "assessed", tier: a.tier });
    else index.set(a.opportunityId, { kind: "unavailable" });
  }
  return index;
}

export function fitFor(index: ReadonlyMap<string, FitDisplay>, opportunityId: string): FitDisplay {
  return index.get(opportunityId) ?? NOT_ASSESSED;
}

/** Counts assessed tiers among a set of opportunities; everything else is unassessed. */
export function tallyFit(index: ReadonlyMap<string, FitDisplay>, opportunityIds: readonly string[]) {
  const counts: Record<FitTier | "unassessed", number> = { good_fit: 0, possible_fit: 0, needs_review: 0, not_a_fit: 0, unassessed: 0 };
  for (const id of opportunityIds) {
    const fit = fitFor(index, id);
    counts[fit.kind === "assessed" ? fit.tier : "unassessed"] += 1;
  }
  return counts;
}
