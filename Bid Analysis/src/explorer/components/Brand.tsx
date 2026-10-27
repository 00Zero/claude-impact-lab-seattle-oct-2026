// Bid Analytics mark: a vector redraw of the supplied logo (a hexagonal "b" in
// brass gold). Swap the path for the designer's original SVG when it exists.

export const BRAND_NAME = "Bid Analytics";
export const PRODUCT_NAME = "Washington Contract Explorer";

export const BRAND_MARK_PATH =
  "M140 38 L140 318 L240 382 L305 345 L305 270 L195 212 L195 135 L385 245 L385 368 L222 465 L30 350 L30 112 Z";

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size * (375 / 445)} height={size} viewBox="20 30 375 445" aria-hidden="true" focusable="false">
      <path d={BRAND_MARK_PATH} fill="var(--brand-gold, #c7ad6f)" stroke="var(--brand-gold, #c7ad6f)" strokeWidth="14" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLockup({ size = 26, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <span className="brand">
      <BrandMark size={size} />
      <span className="brand-name">{BRAND_NAME}</span>
      {subtitle && <span className="brand-sub">{subtitle}</span>}
    </span>
  );
}
