// Keyword hints for suggesting a category from the free-text description.
// The suggestion is only a default; the user can always pick another.
export const SERVICE_CATEGORIES = [
  {
    id: "plumbing",
    label: "Plumbing",
    pattern: /\b(plumb\w*|leak\w*|pipes?|drains?|toilets?|faucets?|sinks?|water heaters?|sewer\w*|clog\w*|garbage disposals?)\b/g,
  },
  {
    id: "electrical",
    label: "Electrical",
    pattern: /\b(electric\w*|wiring|rewir\w*|outlets?|breakers?|panels?|light fixtures?|lighting|ev chargers?|generators?)\b/g,
  },
  {
    id: "hvac",
    label: "HVAC",
    pattern: /\b(hvac|furnaces?|heat pumps?|air[- ]?condition\w*|a\/c|ducts?|ductwork|thermostats?|rooftop units?|boilers?|heating|cooling)\b/g,
  },
  {
    id: "landscaping",
    label: "Landscaping",
    pattern: /\b(landscap\w*|lawns?|yards?|gardens?|gardening|trees?|mow\w*|hedges?|irrigation|sprinklers?|snow removal|weeds?|weeding|mulch\w*)\b/g,
  },
  {
    id: "pest",
    label: "Pest control",
    pattern: /\b(pests?|rodents?|mice|mouse|rats?|termites?|ants|roach(es)?|cockroach(es)?|bed ?bugs?|wasps?|extermina\w*)\b/g,
  },
  { id: "painting", label: "Painting", pattern: /\b(paint\w*|repaint\w*)\b/g },
  {
    id: "cleaning",
    label: "Cleaning",
    pattern: /\b(clean\w*|maids?|janitor\w*|carpets?|windows?|turnovers?|move[- ]?(in|out)|pressure[- ]wash\w*|power[- ]wash\w*|sanitiz\w*)\b/g,
  },
  {
    id: "handyman",
    label: "Handyman",
    pattern: /\b(handyman|handy ?person|drywall|assembl\w*|mount\w*|shelv\w*|doors?|caulk\w*|fix\w*|repairs?)\b/g,
  },
  { id: "other", label: "Something else", pattern: null },
];

export function categoryLabel(id) {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? "Something else";
}

// Picks the category with the most keyword hits; earlier categories win ties,
// so specific trades beat the broad words "cleaning" ("drain cleaning" is
// plumbing) and "fix"/"repair" (handyman).
export function suggestCategory(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const category of SERVICE_CATEGORIES) {
    if (!category.pattern) continue;
    const score = lower.match(category.pattern)?.length ?? 0;
    if (score > bestScore) {
      best = category.id;
      bestScore = score;
    }
  }
  return best;
}
