import { geoCentroid } from "d3-geo";
import type { DateValue, Opportunity, PerformanceLocation, Requirement, WorkCategoryId } from "@/lib/contracts";
import { WA_PLACES } from "@/lib/taxonomy";
import waGeo from "@/map/assets/wa-geo.json";

// ============================================================================
// DEVELOPMENT FIXTURES. NOT REAL SOLICITATIONS.
// Every record below is invented to exercise the UI: precision cases,
// multi-site work, statewide and unknown locations, missing dates, mandatory
// requirements, and mixed scopes. Agencies are real public bodies from the
// team spreadsheet, but none of these opportunities exist. They must never be
// loaded into the real catalog (SRS D-14, 16). The UI labels every one.
// ============================================================================

export const FIXTURE_SNAPSHOT_AT = "2026-10-25T17:00:00Z";
const TZ = "America/Los_Angeles";

const countyCentroid = (name: string): [number, number] => {
  const c = (waGeo as { counties: { name: string; geometry: GeoJSON.Geometry }[] }).counties.find((x) => x.name === name);
  if (!c) throw new Error(`Unknown county ${name}`);
  const [lng, lat] = geoCentroid(c.geometry as GeoJSON.Geometry);
  return [+lng.toFixed(4), +lat.toFixed(4)];
};

let locSeq = 0;
const loc = (p: Partial<PerformanceLocation> & Pick<PerformanceLocation, "label" | "precision">): PerformanceLocation => ({
  id: `loc-${++locSeq}`,
  geometry: null,
  displayPoint: null,
  displayPointBasis: null,
  countyNames: [],
  cityName: null,
  rawLocationText: p.label,
  evidenceRef: null,
  resolutionMethod: "manual_review",
  resolutionConfidence: "medium",
  ...p,
});

const site = (label: string, lng: number, lat: number, county: string, city: string | null, precision: "exact_site" | "address" | "road_segment" = "exact_site") =>
  loc({ label, precision, displayPoint: [lng, lat], displayPointBasis: precision === "address" ? "geocoded_address" : "exact_location", geometry: { type: "Point", coordinates: [lng, lat] }, countyNames: [county], cityName: city, resolutionConfidence: "high" });

const city = (name: string) => {
  const p = WA_PLACES.find((x) => x.name === name)!;
  return loc({ label: `City of ${name} (site not specified)`, precision: "city", displayPoint: p.lngLat, displayPointBasis: "city_centroid", countyNames: [p.county], cityName: name, rawLocationText: `Various locations within the City of ${name}` });
};
const county = (name: string, raw?: string) =>
  loc({ label: `${name} County (site not specified)`, precision: "county", displayPoint: countyCentroid(name), displayPointBasis: "county_centroid", countyNames: [name], rawLocationText: raw ?? `Various locations, ${name} County` });
const statewide = () => loc({ label: "Statewide", precision: "statewide", rawLocationText: "Services may be required at agency sites throughout Washington State", resolutionConfidence: "high" });
const unknown = (raw: string | null = null) => loc({ label: "Not stated in the listing", precision: "unknown", rawLocationText: raw, resolutionConfidence: null, resolutionMethod: null });
const remote = () => loc({ label: "No physical work site", precision: "remote", rawLocationText: "Software subscription delivered remotely", resolutionConfidence: "high" });

const day = (v: string | null, raw?: string): DateValue | null => (v ? { rawText: raw ?? v, value: v, precision: "date", timeZone: TZ } : null);
const at = (v: string, raw: string): DateValue => ({ rawText: raw, value: v, precision: "datetime", timeZone: TZ });

type ReqSeed = [Requirement["category"], string, boolean | null, Requirement["extractionStatus"]?];
const REG: ReqSeed = ["license", "Bidder must hold an active Washington State contractor registration at bid time.", true];
const BOND: ReqSeed = ["bonding", "A bid guarantee of 5% of the total bid amount must accompany each bid.", true];
const WAGE: ReqSeed = ["compliance", "Washington prevailing wage rates apply to all work.", true];
const INS: ReqSeed = ["insurance", "Commercial general liability insurance is required before contract execution.", true];

