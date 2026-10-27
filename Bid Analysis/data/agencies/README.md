# Agency lists outside the spreadsheet

Rows here use the `sources` shape from `supabase/migrations` and get merged by `scripts/build_seed.py`.

- `or.json`, `id.json`: Oregon and Idaho agencies (counties, incorporated cities, school districts, ports, utilities, transit, higher ed, state agencies, shared portals). Built by `scripts/build_or_id_agencies.py`.
  - Counties come from Census shapes (us-atlas), cities from Wikipedia's incorporated-city lists, coordinates from GeoNames. Towns under ~1,000 people fall back to the county centre (`raw.geo = "county_centroid"`).
  - School-district and special-district lists are hand-curated. Expect a few gaps or name mismatches.
  - Almost no rows have a `procurement_url` yet (`status = "missing"`), so the discovery script should start here. Homepages marked "from memory; verify" are unchecked.
- `wa_procurement_fixes.json`: procurement-URL fills and data fixes for existing WA rows (King, Pierce, Snohomish, Bellevue, Everett; Chelan and Yakima county homepages pointed at the cities), plus the OMWBE bid board as a new WA platform.
- `wa_geo.json`: coordinates (and blank counties) for WA rows, built by `scripts/geocode_wa.py`. Each row is placed at its city (GeoNames, or a ZIP centroid for small towns), else a place named in the agency name, else its county's centre. 14 statewide agencies, platforms and junk rows stay off the map. `build_seed.py` applies `updates` after every file's new rows.
