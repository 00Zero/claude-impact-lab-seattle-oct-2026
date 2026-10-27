// Preset choices for the publish-space form. Each tile maps to the values the
// `spaces` table stores (label, starts_at/ends_at, capacity, description, price_info).

export const AREAS = ["Main dining", "Window", "Patio", "Bar", "Private room", "Communal table"] as const;

export const SLOTS = [
  { value: "lunch", label: "Lunch", hint: "11:30 AM – 2 PM", start: "11:30", end: "14:00" },
  { value: "early", label: "Early dinner", hint: "5 – 7 PM", start: "17:00", end: "19:00" },
  { value: "dinner", label: "Dinner", hint: "6 – 9 PM", start: "18:00", end: "21:00" },
  { value: "late", label: "Late night", hint: "9 – 11 PM", start: "21:00", end: "23:00" },
] as const;

export const CAPACITIES = [2, 4, 6, 8, 10, 12] as const;

export const FEATURES = ["Quiet", "Lively", "Outdoor", "Window view", "Private", "Long communal table"] as const;

export const PRICES = [
  { value: "none", label: "No minimum", info: null },
  { value: "15", label: "$15 min", info: "$15 minimum spend per person" },
  { value: "25", label: "$25 min", info: "$25 minimum spend per person" },
  { value: "40", label: "$40 min", info: "$40 minimum spend per person" },
] as const;