interface Seed {
  id: string;
  agencyId: string;
  title: string;
  type: [string | null, Opportunity["solicitationType"]["normalized"]];
  ref: string | null;
  cats: WorkCategoryId[];
  locations: PerformanceLocation[];
  published: string | null;
  amended?: string | null;
  deadline: DateValue | null;
  firstSeen: string;
  scope: string | null;
  reqs: ReqSeed[];
  reqCompleteness?: Opportunity["requirementsCompleteness"];
  value?: string;
  contact?: { name: string; role: string; email: string | null; phone: string | null };
  docs?: [string, Opportunity["documentLinks"][number]["access"]][];
  status?: Opportunity["status"];
  completeness?: string[];
}

const seeds: Seed[] = [
  {
    id: "dev-001", agencyId: "ag-tacoma", title: "Pacific Avenue South pavement patching and pothole repair", type: ["Invitation to Bid", "itb"], ref: "DEV-TAC-0412",
    cats: ["paving", "pothole_repair"], locations: [site("Pacific Ave S, S 72nd St to S 96th St", -122.4348, 47.1905, "Pierce", "Tacoma", "road_segment")],
    published: "2026-10-20", deadline: at("2026-11-12T14:00:00-08:00", "November 12, 2026 at 2:00 PM"), firstSeen: "2026-10-21T09:12:00Z",
    scope: "Saw-cut and patch failed asphalt, fill potholes, and restore striping along about two miles of Pacific Avenue South. Work occurs at night under traffic control.",
    reqs: [REG, BOND, WAGE, ["schedule", "Lane closures allowed only between 8:00 PM and 5:00 AM.", true]], value: "Engineer's estimate: $185,000 to $240,000",
    contact: { name: "Procurement desk", role: "Purchasing", email: "bids@tacoma.example.org", phone: "(253) 555-0141" }, docs: [["Bid documents (PDF)", "public"], ["Plan sheets", "login_required"]],
  },
  {
    id: "dev-002", agencyId: "ag-tacoma", title: "South 56th Street drainage improvements", type: ["Invitation to Bid", "itb"], ref: "DEV-TAC-0419",
    cats: ["drainage", "excavation"], locations: [site("S 56th St and S Tacoma Way", -122.4651, 47.2196, "Pierce", "Tacoma", "address")],
    published: "2026-10-14", amended: "2026-10-22", deadline: at("2026-11-19T14:00:00-08:00", "November 19, 2026, 2:00 p.m."), firstSeen: "2026-10-15T08:00:00Z",
    scope: "Install new catch basins and about 600 feet of storm pipe, and regrade the adjacent shoulder to stop recurring street flooding.",
    reqs: [REG, BOND, WAGE, ["site_visit", "A pre-bid site walk is scheduled. Attendance is encouraged but not required.", false]],
  },
  {
    id: "dev-003", agencyId: "ag-pierce", title: "2027 countywide crack seal program", type: ["Request for Bids", "itb"], ref: "DEV-PC-27-011",
    cats: ["paving"], locations: [county("Pierce", "County-maintained roads, various locations")],
    published: "2026-10-08", deadline: day("2026-11-24", "November 24, 2026"), firstSeen: "2026-10-09T10:00:00Z",
    scope: "Crack sealing on county-maintained roads during the 2027 season, with locations assigned by work order.",
    reqs: [REG, BOND, ["experience", "Three crack seal contracts of similar size completed in the last five years.", true]],
  },
  {
    id: "dev-004", agencyId: "ag-pierce", title: "Canyon Road East shoulder grading and ditch reshaping", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-PC-SW-2231",
    cats: ["grading", "drainage"], locations: [site("Canyon Rd E, 112th St E to 136th St E", -122.3601, 47.1302, "Pierce", null, "road_segment")],
    published: "2026-10-22", deadline: at("2026-11-04T11:00:00-08:00", "Nov 4, 2026 11:00 AM"), firstSeen: "2026-10-22T16:40:00Z",
    scope: "Reshape roadside ditches and regrade gravel shoulders along a two-mile stretch to restore drainage.",
    reqs: [REG, WAGE],
  },
  {
    id: "dev-005", agencyId: "ag-seattle", title: "Rainier Avenue South curb ramps and sidewalk panels", type: ["Invitation to Bid", "itb"], ref: "DEV-SEA-PW-2026-118",
    cats: ["concrete"], locations: [site("Rainier Ave S and S Alaska St", -122.2846, 47.5598, "King", "Seattle", "address"), site("Rainier Ave S and S Henderson St", -122.2585, 47.5226, "King", "Seattle", "address")],
    published: "2026-10-16", deadline: at("2026-11-18T14:00:00-08:00", "November 18, 2026, 2 PM"), firstSeen: "2026-10-17T07:30:00Z",
    scope: "Replace curb ramps and damaged sidewalk panels at two intersections to meet current accessibility standards.",
    reqs: [REG, BOND, WAGE, INS, ["compliance", "Women- and minority-owned business inclusion plan required with bid.", true]],
  },
  {
    id: "dev-006", agencyId: "ag-seattle", title: "Magnuson Park wetland edge landscape restoration", type: ["Request for Quotes", "rfq"], ref: "DEV-SEA-PK-0337",
    cats: ["landscaping", "site_prep"], locations: [site("Magnuson Park, northeast wetland area", -122.2551, 47.6812, "King", "Seattle")],
    published: "2026-10-01", deadline: at("2026-11-06T16:00:00-08:00", "November 6, 2026 by 4:00 PM"), firstSeen: "2026-10-02T09:00:00Z",
    scope: "Remove invasive vegetation, prepare planting beds, and install about 4,000 native plants with one year of establishment care.",
    reqs: [["experience", "Experience with native plant restoration projects.", null, "needs_review"], INS],
  },
  {
    id: "dev-007", agencyId: "ag-king", title: "SE 208th Street culvert replacement", type: ["Invitation to Bid", "itb"], ref: "DEV-KC-RD-1187",
    cats: ["drainage", "excavation"], locations: [site("SE 208th St near 148th Ave SE", -122.1428, 47.4149, "King", null, "road_segment")],
    published: "2026-09-29", amended: "2026-10-19", deadline: at("2026-11-10T13:30:00-08:00", "November 10, 2026 1:30 PM"), firstSeen: "2026-09-30T12:00:00Z",
    scope: "Replace an undersized culvert with a fish-passable box culvert, including excavation, bypass, and stream restoration.",
    reqs: [REG, BOND, WAGE, ["compliance", "Work must follow the in-water work window in the project permits.", true], ["experience", "Prior fish-passage culvert installation.", true]],
  },
  {
    id: "dev-008", agencyId: "ag-king", title: "Unincorporated King County asphalt overlay, various roads", type: ["Invitation to Bid", "itb"], ref: "DEV-KC-RD-1192",
    cats: ["paving"], locations: [county("King", "Various county roads in unincorporated King County")],
    published: null, deadline: at("2026-12-03T14:00:00-08:00", "December 3, 2026, 2:00 PM"), firstSeen: "2026-10-23T08:00:00Z",
    scope: "Grind and overlay about eleven lane-miles across several unincorporated roads.", reqs: [REG, BOND, WAGE],
    completeness: ["Publication date not shown on the listing"],
  },
  {
    id: "dev-009", agencyId: "ag-snohomish", title: "Lowell Larimer Road ditch maintenance", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-SNO-SW-0921",
    cats: ["drainage", "grading"], locations: [site("Lowell Larimer Rd, Snohomish", -122.1477, 47.9361, "Snohomish", null, "road_segment")],
    published: "2026-10-23", deadline: at("2026-11-05T10:00:00-08:00", "11/05/2026 10:00 AM"), firstSeen: "2026-10-23T18:00:00Z",
    scope: "Clean and reshape roadside ditches and replace two driveway culverts.", reqs: [REG, WAGE],
  },
  {
    id: "dev-010", agencyId: "ag-everett", title: "Riverfront site preparation, phase 2", type: ["Invitation to Bid", "itb"], ref: "DEV-EVT-2026-44",
    cats: ["site_prep", "excavation", "grading"], locations: [site("Everett Riverfront, East Marine View Dr", -122.1836, 47.9703, "Snohomish", "Everett")],
    published: "2026-10-12", deadline: at("2026-12-01T15:00:00-08:00", "December 1, 2026 at 3 PM"), firstSeen: "2026-10-13T08:00:00Z",
    scope: "Clearing, mass excavation, and rough grading for a future park and trail, including erosion control.",
    reqs: [REG, BOND, WAGE, ["equipment", "Bidder must have access to equipment for mass excavation of about 25,000 cubic yards.", true]],
    value: "Estimated $1.1M to $1.4M",
  },
  {
    id: "dev-011", agencyId: "ag-spokane-city", title: "Arterial pothole repair, on-call 2027", type: ["Request for Bids", "itb"], ref: "DEV-SPK-27-003",
    cats: ["pothole_repair", "paving"], locations: [city("Spokane")],
    published: "2026-10-19", deadline: day("2026-11-20", "November 20, 2026"), firstSeen: "2026-10-19T20:00:00Z",
    scope: "On-call pothole and small-area patching on city arterials, with work dispatched by the Street Department.",
    reqs: [REG, ["schedule", "Respond to emergency call-outs within 24 hours.", true], INS],
  },
  {
    id: "dev-012", agencyId: "ag-spokane-county", title: "Bigelow Gulch Road shoulder grading", type: ["Invitation to Bid", "itb"], ref: "DEV-SC-ENG-551",
    cats: ["grading", "excavation"], locations: [site("Bigelow Gulch Rd, Argonne Rd to Forker Rd", -117.2995, 47.7166, "Spokane", null, "road_segment")],
    published: "2026-10-05", deadline: at("2026-11-09T10:00:00-08:00", "November 9, 2026, 10:00 a.m."), firstSeen: "2026-10-06T08:00:00Z",
    scope: "Widen and regrade road shoulders and stabilize cut slopes ahead of a future paving project.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-013", agencyId: "ag-spokane-city", title: "Riverfront Park landscape maintenance", type: ["Request for Proposals", "rfp"], ref: "DEV-SPK-PK-118",
    cats: ["landscaping"], locations: [site("Riverfront Park", -117.4199, 47.6609, "Spokane", "Spokane")],
    published: "2026-09-25", deadline: at("2026-11-07T15:00:00-08:00", "November 7, 2026 3:00 PM"), firstSeen: "2026-09-26T08:00:00Z",
    scope: "Seasonal turf, bed, and irrigation maintenance for the park over a two-year term.", reqs: [INS, ["other", "Pesticide applicator license for any chemical application.", true]],
  },
  {
    id: "dev-014", agencyId: "ag-yakima", title: "North 1st Street sidewalk concrete replacement", type: ["Invitation to Bid", "itb"], ref: "DEV-YAK-2026-31",
    cats: ["concrete"], locations: [site("N 1st St, E Yakima Ave to E I St", -120.5036, 46.6104, "Yakima", "Yakima", "road_segment")],
    published: "2026-10-21", deadline: at("2026-11-17T14:00:00-08:00", "November 17, 2026 2:00 PM"), firstSeen: "2026-10-21T15:00:00Z",
    scope: "Remove and replace damaged sidewalk, curb, and gutter along eight blocks.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-015", agencyId: "ag-yakima", title: "Ahtanum Road drainage swales", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-YAK-SW-77",
    cats: ["drainage", "landscaping"], locations: [site("Ahtanum Rd near S 64th Ave", -120.6012, 46.5662, "Yakima", null, "road_segment")],
    published: "2026-10-10", deadline: at("2026-11-03T14:00:00-08:00", "November 3, 2026 2:00 PM"), firstSeen: "2026-10-10T19:00:00Z",
    scope: "Build vegetated swales along the roadway and seed disturbed areas.", reqs: [REG, WAGE],
  },
  {
    id: "dev-016", agencyId: "ag-vancouver", title: "Fourth Plain Boulevard pavement rehabilitation", type: ["Invitation to Bid", "itb"], ref: "DEV-VAN-PW-0610",
    cats: ["paving"], locations: [site("E Fourth Plain Blvd, Andresen Rd to Garrison Rd", -122.6, 45.6477, "Clark", "Vancouver", "road_segment")],
    published: "2026-10-07", deadline: at("2026-11-21T14:00:00-08:00", "November 21, 2026, 2:00 PM"), firstSeen: "2026-10-08T08:00:00Z",
    scope: "Full-depth repair of failed sections followed by a two-inch overlay.", reqs: [REG, BOND, WAGE, INS],
  },
  {
    id: "dev-017", agencyId: "ag-clark", title: "Salmon Creek trailhead site preparation", type: ["Request for Quotes", "rfq"], ref: "DEV-CC-PR-208",
    cats: ["site_prep", "grading"], locations: [site("Salmon Creek Regional Park", -122.6635, 45.7108, "Clark", null)],
    published: "2026-10-18", deadline: at("2026-11-13T12:00:00-08:00", "November 13, 2026 noon"), firstSeen: "2026-10-18T22:00:00Z",
    scope: "Clear and grade a trailhead parking area and install a compacted gravel base.", reqs: [REG, WAGE],
  },
  {
    id: "dev-018", agencyId: "ag-bellingham", title: "Squalicum Parkway stormwater pond excavation", type: ["Invitation to Bid", "itb"], ref: "DEV-COB-2026-0225",
    cats: ["excavation", "drainage"], locations: [site("Squalicum Pkwy at Birchwood Ave", -122.5043, 48.7703, "Whatcom", "Bellingham")],
    published: "2026-10-11", deadline: at("2026-11-16T11:00:00-08:00", "November 16, 2026, 11:00 AM"), firstSeen: "2026-10-12T08:00:00Z",
    scope: "Excavate and line a stormwater detention pond, with inlet and outlet structures.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-019", agencyId: "ag-whatcom", title: "Gravel road grading, various county roads", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-WC-SW-1093",
    cats: ["grading"], locations: [county("Whatcom", "Gravel roads in eastern Whatcom County")],
    published: "2026-10-24", deadline: day("2026-11-14", "November 14, 2026"), firstSeen: "2026-10-24T17:00:00Z",
    scope: "Blade grading and spot gravel on county-maintained gravel roads.", reqs: [REG],
  },
  {
    id: "dev-020", agencyId: "ag-olympia", title: "Capitol Way concrete sidewalk repairs", type: ["Invitation to Bid", "itb"], ref: "DEV-OLY-PW-26-19",
    cats: ["concrete"], locations: [city("Olympia")],
    published: "2026-10-02", deadline: at("2026-11-02T14:00:00-08:00", "November 2, 2026 2:00 PM"), firstSeen: "2026-10-03T08:00:00Z",
    scope: "Grind trip hazards and replace sidewalk panels at locations listed in the bid documents.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-021", agencyId: "ag-thurston", title: "Yelm Highway drainage improvements", type: ["Invitation to Bid", "itb"], ref: "DEV-TC-PW-418",
    cats: ["drainage", "excavation"], locations: [site("Yelm Hwy SE near Spurgeon Creek Rd", -122.7891, 46.9927, "Thurston", null, "road_segment")],
    published: "2026-10-15", deadline: at("2026-11-23T14:00:00-08:00", "November 23, 2026 2:00 PM"), firstSeen: "2026-10-15T20:00:00Z",
    scope: "Install storm pipe, a bioretention cell, and ditch improvements along the highway shoulder.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-022", agencyId: "ag-chelan-pud", title: "Rocky Reach access road grading", type: ["Request for Bids", "itb"], ref: "DEV-CPUD-26-114",
    cats: ["grading", "site_prep"], locations: [site("Rocky Reach Dam access road", -120.2952, 47.5314, "Chelan", null)],
    published: "2026-10-06", deadline: at("2026-11-12T10:00:00-08:00", "November 12, 2026 10 AM"), firstSeen: "2026-10-07T08:00:00Z",
    scope: "Regrade and resurface a gravel maintenance road and improve roadside drainage.",
    reqs: [REG, ["compliance", "Site safety orientation and background check for dam access.", true]],
  },
  {
    id: "dev-023", agencyId: "ag-benton-pud", title: "Substation site preparation, Kennewick area", type: ["Invitation to Bid", "itb"], ref: "DEV-BPUD-2026-09",
    cats: ["site_prep", "excavation"], locations: [city("Kennewick")],
    published: "2026-10-17", deadline: at("2026-11-25T14:00:00-08:00", "November 25, 2026 2:00 PM"), firstSeen: "2026-10-17T21:00:00Z",
    scope: "Clearing, excavation, and engineered fill for a new substation pad. The exact parcel is in the bid documents.",
    reqs: [REG, BOND, ["compliance", "Utility electrical safety training for all on-site staff.", true]],
  },
  {
    id: "dev-024", agencyId: "ag-walla-walla", title: "Isaacs Avenue pothole and patch repair", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-WW-SW-31",
    cats: ["pothole_repair", "paving"], locations: [site("Isaacs Ave, Wilbur Ave to Tausick Way", -118.3093, 46.0757, "Walla Walla", "Walla Walla", "road_segment")],
    published: "2026-10-21", deadline: at("2026-11-06T14:00:00-08:00", "November 6, 2026 2:00 PM"), firstSeen: "2026-10-22T08:00:00Z",
    scope: "Patch potholes and failed areas ahead of winter.", reqs: [REG],
  },
  {
    id: "dev-025", agencyId: "ag-port-pa", title: "Waterfront stormwater outfall repair", type: ["Invitation to Bid", "itb"], ref: "DEV-PPA-2026-07",
    cats: ["drainage", "concrete", "excavation"], locations: [site("Port Angeles Terminal 3", -123.4436, 48.1229, "Clallam", "Port Angeles")],
    published: "2026-10-09", deadline: at("2026-11-20T14:00:00-08:00", "November 20, 2026, 2:00 PM"), firstSeen: "2026-10-10T08:00:00Z",
    scope: "Replace a damaged outfall pipe and concrete headwall at the shoreline.", reqs: [REG, BOND, WAGE, ["compliance", "In-water work allowed only during the permitted fish window.", true]],
  },
  {
    id: "dev-026", agencyId: "ag-grays", title: "Storm damage culvert repairs, three sites", type: ["Invitation to Bid", "itb"], ref: "DEV-GH-PW-26-3",
    cats: ["drainage", "excavation"],
    locations: [site("Wishkah Rd, milepost 6", -123.7934, 47.0715, "Grays Harbor", null, "road_segment"), site("Wynoochee Valley Rd, milepost 3", -123.6107, 47.0274, "Grays Harbor", null, "road_segment"), site("East Satsop Rd near Schafer Park", -123.4867, 47.0809, "Grays Harbor", null, "road_segment")],
    published: "2026-10-13", deadline: at("2026-11-17T11:00:00-08:00", "November 17, 2026 11:00 AM"), firstSeen: "2026-10-14T08:00:00Z",
    scope: "Replace three storm-damaged culverts and repair road embankments.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-027", agencyId: "ag-mount-vernon", title: "Riverwalk concrete repairs", type: ["Request for Quotes", "rfq"], ref: "DEV-MV-26-12",
    cats: ["concrete"], locations: [site("Mount Vernon Riverwalk", -122.3373, 48.4188, "Skagit", "Mount Vernon")],
    published: "2026-09-02", deadline: at("2026-11-08T14:00:00-08:00", "November 8, 2026 2:00 PM"), firstSeen: "2026-10-24T08:00:00Z",
    scope: "Repair cracked concrete walkway sections and replace two stair landings.", reqs: [REG],
    completeness: ["First collected on October 24 although published September 2"],
  },
  {
    id: "dev-028", agencyId: "ag-grant", title: "Airport perimeter road grading", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-GC-SW-412",
    cats: ["grading"], locations: [city("Moses Lake")],
    published: "2026-10-20", deadline: null, firstSeen: "2026-10-20T18:00:00Z",
    scope: "Regrade a gravel perimeter road. Closing date to be announced by addendum.", reqs: [REG], completeness: ["Deadline not yet published"],
  },
  {
    id: "dev-029", agencyId: "ag-kitsap", title: "Bremerton-area shoulder paving and drainage", type: ["Invitation to Bid", "itb"], ref: "DEV-KIT-PW-26-55",
    cats: ["paving", "drainage", "concrete"], locations: [site("Kitsap Way near Northlake Way", -122.6837, 47.5847, "Kitsap", "Bremerton", "road_segment")],
    published: "2026-10-16", deadline: at("2026-11-30T14:00:00-08:00", "November 30, 2026 2:00 PM"), firstSeen: "2026-10-16T19:00:00Z",
    scope: "Pave shoulders, install curb and gutter, and add catch basins along a half-mile segment.", reqs: [REG, BOND, WAGE],
  },
  {
    id: "dev-030", agencyId: "ag-wa-state", title: "Statewide asphalt patching master contract", type: ["Request for Bids", "itb"], ref: "DEV-WA-MC-26-02",
    cats: ["paving", "pothole_repair"], locations: [statewide()],
    published: "2026-10-03", deadline: at("2026-12-10T14:00:00-08:00", "December 10, 2026 2:00 PM"), firstSeen: "2026-10-04T08:00:00Z",
    scope: "A master contract that state agencies and participating local governments can use to order asphalt patching services.",
    reqs: [REG, INS, ["other", "Ability to serve at least one of six defined regions.", true]],
  },
  {
    id: "dev-031", agencyId: "ag-wa-parks", title: "Landscape maintenance services, statewide parks", type: ["Request for Proposals", "rfp"], ref: "DEV-PARKS-26-14",
    cats: ["landscaping"], locations: [statewide()],
    published: "2026-10-10", deadline: at("2026-11-28T16:00:00-08:00", "November 28, 2026 4:00 PM"), firstSeen: "2026-10-11T08:00:00Z",
    scope: "Regional landscape maintenance at state parks. Vendors propose the regions they can serve.", reqs: [INS],
  },
  {
    id: "dev-032", agencyId: "ag-bethel-sd", title: "On-call excavation and hauling", type: ["Request for Quotes", "rfq"], ref: "DEV-BSD-26-08",
    cats: ["excavation"], locations: [unknown("District facilities as assigned")],
    published: "2026-10-18", deadline: at("2026-11-15T15:00:00-08:00", "November 15, 2026 3:00 PM"), firstSeen: "2026-10-18T19:00:00Z",
    scope: "On-call excavation and hauling at district facilities. Sites are assigned per task order.", reqs: [REG, INS],
  },
  {
    id: "dev-033", agencyId: "ag-lewis", title: "Public works services, see bid documents", type: [null, null], ref: null,
    cats: [], locations: [county("Lewis", "Lewis County")],
    published: "2026-10-22", deadline: day("2026-11-19", "November 19, 2026"), firstSeen: "2026-10-22T20:00:00Z",
    scope: null, reqs: [], reqCompleteness: "not_extracted", docs: [["Bid documents", "login_required"]],
    completeness: ["Scope only available in documents that require a portal login"],
  },
  {
    id: "dev-034", agencyId: "ag-seattle", title: "Network monitoring software subscription", type: ["Request for Proposals", "rfp"], ref: "DEV-SEA-IT-0091",
    cats: ["it_services"], locations: [remote()],
    published: "2026-10-09", deadline: at("2026-11-13T16:00:00-08:00", "November 13, 2026 4:00 PM"), firstSeen: "2026-10-10T08:00:00Z",
    scope: "Three-year subscription for network performance monitoring software.", reqs: [["other", "SOC 2 Type II report.", true]],
  },
  {
    id: "dev-035", agencyId: "ag-bethel-sd", title: "Janitorial services, district offices", type: ["Request for Proposals", "rfp"], ref: "DEV-BSD-26-11",
    cats: ["janitorial"], locations: [county("Pierce", "District administrative offices, Pierce County")],
    published: "2026-10-12", deadline: at("2026-11-09T15:00:00-08:00", "November 9, 2026 3:00 PM"), firstSeen: "2026-10-12T19:00:00Z",
    scope: "Nightly janitorial services for three district office buildings.", reqs: [INS],
  },
  {
    id: "dev-036", agencyId: "ag-ewu", title: "Classroom furniture supply", type: ["Request for Quotes", "rfq"], ref: "DEV-EWU-26-303",
    cats: ["supplies"], locations: [unknown(null)],
    published: "2026-10-19", deadline: at("2026-11-04T14:00:00-08:00", "November 4, 2026 2:00 PM"), firstSeen: "2026-10-19T20:00:00Z",
    scope: "Supply and deliver classroom desks and chairs.", reqs: [],
  },
  {
    id: "dev-037", agencyId: "ag-everett", title: "Evergreen Way median landscaping", type: ["Small Works Roster Quote", "small_works"], ref: "DEV-EVT-SW-61",
    cats: ["landscaping", "concrete"], locations: [site("Evergreen Way, 41st St SE to 50th St SE", -122.2134, 47.9449, "Snohomish", "Everett", "road_segment")],
    published: "2026-10-24", deadline: at("2026-11-10T14:00:00-08:00", "November 10, 2026 2:00 PM"), firstSeen: "2026-10-24T18:00:00Z",
    scope: "Replace median plantings and repair concrete curbing along the median.", reqs: [REG, WAGE],
  },
  {
    id: "dev-038", agencyId: "ag-tacoma", title: "Tacoma Dome District sidewalk and drainage", type: ["Invitation to Bid", "itb"], ref: "DEV-TAC-0397",
    cats: ["concrete", "drainage"], locations: [site("E 25th St and East D St", -122.4282, 47.2398, "Pierce", "Tacoma", "address")],
    published: "2026-09-18", deadline: at("2026-10-20T14:00:00-07:00", "October 20, 2026 2:00 PM"), firstSeen: "2026-09-19T08:00:00Z",
    scope: "Sidewalk replacement and storm inlet upgrades. The bid deadline has passed.", reqs: [REG, BOND, WAGE],
  },
];

