/** Today as YYYY-MM-DD in the browser's local timezone (toISOString would be UTC, off by a day in the evening). */
export function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Formats a YYYY-MM-DD string as e.g. "October 18, 2026" without a timezone shift. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
