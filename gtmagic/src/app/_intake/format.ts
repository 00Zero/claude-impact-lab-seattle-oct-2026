/* Number formatting for cards. Formats only; never computes a figure the script owns. */
export function money(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}
export const num = (n: number): string => new Intl.NumberFormat("en-US").format(n);
export const pct = (x: number): string => `${Math.round(x * 100)}%`;
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
