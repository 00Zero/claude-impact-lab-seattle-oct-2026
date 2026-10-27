/* Customer groups get Isotype colours in owner-rank order: hue means group, nothing else. */
import type { Segment } from "@/app/_intake/schema";

export type GroupClass = "g1" | "g2" | "g3" | "g4" | "gn";
const CLASSES: GroupClass[] = ["g1", "g2", "g3", "g4"];

export function groupClasses(segments: Segment[]): Map<string, GroupClass> {
  const ranked = [...segments].sort((a, b) => (a.ownerRank ?? 9) - (b.ownerRank ?? 9));
  return new Map(ranked.map((s, i) => [s.id, CLASSES[i] ?? "gn"]));
}
