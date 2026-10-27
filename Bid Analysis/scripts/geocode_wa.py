"""Place Washington sources on the map.

Reads data/sources.seed.json and writes data/agencies/wa_geo.json, an
{"updates": [...]} file that build_seed.py folds in by id (lat, lng, and county/city
when they were blank). Run build_seed.py afterwards to regenerate the seed.

Lookup order per source: its city (GeoNames, preferring a match in its county), a
place named in the source name ("City of X", "X School District", "Port of X"), then
its county's centre. Sources with nothing to go on (statewide, platforms) stay blank.

Inputs are those of build_or_id_agencies.py plus ZIP centroids for towns too small
for GeoNames (fetch with `npm pack cities.json us-atlas@3.0.1 zipcodes@8.0.0` and untar):

Usage: python scripts/geocode_wa.py --cities PATH --counties PATH --zips zipcodes/package/lib/codes.js
"""

import argparse
import json
import re
from pathlib import Path

import build_or_id_agencies as geo

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "sources.seed.json"
OUT = ROOT / "data" / "agencies" / "wa_geo.json"

geo.STATE_FIPS["WA"] = "53"

# Misspellings in the spreadsheet's county column.
COUNTY_ALIASES = {"wallawalla": "Walla Walla", "cowilitz": "Cowlitz", "grays": "Grays Harbor",
                  "pend": "Pend Oreille", "whkiakum": "Wahkiakum"}

# Home city of regional agencies whose name doesn't say where they are.
# Statewide agencies and platforms are left off the map on purpose.
HOME_CITY = {
    "wa-higher-ed-eastern-washington-university": "Cheney",
    "wa-higher-ed-western-washington-university": "Bellingham",
    "wa-utility-clark-public-utilities": "Vancouver",
    "wa-utility-energy-northwest": "Richland",
    "wa-utility-kitsap-public-utility-district-1": "Poulsbo",
    "wa-utility-mason-pud-3": "Shelton",
    "wa-transit-whatcom-transportation-authority": "Bellingham",
    "wa-port-port-of-grays-harbor": "Aberdeen",
    "wa-port-port-of-camas-washougal": "Camas",
    "wa-port-chelan-douglas-regional-port-authority": "Wenatchee",
    "wa-hospital-spokane-regional-health-district": "Spokane",
    "wa-emergency-comms-rivercom-911": "Wenatchee",
    "wa-emergency-comms-kitsap-911-public-authority": "Bremerton",
    "wa-emergency-comms-thurston-911-communications": "Olympia",
    "wa-emergency-comms-south-sound-911-public-authority": "Tacoma",
    "wa-fire-puget-sound-regional-fire-authority": "Kent",
    "wa-fire-south-king-fire": "Federal Way",
    "wa-parks-bainbridge-island-metropolitan-park-recreation-district": "Bainbridge Island",
    "wa-parks-peninsula-metropolitan-park-district": "Gig Harbor",
    "wa-water-sammamish-plateau-water-and-sewer-district": "Sammamish",
    "wa-water-south-columbia-basin-irrigation-district": "Pasco",
    "wa-school-clover-park-school-district-400": "Lakewood",
    "wa-school-central-kitsap-school-district-401": "Silverdale",
    "wa-school-tahoma-school-district-409": "Maple Valley",
    "wa-school-vashon-island-school-district-402": "Vashon",
    "wa-school-east-valley-school-district-no-361": "Spokane Valley",
    "wa-school-evergreen-school-district-114": "Vancouver",
    "wa-school-educational-service-district-123": "Pasco",
    "wa-school-dieringer-school-district": "Bonney Lake",
    "wa-school-skamania-school-district": "Stevenson",
    "wa-fire-west-thurston-regional-fire-authority": "Rochester",
    "wa-special-district-washington-state-convention-center-public-facilities-district": "Seattle",
}

