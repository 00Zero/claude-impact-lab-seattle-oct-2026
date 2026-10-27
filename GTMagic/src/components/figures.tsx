/* The Isotype figure and the icon set, as inline SVG symbols (rendered once in the shell). */
export type IconName = "fig" | "i-send" | "i-link" | "i-copy" | "i-down" | "i-trash" | "i-check" | "i-warn";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function SvgDefs() {
  return (
    <svg width="0" height="0" className="defs" aria-hidden="true">
      <symbol id="fig" viewBox="0 0 16 34">
        <circle cx="8" cy="4.5" r="4.5" />
        <path d="M2.5 11h11a2.5 2.5 0 0 1 2.5 2.5V24h-3v10H9.5v-9h-3v9H3V24H0V13.5A2.5 2.5 0 0 1 2.5 11Z" />
      </symbol>
      <symbol id="i-send" viewBox="0 0 20 20"><path d="M3 10h13M11 5l5 5-5 5" {...stroke} /></symbol>
      <symbol id="i-link" viewBox="0 0 20 20"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" {...stroke} /></symbol>
      <symbol id="i-copy" viewBox="0 0 20 20"><path d="M7 7h10v10H7zM13 7V3H3v10h4" {...stroke} /></symbol>
      <symbol id="i-down" viewBox="0 0 20 20"><path d="M10 3v10M5 9l5 5 5-5M3 17h14" {...stroke} /></symbol>
      <symbol id="i-trash" viewBox="0 0 20 20"><path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12" {...stroke} /></symbol>
      <symbol id="i-check" viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" {...stroke} strokeWidth={2} /></symbol>
      <symbol id="i-warn" viewBox="0 0 20 20"><path d="M10 3 2 17h16L10 3zM10 8v4M10 14.5v.5" {...stroke} /></symbol>
    </svg>
  );
}

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}

export const Figure = () => <Icon name="fig" className="" />;
