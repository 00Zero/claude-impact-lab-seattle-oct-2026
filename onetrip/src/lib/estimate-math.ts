// Estimate pricing, shared by the server (which stores totals) and the
// estimate editor (which previews them while the contractor types).

export type PricedInput = {
  quantityLow: number;
  quantityHigh: number;
  unitPriceLowMinor: number | null;
  unitPriceHighMinor: number | null;
};

// A line's low and high total in minor units, or null when it has no price.
export function lineRange(line: PricedInput) {
  if (line.unitPriceLowMinor === null || line.unitPriceHighMinor === null) return null;
  return {
    low: Math.round(line.quantityLow * line.unitPriceLowMinor),
    high: Math.round(line.quantityHigh * line.unitPriceHighMinor),
  };
}

export function estimateTotals(lines: PricedInput[]) {
  let low = 0;
  let high = 0;
  let unpriced = 0;
  for (const line of lines) {
    const range = lineRange(line);
    if (range) {
      low += range.low;
      high += range.high;
    } else {
      unpriced++;
    }
  }
  return { low, high, unpriced };
}
