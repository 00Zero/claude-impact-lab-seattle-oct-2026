import type { RestaurantProfile } from "@/lib/onboarding";

// Used when the live lookup fails (e.g. no network on stage). Clearly labelled
// as a sample in the UI; the owner can still edit the name and location.

export const SAMPLE_PROFILE: RestaurantProfile = {
  name: "Basil & Ember",
  location: "Fremont, Seattle, WA",
  address: "3400 Fremont Ave N, Seattle, WA 98103",
  cuisine: "Mediterranean",
  priceRange: "$$",
  summary: "Neighborhood Mediterranean kitchen with a wood-fired grill, a long communal table and a small heated patio.",
  hours: [
    { day: "Tue", opens: "11:30", closes: "21:30" },
    { day: "Wed", opens: "11:30", closes: "21:30" },
    { day: "Thu", opens: "11:30", closes: "21:30" },
    { day: "Fri", opens: "11:30", closes: "23:00" },
    { day: "Sat", opens: "10:00", closes: "23:00" },
    { day: "Sun", opens: "10:00", closes: "20:00" },
  ],
  areas: ["Main dining", "Communal table", "Patio", "Bar"],
  sources: [],
  confidence: "high",
  missing: [],
  lat: 47.6513, // Fremont (sample)
  lng: -122.3501,
};
