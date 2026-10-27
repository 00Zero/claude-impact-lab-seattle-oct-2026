import type { ReactNode } from "react";

// One meaning per color (brand/DESIGN.md): mint = booked, apricot = filling up,
// sky = information, red = a problem. "neutral" claims no meaning.
// `green` is the older name used by some pages for "open / has spots"; it renders as information.
const tones = {
  booked: "alt-chip alt-chip--booked",
  filling: "alt-chip alt-chip--filling",
  info: "alt-chip alt-chip--info",
  problem: "alt-chip alt-chip--problem",
  neutral: "alt-chip",
  green: "alt-chip alt-chip--info",
};

// shrink-0: a chip never wraps or gets squeezed beside a long title.
export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`${tones[tone]} shrink-0`}>{children}</span>;
}
