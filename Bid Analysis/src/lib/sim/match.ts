import type { Agency, FitAssessment, FitStatement, FitTier, Opportunity, VendorProfile } from "../contracts";
import { categoryLabel } from "../taxonomy";

// SIMULATED MATCHING (development only). Stand-in for workstream B.
// Deterministic structured rules that follow the SRS 11.3 tier meanings so the
// UI can be exercised. It does no semantic or embedding matching, and it
// must never be presented as the real recommender.

export const SIM_RANKING_VERSION = "sim-rules-0.1";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const s = (text: string, profileFields: FitStatement["profileFields"] = []): FitStatement => ({ text, profileFields, evidence: null });

export function assess(o: Opportunity, p: VendorProfile, _agency: Agency | undefined, now = new Date()): FitAssessment {
  const reasons: FitStatement[] = [];
  const mismatches: FitStatement[] = [];
  const unknowns: FitStatement[] = [];
  const clar: string[] = [];
  let conflict = false;
  let review = false;
  let cap = false;

  // Scope
  const cats = o.workCategories.map((c) => c.id);
  const svc = p.coreServices.value ?? [];
  const excl = p.exclusions.value ?? [];
  const overlap = cats.filter((c) => svc.includes(c));
  const excluded = cats.filter((c) => excl.includes(c));
  const other = cats.filter((c) => !svc.includes(c) && !excl.includes(c));
  let scopeScore = 0;
  if (!cats.length) {
    review = true;
    unknowns.push(s("The listing doesn't describe the scope clearly enough to compare with your services."));
  } else if (excluded.length === cats.length) {
    conflict = true;
    mismatches.push(s(`This job is ${list(excluded.map(categoryLabel)).toLowerCase()} work, which you said you don't do.`, ["exclusions"]));
  } else if (!overlap.length) {
    conflict = true;
    mismatches.push(s(`The scope is ${list(cats.map(categoryLabel)).toLowerCase()}. Your confirmed services don't include it.`, ["coreServices"]));
  } else {
    scopeScore = overlap.length / cats.length;
    reasons.push(s(`Matches your ${list(overlap.map(categoryLabel)).toLowerCase()} services.`, ["coreServices"]));
    if (excluded.length) {
      cap = true;
      mismatches.push(s(`Part of the scope is ${list(excluded.map(categoryLabel)).toLowerCase()}, which you excluded. You may need a partner for that part.`, ["exclusions"]));
    }
    if (other.length) {
      cap = true;
      unknowns.push(s(`The job also includes ${list(other.map(categoryLabel)).toLowerCase()}, which isn't in your profile.`, ["coreServices"]));
      clar.push(`Add ${list(other.map(categoryLabel)).toLowerCase()} to your services if you do that work.`);
    }
  }

  // Geography (place of performance, with precision respected)
  const area = p.serviceArea.value;
  let geoScore = 0;
  const pinned = o.locations.filter((l) => l.countyNames.length);
  if (!area) {
    cap = true;
    unknowns.push(s("Your service area isn't set, so location wasn't compared.", ["serviceArea"]));
  } else if (o.locationStatus === "remote") {
    geoScore = 1;
  } else if (o.locationStatus === "statewide") {
    geoScore = area.kind === "statewide" ? 1 : 0.6;
    reasons.push(s(area.kind === "statewide" ? "Statewide work, and you serve the whole state." : "Statewide contract. Work orders can come from anywhere, including your counties.", ["serviceArea"]));
  } else if (!pinned.length) {
    review = true;
    unknowns.push(s("The listing doesn't say where the work happens.", ["serviceArea"]));
  } else if (area.kind === "statewide") {
    geoScore = 1;
    reasons.push(s(`Work is in ${list([...new Set(pinned.flatMap((l) => l.countyNames))])} County, inside your statewide service area.`, ["serviceArea"]));
  } else {
    const inside = pinned.filter((l) => l.countyNames.some((c) => area.counties.includes(c)));
    const counties = [...new Set(pinned.flatMap((l) => l.countyNames))];
    if (!inside.length) {
      conflict = true;
      mismatches.push(s(`Work is in ${list(counties)} County, outside your service area (${list(area.counties)}).`, ["serviceArea"]));
    } else if (inside.length < pinned.length) {
      geoScore = inside.length / pinned.length;
      cap = true;
      unknowns.push(s(`${inside.length} of ${pinned.length} work sites are inside your service area.`, ["serviceArea"]));
    } else {
      geoScore = 1;
      const approx = pinned.some((l) => l.precision === "city" || l.precision === "county");
      reasons.push(s(`Work is in ${list(counties)} County, inside your service area${approx ? ". The exact site isn't published" : ""}.`, ["serviceArea"]));
    }
  }

  // Published mandatory requirements. Unknown is not false.
  const tracked: Record<string, { field: "contractorRegistration" | "bonding" | "insurance"; name: string }> = {
    license: { field: "contractorRegistration", name: "an active Washington contractor registration" },
    bonding: { field: "bonding", name: "bonding for the bid" },
    insurance: { field: "insurance", name: "liability insurance" },
  };
  for (const r of o.requirements) {
    const t = tracked[r.category];
    if (t && r.mandatory) {
      const v = p[t.field].value;
      if (v === "no") {
        conflict = true;
        mismatches.push({ text: `The listing requires ${t.name}. Your profile says you don't have it.`, profileFields: [t.field], evidence: r.evidenceRef });
      } else if (v === "yes") {
        reasons.push({ text: `Requires ${t.name}, which your profile confirms.`, profileFields: [t.field], evidence: r.evidenceRef });
      } else {
        // Registration and bonding decide eligibility to bid; insurance can be arranged before award.
        if (t.field !== "insurance") cap = true;
        unknowns.push({ text: `Requires ${t.name}. Your status isn't in your profile yet.`, profileFields: [t.field], evidence: r.evidenceRef });
        clar.push(`Confirm whether you have ${t.name}.`);
      }
    } else if (!t && r.mandatory) {
      // Mandatory experience or equipment is material eligibility the profile can't confirm yet.
      if (r.category === "experience" || r.category === "equipment") cap = true;
      unknowns.push({ text: `Check before bidding: ${r.text}`, profileFields: r.category === "experience" ? ["relevantExperience"] : r.category === "equipment" ? ["equipment"] : [], evidence: r.evidenceRef });
    }
  }
  if (o.requirementsCompleteness !== "complete") unknowns.push(s("Requirements may be incomplete. Read the full solicitation before bidding."));

  // Role preference: never invent a subcontract opening (REC-10).
  if (p.roleInterest.value === "subcontract" && o.solicitationType.normalized !== null) {
    cap = true;
    unknowns.push(s("This solicitation is for prime contractors. Any subcontract work would depend on who wins.", ["roleInterest"]));
  }

  const tier: FitTier = conflict ? "not_a_fit" : review ? "needs_review" : cap ? "possible_fit" : "good_fit";
  const rankingScore = +(0.45 * scopeScore + 0.2 * scopeScore + 0.2 * geoScore + 0.1 * (p.equipment.value?.length ? 0.6 : 0.3) + 0.05 * 0.5).toFixed(3);

  return {
    opportunityId: o.id,
    opportunityVersion: o.version,
    profileId: p.id,
    profileRevision: p.revision,
    state: "assessed",
    tier,
    rankingScore,
    reasons,
    mismatches,
    unknowns,
    suggestedClarifications: [...new Set(clar)],
    assessedAt: now.toISOString(),
    rankingVersion: SIM_RANKING_VERSION,
  };
}
