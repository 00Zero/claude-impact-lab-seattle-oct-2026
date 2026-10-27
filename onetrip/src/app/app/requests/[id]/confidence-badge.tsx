export type Confidence = "high" | "med" | "low";

const CONFIDENCE: Record<Confidence, { icon: string; label: string; className: string }> = {
  high: { icon: "●", label: "High", className: "border-ok text-ok" },
  med: { icon: "◑", label: "Med", className: "border-caution text-caution" },
  // Low is grey, not red: it's uncertainty, not danger.
  low: { icon: "◔", label: "Low", className: "border-wait text-wait" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = CONFIDENCE[confidence];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] px-2 py-0.5 text-xs font-bold ${c.className}`}
    >
      <span aria-hidden>{c.icon}</span> {c.label}
      <span className="sr-only"> confidence</span>
    </span>
  );
}
