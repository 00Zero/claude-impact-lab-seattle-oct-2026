// `compact` drops the wordmark on phone-width screens, where app headers are
// short on room; the mark alone stays.
export function Logo({ className = "", compact = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" opacity="0.65" />
        <circle cx="16" cy="16" r="4" fill="var(--signal)" />
      </svg>
      <span className={`text-[1.15rem] font-semibold tracking-tight ${compact ? "hidden min-[420px]:inline" : ""}`}>RingAround</span>
    </span>
  );
}
