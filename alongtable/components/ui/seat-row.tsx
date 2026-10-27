// The seat row (brand/DESIGN.md): one circle per seat. Ink = taken, dashed = open.
// Above 12 seats it becomes a bar. Always paired with the words, so the circles are
// for glancing and the words are for certainty. `pop` makes the seats appear one
// after another (for a space that just went live); `count={false}` is only for
// callers that already say the seat count in words right beside the row.

export function seatWords(open: number, total: number) {
  if (open === 0) return "Table's full";
  if (open === 1) return "1 seat open";
  return `${open} of ${total} seats open`;
}

export function SeatRow({
  total,
  taken,
  large = false,
  pop = false,
  count = true,
  animate = false,
}: {
  total: number;
  taken: number;
  large?: boolean;
  pop?: boolean;
  count?: boolean;
  /** Let the landing page's scroll motion fill the taken seats in (components/landing/use-reveal.ts). */
  animate?: boolean;
}) {
  const t = Math.max(0, total);
  const k = Math.min(t, Math.max(0, taken));

  return (
    <div {...(animate ? { "data-seat-row": "" } : {})}>
      {t > 12 ? (
        <div className="alt-seat-bar" role="img" aria-label={`${k} of ${t} seats taken`}>
          <span style={{ width: `${(k / t) * 100}%` }} />
        </div>
      ) : (
        <ul
          className={`alt-seats ${large ? "alt-seats--lg" : ""} ${pop ? "alt-seats--pop" : ""}`}
          role="img"
          aria-label={`${k} of ${t} seats taken`}
        >
          {Array.from({ length: t }, (_, i) => (
            <li
              key={i}
              className="alt-seat"
              data-state={i < k ? "taken" : "open"}
              style={pop ? { animationDelay: `calc(var(--alt-stagger-seat) * ${i})` } : undefined}
            />
          ))}
        </ul>
      )}
      {count && <p className="alt-seat-count">{seatWords(t - k, t)}</p>}
    </div>
  );
}
