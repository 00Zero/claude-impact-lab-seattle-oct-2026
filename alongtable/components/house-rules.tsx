// The restaurant's house rules as chips, so hosts and guests see them before they
// book or join. Mint chips, per the owner-flow spec. Renders nothing without rules.
export function HouseRules({ rules, className = "" }: { rules: string[]; className?: string }) {
  if (rules.length === 0) return null;
  return (
    <section aria-labelledby="house-rules-title" className={`flex flex-col gap-2 ${className}`}>
      <h2 id="house-rules-title" className="alt-label-text alt-secondary">
        House rules
      </h2>
      <ul className="flex flex-wrap gap-2">
        {rules.map((rule) => (
          <li key={rule} className="alt-chip alt-chip--booked">
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
