/* Plain words for every enum value in the Intake Brief (no jargon on screen). */
import type { ENUMS } from "./schema";

type Labels = { [K in keyof typeof ENUMS]: Record<(typeof ENUMS)[K][number], string> };

export const PLAIN: Labels = {
  verdict: { serviceable: "Worth going after", marginal: "Borderline", "not-serviceable": "Not worth it", "insufficient-evidence": "Not enough evidence yet" },
  confidence: { low: "low confidence", medium: "medium confidence", high: "high confidence" },
  bucket: { locked: "Must-haves", preference: "Preferences", hypothesis: "Guesses to test", unknown: "Don't know yet" },
  dimension: {
    geography: "Where", age: "Age", sex: "Men or women", income: "Income", lifeStage: "Life stage",
    healthCondition: "Health targeting", audienceType: "Audience", price: "Price", channel: "Channels",
    language: "Language", regulatory: "Ad wording", ethics: "Ethics", interest: "Interests",
  },
  appliesTo: { all: "everywhere", targeting: "for ad targeting", messaging: "for ad wording", research: "for research" },
  findingKind: { observed: "Seen in sources", estimated: "Estimated", inferred: "Inferred" },
  sourceType: {
    "forum-post": "forum post", review: "review", "review-aggregate": "app store rating", survey: "survey",
    "first-party": "your own material", "official-stats": "official statistics", "news-report": "news report",
    "competitor-site": "competitor site",
  },
  hypothesisStatus: { supported: "Research supports it", weakened: "Research weakens it", untested: "Not tested yet", refuted: "Research rules it out" },
  skepticResult: { "nothing-found": "Found nothing against it", resolved: "Checked, and it holds", unresolved: "Still open" },
  skepticKind: { motivation: "Do people want this?", "incumbent-gap": "Is there a gap to fill?", size: "Is the group big enough?", other: "Other check" },
  adVerdict: { worked: "Worked", "didnt-work": "Didn't work", inconclusive: "Too early to tell" },
  conversionType: { paying: "Paying sign-ups", trial: "Free trials, not judged", unknown: "Not sure if paying, not judged" },
  channel: { meta: "Meta", google: "Google", reddit: "Reddit", tiktok: "TikTok", email: "Email", website: "Website", other: "Other" },
  creativeStatus: { live: "Running now", past: "Ran before", draft: "Draft, never run" },
  readiness: { ready: "Ready to test", "no-supported-segment": "No customer group is supported yet", "needs-more": "Needs a bit more" },
};
