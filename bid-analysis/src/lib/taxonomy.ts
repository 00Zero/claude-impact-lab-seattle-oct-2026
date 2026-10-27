import type { AgencyType, FitTier, LocationPrecision, WorkCategoryId } from "./contracts";

export const WORK_CATEGORIES: { id: WorkCategoryId; label: string; groundwork: boolean }[] = [
  { id: "paving", label: "Paving", groundwork: true },
  { id: "pothole_repair", label: "Pothole repair", groundwork: true },
  { id: "excavation", label: "Excavation", groundwork: true },
  { id: "grading", label: "Grading", groundwork: true },
  { id: "drainage", label: "Drainage", groundwork: true },
  { id: "landscaping", label: "Landscaping", groundwork: true },
  { id: "site_prep", label: "Site preparation", groundwork: true },
  { id: "concrete", label: "Concrete", groundwork: true },
  { id: "utilities", label: "Water and sewer utilities", groundwork: false },
  { id: "janitorial", label: "Janitorial", groundwork: false },
  { id: "it_services", label: "IT and software", groundwork: false },
  { id: "supplies", label: "Goods and supplies", groundwork: false },
  { id: "other", label: "Other services", groundwork: false },
];

export const categoryLabel = (id: WorkCategoryId) => WORK_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const AGENCY_TYPE_LABEL: Record<AgencyType, string> = {
  state: "State agency",
  county: "County",
  city: "City",
  port: "Port",
  school: "School district",
  university: "University",
  utility: "Utility district",
  transit: "Transit",
  tribal: "Tribal government",
  federal: "Federal",
  other: "Other public entity",
  unknown: "Type unknown",
};

export const FIT_TIERS: { id: FitTier; label: string; glyph: string; meaning: string }[] = [
  { id: "good_fit", label: "Good fit", glyph: "check", meaning: "Your confirmed services and service area line up, and nothing known rules you out." },
  { id: "possible_fit", label: "Possible fit", glyph: "tilde", meaning: "Some of the work lines up, but part of the scope, a role, or a requirement needs a closer look." },
  { id: "needs_review", label: "Needs review", glyph: "question", meaning: "Material information is missing, so there isn't enough to judge suitability." },
  { id: "not_a_fit", label: "Not a fit", glyph: "cross", meaning: "A clear conflict with your services, exclusions, service area, or a published mandatory requirement." },
];

export const fitLabel = (t: FitTier) => FIT_TIERS.find((f) => f.id === t)!.label;

/** Plain-language precision disclosure (MAP-05, DET-03). */
export const PRECISION_COPY: Record<LocationPrecision, { short: string; long: string; approximate: boolean }> = {
  exact_site: { short: "Exact site", long: "The listing identifies the specific work site.", approximate: false },
  address: { short: "Street address", long: "Placed at the street address given in the listing.", approximate: false },
  road_segment: { short: "Road segment", long: "Placed on the road segment named in the listing. The work may run along it.", approximate: false },
  city: { short: "City-level", long: "The listing names only a city. The pin marks the city center, not a job site.", approximate: true },
  county: { short: "County-level", long: "The listing names only a county. The pin marks the county center, not a job site.", approximate: true },
  region: { short: "Regional", long: "The listing names a region. The pin is an approximate anchor.", approximate: true },
  statewide: { short: "Statewide", long: "Work can happen anywhere in Washington, so it isn't pinned.", approximate: true },
  remote: { short: "No site", long: "No physical work site, so it isn't pinned.", approximate: true },
  unknown: { short: "Location unknown", long: "The listing doesn't say where the work happens, so it isn't pinned.", approximate: true },
};

export const WA_COUNTIES = [
  "Adams", "Asotin", "Benton", "Chelan", "Clallam", "Clark", "Columbia", "Cowlitz", "Douglas", "Ferry",
  "Franklin", "Garfield", "Grant", "Grays Harbor", "Island", "Jefferson", "King", "Kitsap", "Kittitas",
  "Klickitat", "Lewis", "Lincoln", "Mason", "Okanogan", "Pacific", "Pend Oreille", "Pierce", "San Juan",
  "Skagit", "Skamania", "Snohomish", "Spokane", "Stevens", "Thurston", "Wahkiakum", "Walla Walla",
  "Whatcom", "Whitman", "Yakima",
];

/** Major places for map labels and for recognizing a base location in plain text. */
export const WA_PLACES: { name: string; county: string; lngLat: [number, number]; rank: 1 | 2 | 3 }[] = [
  { name: "Seattle", county: "King", lngLat: [-122.3321, 47.6062], rank: 1 },
  { name: "Spokane", county: "Spokane", lngLat: [-117.426, 47.6588], rank: 1 },
  { name: "Tacoma", county: "Pierce", lngLat: [-122.4443, 47.2529], rank: 1 },
  { name: "Vancouver", county: "Clark", lngLat: [-122.6615, 45.6387], rank: 1 },
  { name: "Bellevue", county: "King", lngLat: [-122.2015, 47.6101], rank: 3 },
  { name: "Kent", county: "King", lngLat: [-122.2348, 47.3809], rank: 3 },
  { name: "Renton", county: "King", lngLat: [-122.2171, 47.4829], rank: 3 },
  { name: "Everett", county: "Snohomish", lngLat: [-122.2021, 47.979], rank: 2 },
  { name: "Bellingham", county: "Whatcom", lngLat: [-122.4787, 48.7519], rank: 2 },
  { name: "Olympia", county: "Thurston", lngLat: [-122.9007, 47.0379], rank: 2 },
  { name: "Yakima", county: "Yakima", lngLat: [-120.5059, 46.6021], rank: 2 },
  { name: "Kennewick", county: "Benton", lngLat: [-119.1372, 46.2112], rank: 2 },
  { name: "Pasco", county: "Franklin", lngLat: [-119.1006, 46.2396], rank: 3 },
  { name: "Richland", county: "Benton", lngLat: [-119.2845, 46.2856], rank: 3 },
  { name: "Wenatchee", county: "Chelan", lngLat: [-120.3103, 47.4235], rank: 2 },
  { name: "Walla Walla", county: "Walla Walla", lngLat: [-118.343, 46.0646], rank: 2 },
  { name: "Port Angeles", county: "Clallam", lngLat: [-123.4307, 48.1181], rank: 2 },
  { name: "Aberdeen", county: "Grays Harbor", lngLat: [-123.8157, 46.9754], rank: 3 },
  { name: "Ellensburg", county: "Kittitas", lngLat: [-120.5478, 46.9965], rank: 3 },
  { name: "Moses Lake", county: "Grant", lngLat: [-119.2781, 47.1301], rank: 3 },
  { name: "Pullman", county: "Whitman", lngLat: [-117.1796, 46.7313], rank: 3 },
  { name: "Mount Vernon", county: "Skagit", lngLat: [-122.3341, 48.4212], rank: 3 },
  { name: "Longview", county: "Cowlitz", lngLat: [-122.9382, 46.1382], rank: 3 },
  { name: "Bremerton", county: "Kitsap", lngLat: [-122.6326, 47.5673], rank: 3 },
  { name: "Omak", county: "Okanogan", lngLat: [-119.5276, 48.4113], rank: 3 },
  { name: "Colville", county: "Stevens", lngLat: [-117.9055, 48.5466], rank: 3 },
  { name: "Centralia", county: "Lewis", lngLat: [-122.9543, 46.7162], rank: 3 },
];
