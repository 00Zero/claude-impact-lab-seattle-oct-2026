import type { FitTier } from "@/lib/contracts";

// One stroke icon family (1.75 stroke, 24 grid, round joins), drawn inline so
// nothing loads from a third-party host.

type P = { size?: number; className?: string; title?: string };
const base = (size = 18, className?: string, title?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": title ? undefined : true,
  role: title ? "img" : undefined,
});

export const IconSearch = ({ size, className }: P) => (<svg {...base(size, className)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>);
export const IconClose = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconPlus = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M5 12h14" /></svg>);
export const IconChevronDown = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m6 9 6 6 6-6" /></svg>);
export const IconChevronLeft = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m15 6-6 6 6 6" /></svg>);
export const IconChevronRight = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconRecenter = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>);
export const IconLayers = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></svg>);
export const IconBookmark = ({ size, className, filled }: P & { filled?: boolean }) => (<svg {...base(size, className)}><path d="M7 4h10v16l-5-3.5L7 20V4Z" fill={filled ? "currentColor" : "none"} /></svg>);
export const IconExternal = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" /></svg>);
export const IconPin = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.8" r="2.3" /></svg>);
export const IconCalendar = ({ size, className }: P) => (<svg {...base(size, className)}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>);
export const IconDoc = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>);
export const IconBuilding = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M10 20v-5h4v5M9 11h.01M15 11h.01" /></svg>);
export const IconPhone = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M6.6 3.5h2.6l1.4 4-2 1.3a10.5 10.5 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6A2 2 0 0 1 18.4 19.5 15 15 0 0 1 4.5 5.6a2 2 0 0 1 2.1-2.1Z" /></svg>);
export const IconMail = ({ size, className }: P) => (<svg {...base(size, className)}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>);
export const IconGlobe = ({ size, className }: P) => (<svg {...base(size, className)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z" /></svg>);
export const IconCopy = ({ size, className }: P) => (<svg {...base(size, className)}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>);
export const IconSparkle = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" /><path d="M19 15.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" /></svg>);
export const IconUser = ({ size, className }: P) => (<svg {...base(size, className)}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" /></svg>);
export const IconInfo = ({ size, className }: P) => (<svg {...base(size, className)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>);
export const IconAlert = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17h.01" /></svg>);
export const IconSliders = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>);
export const IconList = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>);
export const IconMap = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>);
export const IconEdit = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M5 19h3.5L19 8.5 15.5 5 5 15.5V19Z" /><path d="m13.5 7 3.5 3.5" /></svg>);
export const IconCheck = ({ size, className }: P) => (<svg {...base(size, className)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconArea = ({ size, className }: P) => (<svg {...base(size, className)}><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><path d="m10.5 10.5 5 2-2 1-1 2-2-5Z" /></svg>);

/** Tier glyphs give every fit label a non-color cue (MAP-12, 15.4). Drawn centered on 0,0 for map markers. */
export function TierGlyph({ tier, size = 12 }: { tier: FitTier; size?: number }) {
  const s = size / 2;
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "tier-glyph" };
  switch (tier) {
    case "good_fit":
      return <path {...common} d={`M${-s * 0.7},${0} L${-s * 0.15},${s * 0.55} L${s * 0.75},${-s * 0.5}`} />;
    case "possible_fit":
      return <path {...common} d={`M${-s * 0.75},${s * 0.15} C${-s * 0.4},${-s * 0.45} ${-s * 0.05},${-s * 0.25} 0,0 S${s * 0.4},${s * 0.45} ${s * 0.75},${-s * 0.15}`} />;
    case "needs_review":
      return (
        <g {...common}>
          <path d={`M${-s * 0.42},${-s * 0.35} A${s * 0.45},${s * 0.42} 0 1 1 0,${s * 0.12} L0,${s * 0.3}`} />
          <circle cx={0} cy={s * 0.72} r={0.6} fill="currentColor" />
        </g>
      );
    case "not_a_fit":
      return <path {...common} d={`M${-s * 0.55},${-s * 0.55} L${s * 0.55},${s * 0.55} M${s * 0.55},${-s * 0.55} L${-s * 0.55},${s * 0.55}`} />;
  }
}

/** Same glyph as a standalone inline icon for badges and the legend. */
export function TierIcon({ tier, size = 16 }: { tier: FitTier; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true" className={`tier-icon tier-${tier}`}>
      <circle r={7.5} className="tier-icon-bg" />
      <g style={{ color: "var(--tier-ink)" }}><TierGlyph tier={tier} size={10} /></g>
    </svg>
  );
}
