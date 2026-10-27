import type { Unit } from "./types";

export type BaseUnit = "lb" | "fl_oz" | "each";

const TO_BASE: Record<Unit, { factor: number; baseUnit: BaseUnit }> = {
  lb: { factor: 1, baseUnit: "lb" },
  oz: { factor: 1 / 16, baseUnit: "lb" },
  kg: { factor: 2.20462, baseUnit: "lb" },
  g: { factor: 1 / 453.592, baseUnit: "lb" },
  fl_oz: { factor: 1, baseUnit: "fl_oz" },
  gal: { factor: 128, baseUnit: "fl_oz" },
  l: { factor: 33.814, baseUnit: "fl_oz" },
  ml: { factor: 1 / 29.5735, baseUnit: "fl_oz" },
  each: { factor: 1, baseUnit: "each" },
};

export function toBase(qty: number, unit: Unit): { qty: number; baseUnit: BaseUnit } {
  const { factor, baseUnit } = TO_BASE[unit];
  return { qty: qty * factor, baseUnit };
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return TO_BASE[a].baseUnit === TO_BASE[b].baseUnit;
}

const EACH_WORDS = ["cup", "lid", "napkin", "glove"];

export function unitLabel(baseUnit: BaseUnit, itemName: string): string {
  if (baseUnit === "lb") return "per lb";
  if (baseUnit === "fl_oz") return "per fl oz";
  const name = itemName.toLowerCase();
  // The noun usually comes last ("Hot Cup Lids" are lids), so pick the word found latest in the name.
  let word: string | undefined;
  let at = -1;
  for (const w of EACH_WORDS) {
    for (const m of name.matchAll(new RegExp(`\\b${w}s?\\b`, "g"))) {
      if (m.index > at) [word, at] = [w, m.index];
    }
  }
  return word ? `per ${word}` : "per item";
}
