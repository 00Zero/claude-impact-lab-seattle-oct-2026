import type { Agency } from "@/lib/contracts";

// DEVELOPMENT FIXTURE AGENCIES.
// Names and website URLs come from the team's agency spreadsheet
// (Hack-a-thon 102526.xlsx). Email and phone values are deliberately fake
// (example.org addresses, 555-01xx numbers) or left null so the contact
// handoff can be exercised without inventing real contact details.

type Seed = [id: string, name: string, type: Agency["agencyType"], jurisdiction: string, website: string | null, email: string | null, phone: string | null];

const seeds: Seed[] = [
  ["ag-tacoma", "City of Tacoma", "city", "Tacoma", "https://tacoma.gov/", "bids@tacoma.example.org", "(253) 555-0141", ],
  ["ag-pierce", "Pierce County", "county", "Pierce County", "https://www.piercecountywa.gov/", null, "(253) 555-0102"],
  ["ag-seattle", "City of Seattle", "city", "Seattle", "https://www.seattle.gov/", "purchasing@seattle.example.org", null],
  ["ag-king", "King County", "county", "King County", "https://kingcounty.gov/", null, null],
  ["ag-snohomish", "Snohomish County", "county", "Snohomish County", "https://snohomishcountywa.gov/", "procurement@snoco.example.org", "(425) 555-0177"],
  ["ag-everett", "City of Everett", "city", "Everett", "https://www.everettwa.gov/", null, "(425) 555-0119"],
  ["ag-spokane-city", "City of Spokane", "city", "Spokane", "https://my.spokanecity.org/administrative/purchasing/procurement-portal/", "purchasing@spokane.example.org", "(509) 555-0160"],
  ["ag-spokane-county", "Spokane County", "county", "Spokane County", "https://www.spokanecounty.gov/", null, null],
  ["ag-yakima", "City of Yakima", "city", "Yakima", "https://www.yakimawa.gov/", "bids@yakima.example.org", "(509) 555-0133"],
  ["ag-vancouver", "City of Vancouver", "city", "Vancouver", "https://www.cityofvancouver.us/", null, "(360) 555-0188"],
  ["ag-clark", "Clark County", "county", "Clark County", "https://clark.wa.gov", null, null],
  ["ag-bellingham", "City of Bellingham", "city", "Bellingham", "https://cob.org", "purchasing@cob.example.org", "(360) 555-0124"],
  ["ag-whatcom", "Whatcom County", "county", "Whatcom County", "https://www.whatcomcounty.us", null, null],
  ["ag-olympia", "City of Olympia", "city", "Olympia", "https://www.olympiawa.gov", "bids@olympia.example.org", null],
  ["ag-thurston", "Thurston County", "county", "Thurston County", "https://www.thurstoncountywa.gov", null, "(360) 555-0150"],
  ["ag-chelan-pud", "Chelan County PUD", "utility", "Chelan County", "https://www.chelanpud.org/vendors-and-contractors/information-for-all-vendors-and-contractors", null, null],
  ["ag-benton-pud", "Benton PUD", "utility", "Benton County", "https://www.bentonpud.org/procurement", "contracts@bentonpud.example.org", "(509) 555-0171"],
  ["ag-walla-walla", "Walla Walla County", "county", "Walla Walla County", "https://www.wallawallawa.gov", null, null],
  ["ag-port-pa", "Port of Port Angeles", "port", "Clallam County", "https://portofpa.com", null, "(360) 555-0139"],
  ["ag-grays", "Grays Harbor County", "county", "Grays Harbor County", "https://www.graysharbor.us", null, null],
  ["ag-mount-vernon", "City of Mount Vernon", "city", "Mount Vernon", "https://www.mountvernonwa.gov", "bids@mountvernon.example.org", null],
  ["ag-grant", "Grant County", "county", "Grant County", "https://www.grantcountywa.gov/", null, null],
  ["ag-kitsap", "Kitsap County", "county", "Kitsap County", "https://www.kitsap.gov", null, "(360) 555-0108"],
  ["ag-lewis", "Lewis County", "county", "Lewis County", "https://lewiscountywa.gov", null, null],
  ["ag-wa-state", "State of Washington", "state", "Washington", "https://wa.gov/", null, null],
  ["ag-wa-parks", "Washington State Parks and Recreation Commission", "state", "Washington", null, null, null],
  ["ag-bethel-sd", "Bethel School District", "school", "Pierce County", "https://www.bethelsd.org", null, null],
  ["ag-ewu", "Eastern Washington University", "university", "Spokane County", "https://www.ewu.edu", null, null],
];

export const FIXTURE_AGENCIES: Agency[] = seeds.map(([id, name, agencyType, jurisdiction, websiteUrl, email, phone]) => ({
  id,
  name,
  sourceNames: [name],
  agencyType,
  jurisdiction,
  websiteUrl,
  email,
  phone,
  contactSource: "Development fixture. Website from the agency spreadsheet; email and phone are placeholders.",
  sourceIds: [],
  inventoryOrigin: "Hack-a-thon 102526.xlsx",
  procurementCoverage: "not_checked",
}));
