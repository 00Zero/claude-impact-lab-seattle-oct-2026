// Shared by the dashboard and insights charts.

/** Round a tick spacing up to 1, 2, 5 or 10 times a power of ten, so the axis shows round numbers. */
export function niceStep(raw: number) {
  if (raw <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}