# Words that follow a place name in agency names and are not part of it.
SUFFIX = re.compile(
    r"\s+(school district|sd|public schools|schools|county|pud|public utility district|"
    r"public hospital district|phd|hospital district|water( and| &) sewer district|"
    r"water district|sewer district|irrigation district|fire( and rescue| district| authority)?|"
    r"transit|park( and| &) recreation district|parks|port district|valley|unified)\b.*$",
    re.I,
)


def candidates(name):
    """Place names to try, most specific first."""
    out = []
    m = re.match(r"(?:city|town) of (.+?)(?:\s*\(.*\))?$", name, re.I)
    if m:
        out.append(m.group(1))
    m = re.match(r"port of (.+?)(?:\s*\(.*\))?$", name, re.I)
    if m:
        out.append(m.group(1))
    base = re.sub(r"\s*\(.*?\)|\s*(#|no\.\s*)?\d+$", "", name, flags=re.I)
    stem = SUFFIX.sub("", base).strip()
    if stem and stem != base:
        out.append(stem)
    for m in re.finditer(r"\(([^)]+)\)", name):  # "East Valley School District (Yakima)"
        out.append(m.group(1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", required=True)
    ap.add_argument("--counties", required=True)
    ap.add_argument("--zips", required=True)
    args = ap.parse_args()

    places = geo.load_places(args.cities, "WA")
    counties = geo.county_centroids(args.counties, "WA")
    fips_to_county = {v["fips"]: k for k, v in counties.items()}
    county_by_norm = {geo.norm(k): k for k in counties}
    county_by_norm.update(COUNTY_ALIASES)
    zips, _ = json.JSONDecoder().raw_decode(Path(args.zips).read_text().split("=", 1)[1].strip())
    towns = {}
    for z in zips.values():
        if z["state"] == "WA":
            towns.setdefault(geo.norm(z["city"]), []).append((z["latitude"], z["longitude"]))

    def place(city, county=None):
        cands = places.get(geo.norm(city), [])
        for lat, lng, fips in cands:
            if county is None or fips_to_county.get(fips) == county:
                return round(lat, 5), round(lng, 5), fips_to_county.get(fips)
        if county is None and geo.norm(city) in towns:  # ZIP centroid: no county to check against
            pts = towns[geo.norm(city)]
            return (round(sum(p[0] for p in pts) / len(pts), 5),
                    round(sum(p[1] for p in pts) / len(pts), 5), None)
        return None

    def county_of(r):
        if r["county"]:
            return county_by_norm.get(geo.norm(r["county"]), r["county"])
        # A county named in the name: "Grant County PHD #3", "Okanogan-Douglas Counties PHD".
        lower = r["name"].lower()
        for c in sorted(counties, key=len, reverse=True):
            if re.search(rf"\b{c.lower()}(-\w+)? count(y|ies)\b", lower):
                return c
        return None

    updates, how = [], {}
    for r in json.loads(SEED.read_text()):
        if r["state"] != "WA" or r["lat"] is not None:
            continue
        county = county_of(r)
        hit, method = None, None
        if r["agency_type"] != "county":
            home = HOME_CITY.get(r["id"])
            for name in ([home] if home else []) + ([r["city"]] if r["city"] else []) + candidates(r["name"]):
                hit = place(name, county) or (place(name) if not county else None)
                if hit:
                    method = "home" if name == home else "city" if name == r["city"] else "name"
                    break
        if hit:
            lat, lng, c = hit
            county = county or c
        elif county in counties:
            lat, lng, method = counties[county]["lat"], counties[county]["lng"], "county_centroid"
        else:
            how["none"] = how.get("none", 0) + 1
            continue
        u = {"id": r["id"], "lat": lat, "lng": lng}
        if not r["county"] and county:
            u["county"] = county
        updates.append(u)
        how[method] = how.get(method, 0) + 1

    OUT.write_text(json.dumps({"updates": updates}, indent=2) + "\n")
    print(f"{len(updates)} WA sources placed: {how}")


if __name__ == "__main__":
    main()
