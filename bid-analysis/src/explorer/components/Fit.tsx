import type { FitAssessment, FitStatement, FitTier } from "@/lib/contracts";
import { FIT_TIERS, fitLabel } from "@/lib/taxonomy";
import { TierIcon } from "./Icons";

export function FitBadge({ tier, compact }: { tier: FitTier; compact?: boolean }) {
  return (
    <span className={`fit-badge tier-${tier}${compact ? " is-compact" : ""}`}>
      <TierIcon tier={tier} size={compact ? 14 : 16} />
      {fitLabel(tier)}
    </span>
  );
}

/** Personalization state for a card or detail view. Unassessed is never shown as Not a fit (SRS 8.2, 11.3). */
export function FitState({ assessment, personalized, pending, failed, compact }: { assessment?: FitAssessment; personalized: boolean; pending: boolean; failed: boolean; compact?: boolean }) {
  if (assessment?.tier && personalized) return <FitBadge tier={assessment.tier} compact={compact} />;
  if (pending) return <span className="fit-badge is-pending">{compact ? "Assessing…" : "Assessment pending"}</span>;
  if (failed) return <span className="fit-badge is-muted">Fit unavailable</span>;
  return null;
}

function Statements({ title, items, kind }: { title: string; items: FitStatement[]; kind: "reason" | "mismatch" | "unknown" }) {
  if (!items.length) return null;
  return (
    <div className={`fit-group is-${kind}`}>
      <h4 className="fit-group-title">{title}</h4>
      <ul className="fit-list">
        {items.map((s, i) => (
          <li key={i}>
            <span className="fit-bullet" aria-hidden="true" />
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FitExplanation({ a, simulated }: { a: FitAssessment; simulated: boolean }) {
  const meaning = FIT_TIERS.find((t) => t.id === a.tier)?.meaning;
  return (
    <section className={`fit-panel tier-${a.tier}`} aria-labelledby="fit-title">
      <div className="fit-panel-head">
        {a.tier && <FitBadge tier={a.tier} />}
        <p className="fit-meaning" id="fit-title">{meaning}</p>
      </div>
      <Statements title="What lines up" items={a.reasons} kind="reason" />
      <Statements title="Conflicts" items={a.mismatches} kind="mismatch" />
      <Statements title="Still unknown" items={a.unknowns} kind="unknown" />
      <p className="fit-foot">
        Based on profile revision {a.profileRevision}. This describes suitability, not your chance of winning.
        {simulated && " Simulated rules for development, not the real matching service."}
      </p>
    </section>
  );
}
