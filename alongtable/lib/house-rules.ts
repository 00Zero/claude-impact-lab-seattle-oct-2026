// House rules: stored as one text column (restaurants.house_rules), one rule per line.
// Pure helpers, shared by the sign-up step (client) and the pages that show them (server).

export const MAX_RULES = 6;
export const MAX_RULE_LENGTH = 80;

/** Quick picks on the sign-up step. Owners can also type their own. */
export const RULE_SUGGESTIONS = [
  "No outside food or drinks",
  "Please arrive on time",
  "Order from the menu",
  "Keep it to the reserved area",
  "Cards only, no cash",
  "21+ after 9 PM",
] as const;

/** Stored text (or user input) → clean list: trimmed, no blanks or duplicates, capped. */
export function parseHouseRules(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of String(text ?? "").split("\n")) {
    const rule = line.trim().replace(/\s+/g, " ").slice(0, MAX_RULE_LENGTH);
    if (!rule || seen.has(rule.toLowerCase())) continue;
    seen.add(rule.toLowerCase());
    out.push(rule);
    if (out.length === MAX_RULES) break;
  }
  return out;
}

/** List → the text stored in restaurants.house_rules (null when empty). */
export function serializeHouseRules(rules: string[]): string | null {
  const clean = parseHouseRules(rules.join("\n"));
  return clean.length ? clean.join("\n") : null;
}