export const FIXTURE_OPPORTUNITIES: Opportunity[] = seeds.map((s) => {
  const located = s.locations.filter((l) => l.displayPoint);
  const approx = s.locations.some((l) => ["city", "county", "region"].includes(l.precision));
  const locationStatus: Opportunity["locationStatus"] =
    s.locations.length > 1 ? "multiple" : s.locations[0].precision === "statewide" ? "statewide" : s.locations[0].precision === "remote" ? "remote" : !located.length ? "unknown" : approx ? "approximate" : "located";
  return {
    id: s.id,
    version: "1",
    sourceReferences: [{ sourceId: "dev-fixture", sourceNativeId: s.ref, url: null, evidenceRef: null }],
    agencyId: s.agencyId,
    title: s.title,
    solicitationType: { sourceLabel: s.type[0], normalized: s.type[1] },
    status: s.status ?? "open",
    statusBasis: "Development fixture",
    description: s.scope,
    summary: s.scope,
    summaryIsGenerated: !!s.scope,
    workCategories: s.cats.map((id) => ({ id, provenance: "source" as const })),
    classificationCodes: [],
    publication: day(s.published),
    amendment: day(s.amended ?? null),
    deadline: s.deadline,
    performanceStart: null,
    performanceEnd: null,
    locations: s.locations,
    locationStatus,
    requirements: s.reqs.map(([category, text, mandatory, extractionStatus], i) => ({ id: `${s.id}-r${i}`, category, text, mandatory, evidenceRef: null, extractionStatus: extractionStatus ?? "extracted" })),
    requirementsCompleteness: s.reqCompleteness ?? "partial",
    documentLinks: (s.docs ?? [["Solicitation documents", "unavailable"]]).map(([label, access]) => ({ label, url: null, access })),
    publicContact: s.contact ? { ...s.contact, evidenceRef: null } : null,
    publishedValue: s.value ? { amount: null, min: null, max: null, currency: "USD", rawText: s.value, evidenceRef: null } : null,
    firstSeenAt: s.firstSeen,
    lastVerifiedAt: FIXTURE_SNAPSHOT_AT,
    extractedAt: FIXTURE_SNAPSHOT_AT,
    sourceSnapshotAt: FIXTURE_SNAPSHOT_AT,
    completeness: s.completeness ?? [],
    isDevelopmentFixture: true,
  };
});
