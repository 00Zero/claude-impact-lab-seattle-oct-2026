// Clippy 2.0's own helper: a round, friendly lightbulb face. Original artwork.
export default function HelperIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Clippy helper">
      <circle cx="32" cy="28" r="22" fill="#FDE68A" stroke="#F59E0B" strokeWidth="3" />
      <path d="M8 12 L13 15 M56 12 L51 15 M32 1 L32 4" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <rect x="23" y="49" width="18" height="6" rx="2" fill="#94A3B8" />
      <rect x="25" y="56" width="14" height="5" rx="2.5" fill="#64748B" />
      <circle cx="24" cy="26" r="3.5" fill="#1F2937" />
      <circle cx="40" cy="26" r="3.5" fill="#1F2937" />
      <circle cx="25.2" cy="24.8" r="1.1" fill="#fff" />
      <circle cx="41.2" cy="24.8" r="1.1" fill="#fff" />
      <path d="M23 35 Q32 43 41 35" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="33" r="3" fill="#FCA5A5" opacity="0.8" />
      <circle cx="47" cy="33" r="3" fill="#FCA5A5" opacity="0.8" />
    </svg>
  );
}
