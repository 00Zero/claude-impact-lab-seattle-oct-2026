"""Static audit of data/sources.seed.json. Flags rows that need a human look.

Usage: python3 scripts/audit_sources.py  -> data/audit/flags.json + summary on stdout
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
rows = json.loads((ROOT / "data" / "sources.seed.json").read_text())
TEST_COUNTIES = {"King", "Snohomish", "Pierce"}
OTHER_STATE = {"WA": ("colorado", ".co.us", "oregon", "idaho"), "OR": (".wa.gov", ".wa.us", "washington"), "ID": (".wa.gov", ".wa.us", ".or.us", "oregon.gov")}

def host(u):
    return urlparse(u).netloc.lower().removeprefix("www.") if u else None

def name_key(r):
    n = r["name"].lower()
    if r["agency_type"] == "school":  # "Woodland School District #404" == "Woodland School District"
        n = re.sub(r"\s*(no\.?|#)?\s*\d+$", "", n)
    return (r["state"], re.sub(r"[^a-z0-9]", "", n))

flags = defaultdict(list)
proc_dupes = Counter(r["procurement_url"] for r in rows if r["procurement_url"] and r["agency_type"] != "platform")
name_dupes = Counter(name_key(r) for r in rows)

for r in rows:
    p, h = r["procurement_url"], r["homepage_url"]
    add = lambda f: flags[r["id"]].append(f)
    if not p:
        add("no_procurement_url")
    if p and proc_dupes[p] > 1:
        add("procurement_url_shared")
    if name_dupes[name_key(r)] > 1:
        add("possible_duplicate")
    for u in (p, h):
        if u and any(s in u.lower() for s in OTHER_STATE.get(r["state"], ())):
            add("url_looks_out_of_state")
    if p and re.search(r"(19|20)\d\d-(19|20)\d\d|archive|closed|awarded", p.lower()):
        add("procurement_url_looks_archived")
    if p and p.lower().endswith(".pdf"):
        add("procurement_url_is_pdf")
    if p and h and host(p) and host(h) and host(p) != host(h) and r["platform"] == "custom":
        add("procurement_on_other_domain")
    if p and p.startswith("http://"):
        add("http_not_https")
    if r["lat"] is None:
        add("no_coordinates")
    if not h and r["agency_type"] != "platform":
        add("no_homepage")

out = []
for r in rows:
    out.append({
        "id": r["id"], "name": r["name"], "state": r["state"], "agency_type": r["agency_type"],
        "county": r["county"], "city": r["city"], "homepage_url": r["homepage_url"],
        "procurement_url": r["procurement_url"], "platform": r["platform"], "status": r["status"],
        "test_county": r["county"] in TEST_COUNTIES or (r["state"] == "WA" and r["agency_type"] == "platform"),
        "notes": r["notes"], "flags": flags[r["id"]],
    })
(ROOT / "data" / "audit").mkdir(parents=True, exist_ok=True)
(ROOT / "data" / "audit" / "flags.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")

c = Counter(f for fs in flags.values() for f in fs)
print(f"{len(rows)} sources")
for f, n in c.most_common():
    print(f"  {f:32} {n}")
print("test-county rows:", sum(o["test_county"] for o in out),
      "with procurement URL:", sum(1 for o in out if o["test_county"] and o["procurement_url"]))
