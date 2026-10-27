"""Pull open bids from shared portals and agency bid pages into the `bids` table.

Adapters (pick with --platform, default: all):
  civicplus   CivicPlus "Bids.aspx" pages. One extractor covers many small WA/OR/ID cities.
  opengov     OpenGov Procurement portals (procurement.opengov.com/portal/<code>), e.g. Pierce County.
  oregonbuys  OregonBuys open-bid search (statewide OR, plus local agencies that post there).
  oracle      Oracle Fusion "Solicitation Abstracts" pages (NegotiationAbstracts), e.g. King County.

Sources come from data/sources.seed.json plus data/agencies/*.json, chosen by `platform`
(civicplus also matches any procurement_url containing "Bids.aspx").

Output follows docs/bid-data-model.md. With --dry-run (default when no secret key is set)
rows are written to data/bids.pulled.json. Otherwise they are upserted to Supabase on
`source_url` using SUPABASE_URL and SUPABASE_SECRET_KEY from the environment.

Usage:
  python scripts/pull_bids.py --platform civicplus --limit 20 --dry-run
  SUPABASE_URL=... SUPABASE_SECRET_KEY=... python scripts/pull_bids.py
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
UA = "BidAnalytics/0.1 (hackathon; finds public bids for small vendors)"
TIMEOUT = 25
PACIFIC = ZoneInfo("America/Los_Angeles")

# Plain work types matching the intake chips. Keyword match on title + description.
CATEGORY_WORDS = {
    "paving": ["paving", "asphalt", "overlay", "chip seal", "pavement"],
    "concrete": ["concrete", "sidewalk", "curb", "ada ramp"],
    "landscaping": ["landscap", "mowing", "tree ", "trees", "irrigation", "grounds maint"],
    "janitorial": ["janitorial", "custodial", "cleaning services"],
    "snow_removal": ["snow", "de-icing", "deicing"],
    "roofing": ["roof"],
    "painting": ["painting", "paint "],
    "electrical": ["electrical", "lighting", "generator"],
    "plumbing": ["plumbing", "water main", "sewer", "storm drain", "culvert"],
    "hvac": ["hvac", "mechanical", "boiler", "heating"],
    "construction": ["construction", "renovation", "remodel", "improvement", "replacement"],
    "fencing": ["fence", "fencing"],
    "it": ["software", "network", "it services", "computer", "cyber"],
    "vehicles": ["vehicle", "truck", "fleet"],
    "consulting": ["consult", "engineering services", "design services", "study"],
}

BID_TYPES = [("rfq", r"\bRFQ\b|request for qualifications|request for quotes?"),
             ("rfp", r"\bRFP\b|request for proposals?"),
             ("rfi", r"\bRFI\b|request for information"),
             ("itb", r"\bITB\b|\bIFB\b|invitation (to|for) bids?"),
             ("small_works", r"small works"),
             ("roster", r"\broster\b")]

DATE_RE = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})(?:\s+(\d{1,2}:\d{2})\s*([AP]M))?", re.I)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_date(text):
    """First m/d/yyyy [h:mm AM] in text -> ISO string in Pacific time (DST-aware)."""
    m = DATE_RE.search(text or "")
    if not m:
        return None
    d = datetime.strptime(m.group(1), "%m/%d/%Y")
    if m.group(2):
        t = datetime.strptime(f"{m.group(2)} {m.group(3).upper()}", "%I:%M %p")
        d = d.replace(hour=t.hour, minute=t.minute)
    return d.replace(tzinfo=PACIFIC).isoformat()


def classify(text):
    low = (text or "").lower()
    # Match at word starts so "roof" doesn't hit "frost-proof".
    cats = [c for c, words in CATEGORY_WORDS.items() if any(re.search(r"\b" + re.escape(w), low) for w in words)]
    bid_type = next((t for t, pat in BID_TYPES if re.search(pat, text or "", re.I)), "other")
    return cats, bid_type


def base_row(source, title, url, **kw):
    cats, bid_type = classify(f"{title} {kw.get('description') or ''}")
    row = {
        "source_id": source["id"],
        "agency": source["name"] if source["agency_type"] != "platform" else kw.pop("agency", None) or source["name"],
        "title": title.strip(),
        "source_url": url,
        "bid_type": bid_type,
        "status": "open",
        "categories": cats,
        "state": source["state"] if source["state"] in ("WA", "OR", "ID") else None,
        "county": source.get("county"),
        "city": source.get("city"),
        "lat": source.get("lat"),
        "lng": source.get("lng"),
        "last_checked": now_iso(),
    }
    kw.pop("agency", None)
    row.update({k: v for k, v in kw.items() if v is not None})
    return row


def get(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


# --- CivicPlus Bids.aspx -----------------------------------------------------------

def civicplus_url(source):
    url = source.get("procurement_url") or ""
    if "bids.aspx" in url.lower():
        return url
    home = source.get("homepage_url") or url
    if not home:
        return None
    p = urlparse(home)
    return f"{p.scheme}://{p.netloc}/Bids.aspx"


def pull_civicplus(source):
    url = civicplus_url(source)
    if not url:
        return []
    soup = BeautifulSoup(get(url), "html.parser")
    rows, seen = [], set()
    for a in soup.find_all("a", href=re.compile(r"bidID=\d+", re.I)):
        href = urljoin(url, a["href"])
        title = a.get_text(" ", strip=True)
        if not title or href in seen or title.lower() in ("more", "read on", "view"):
            continue
        seen.add(href)
        box = (a.find_parent(class_=re.compile("listItemsRow", re.I))
               or a.find_parent(class_=re.compile("bidItem", re.I)) or a.parent.parent)
        text = box.get_text(" ", strip=True) if box else ""
        if re.search(r"\b(closed|awarded|cancel)", text, re.I) and not re.search(r"\bopen\b", text, re.I):
            continue
        closes = re.search(r"Closes?:?\s*(.{0,40})", text, re.I)
        # Award notices and bid results get posted on Bids.aspx too; without a closing date they aren't open bids.
        if re.search(r"\baward|bid results|bid tab", title, re.I) and not (closes and parse_date(closes.group(1))):
            continue
        number = re.search(r"Bid (?:No\.?|Number|#):?\s*([\w\-./]*\d[\w\-./]*)", text, re.I)
        try:
            contact = civicplus_contact(href)
        except Exception:  # the listing row is still worth keeping
            contact = {}
        rows.append(base_row(source, title, href,
                             deadline=parse_date(closes.group(1)) if closes else None,
                             solicitation_number=number.group(1) if number else None,
                             contact_name=contact.get("name"),
                             contact_email=contact.get("email"),
                             contact_phone=contact.get("phone"),
                             contact_title=contact.get("title"),
                             extraction_method="html",
                             raw={"listing_url": url, "text": text[:1000], "contact": contact or None}))
    return rows


EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?", re.I)


def cf_decode(hexstr):
    """Undo Cloudflare's email obfuscation (data-cfemail)."""
    key = int(hexstr[:2], 16)
    return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))


def civicplus_contact(url):
    """The 'Contact Person:' block on a Bids.aspx detail page: name, title, email, phone."""
    soup = BeautifulSoup(get(url), "html.parser")
    for el in soup.select("[data-cfemail]"):
        el.replace_with(cf_decode(el["data-cfemail"]))
    lines = soup.get_text("\n", strip=True).split("\n")
    try:
        start = next(i for i, l in enumerate(lines) if l.lower().startswith("contact person"))
    except StopIteration:
        return {}
    block = []
    for l in lines[start + 1:start + 12]:
        # The block ends at the next field label ("Download Available:", "Related Documents:", ...).
        if l.endswith(":") and not re.match(r"(email|e-mail|tel|phone)\b", l, re.I):
            break
        block.append(l)
    text = " ".join(block)
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    names = [l for l in block if not re.search(r"@|\d{3}|^(email|tel|phone|fax)\b", l, re.I)]
    return {k: v for k, v in {
        "name": names[0] if names else None,
        "title": names[1] if len(names) > 1 else None,
        "email": email.group(0) if email else None,
        "phone": phone.group(0) if phone else None,
    }.items() if v}


# --- OpenGov Procurement -----------------------------------------------------------

def opengov_code(source):
    m = re.search(r"procurement\.opengov\.com/portal/(?:embed/)?([\w-]+)", source.get("procurement_url") or "")
    return m.group(1) if m else None


def opengov_contact(d):
    """Named project contact, falling back to the procurement officer."""
    for pre in ("contact", "procurement"):
        if d.get(f"{pre}Email") or d.get(f"{pre}FullName"):
            addr = ", ".join(x for x in [d.get(f"{pre}Address1"), d.get(f"{pre}Address2"), d.get(f"{pre}City"),
                                         " ".join(x for x in [d.get(f"{pre}State"), d.get(f"{pre}ZipCode")] if x)] if x)
            return {k: v for k, v in {
                "name": d.get(f"{pre}FullName"), "title": d.get(f"{pre}Title"),
                "email": d.get(f"{pre}Email"), "phone": d.get(f"{pre}PhoneComplete") or d.get(f"{pre}Phone"),
                "address": addr or None}.items() if v}
    return {}


OPENGOV_NAICS_SET, OPENGOV_NIGP_SET = 200, 100


def opengov_codes(d):
    """Project categories -> (NAICS, NIGP) lists of (code, title). For NAICS, keep only the
    most specific codes: '517' is dropped when '5173' is also listed."""
    cats = d.get("categories") or []
    naics = {c["code"]: c["title"] for c in cats if c.get("setId") == OPENGOV_NAICS_SET}
    leaves = [(c, t) for c, t in sorted(naics.items()) if not any(o != c and o.startswith(c) for o in naics)]
    nigp = [(c["code"], c["title"]) for c in cats if c.get("setId") == OPENGOV_NIGP_SET]
    return leaves, nigp


def pull_opengov(source):
    """The portal page sits behind a Cloudflare check, but its JSON API answers plain requests."""
    code = opengov_code(source)
    if not code:
        return []
    api = f"https://api.procurement.opengov.com/api/v1/government/{code}/project/public"
    body = {"filters": [{"type": "status", "value": "open"}], "limit": 100}
    r = requests.post(api, json=body, headers={"User-Agent": UA}, timeout=TIMEOUT)
    r.raise_for_status()
    now = datetime.now(timezone.utc)
    rows = []
    for p in r.json().get("rows", []):
        deadline = p.get("proposalDeadline")
        if p.get("status") != "open" or p.get("isPrivate") or p.get("comingSoon"):
            continue
        # Portals also list outreach events and forms; they aren't solicitations.
        if re.search(r"^outreach event|verification form|data room access", p["title"], re.I):
            continue
        if deadline and datetime.fromisoformat(deadline.replace("Z", "+00:00")) <= now:
            continue
        summary = BeautifulSoup(p.get("summary") or "", "html.parser").get_text(" ", strip=True)
        try:
            detail = requests.get(f"https://api.procurement.opengov.com/api/v1/project/{p['id']}",
                                  headers={"User-Agent": UA}, timeout=TIMEOUT).json()
        except Exception:
            detail = {}
        contact = opengov_contact(detail)
        naics, nigp = opengov_codes(detail)
        rows.append(base_row(source, p["title"], f"https://procurement.opengov.com/portal/{code}/projects/{p['id']}",
                             solicitation_number=p.get("financialId"),
                             description=summary[:4000] or None,
                             deadline=deadline,
                             posted_date=(p.get("releaseProjectDate") or "")[:10] or None,
                             questions_due_at=detail.get("qaDeadline"),
                             prebid_at=detail.get("preProposalDate"),
                             contact_name=contact.get("name"),
                             contact_email=contact.get("email"),
                             contact_phone=contact.get("phone"),
                             contact_title=contact.get("title"),
                             contact_address=contact.get("address"),
                             naics_codes=[c for c, _ in naics] or None,
                             extraction_method="api",
                             raw={"listing_url": api, "id": p["id"], "contact": contact or None,
                                  "naics": [{"code": c, "title": t} for c, t in naics] or None,
                                  "nigp": [{"code": c, "title": t} for c, t in nigp] or None,
                                  "department": (p.get("department") or {}).get("name"),
                                  "template": (p.get("template") or {}).get("title")}))
    return rows


# --- OregonBuys ---------------------------------------------------------------------

OREGONBUYS_SEARCH = "https://oregonbuys.gov/bso/view/search/external/advancedSearchBid.xhtml?openBids=true"


def pull_oregonbuys(source, max_pages=10):
    """OregonBuys (Periscope BSO) is a JSF form: open the search, submit it, read the table."""
    from playwright.sync_api import sync_playwright
    rows = []
    with sync_playwright() as p:
        page = p.chromium.launch().new_page(user_agent=UA)
        page.goto(OREGONBUYS_SEARCH, wait_until="networkidle", timeout=60000)
        btn = page.query_selector("button:has-text('Search'), input[value='Search']")
        if btn:
            btn.click()
            page.wait_for_load_state("networkidle")
        for _ in range(max_pages):
            table = page.query_selector("table[id*='bidSearchResult'], table.ui-datatable-table, table[role='grid']")
            if not table:
                break
            headers = [h.inner_text().strip().lower() for h in table.query_selector_all("thead th")]
            for tr in table.query_selector_all("tbody tr"):
                cells = [c.inner_text().strip() for c in tr.query_selector_all("td")]
                if len(cells) < 3:
                    continue
                rec = dict(zip(headers, cells))
                link = tr.query_selector("a[href*='bidDetail'], a")
                href = urljoin(OREGONBUYS_SEARCH, link.get_attribute("href")) if link else None
                number = rec.get("bid solicitation #") or cells[0]
                if not href or href.startswith("javascript"):
                    href = f"https://oregonbuys.gov/bso/external/bidDetail.sdo?docId={number}&external=true"
                rows.append(base_row(source, rec.get("description") or number, href,
                                     agency=rec.get("organization name"),
                                     solicitation_number=number,
                                     deadline=parse_date(rec.get("bid opening date", "")),
                                     contact_name=rec.get("buyer"),
                                     extraction_method="html",
                                     raw=rec))
            nxt = page.query_selector("a.ui-paginator-next:not(.ui-state-disabled)")
            if not nxt:
                break
            nxt.click()
            page.wait_for_load_state("networkidle")
    # Platform rows carry no location; agency-level geocoding is the matcher's fallback.
    return rows


# --- Oracle Fusion Solicitation Abstracts ------------------------------------------

CHROMIUM = os.environ.get("CHROMIUM_PATH")  # e.g. a preinstalled headless shell
ORACLE_TYPES = {"Construction Solicitation": ["construction"], "A&E Solicitation": ["consulting"]}


def oracle_rows(html):
    """Table rows: number[,amendment], title, type, status, posted, opens, closes."""
    out = {}
    for tr in BeautifulSoup(html, "html.parser").find_all("tr"):
        cells = [c for c in (td.get_text(" ", strip=True) for td in tr.find_all("td", recursive=False)) if c]
        if len(cells) >= 7 and re.fullmatch(r"[A-Z]{2,}\d+(,\d+)?", cells[0]):
            out[cells[0]] = cells[:7]
    return out


def pull_oracle(source, max_scrolls=15):
    """An ADF page that loads rows as the table scrolls. Rows are newest first, so stop
    once a few scrolls add nothing. Detail pages need a session, so bids link to the list."""
    url = source.get("procurement_url") or ""
    if "NegotiationAbstracts" not in url:
        return []
    from playwright.sync_api import sync_playwright
    seen, stall = {}, 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 3000})
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(12000)
        for _ in range(max_scrolls):
            before = len(seen)
            seen.update(oracle_rows(page.content()))
            stall = stall + 1 if len(seen) == before else 0
            if stall >= 3:
                break
            page.evaluate("() => document.querySelectorAll('div').forEach(d => {"
                          " if (d.scrollHeight > d.clientHeight + 20) d.scrollTop = d.scrollHeight; })")
            page.wait_for_timeout(2000)
        browser.close()
    # Amendments repeat a solicitation as "KC001711,2"; keep the latest active one.
    latest = {}
    for num, title, kind, status, posted, _opens, closes in seen.values():
        base, _, amend = num.partition(",")
        if status != "Active":
            continue
        if base not in latest or int(amend or 0) > latest[base][0]:
            latest[base] = (int(amend or 0), title, kind, posted, closes)
    now = datetime.now(timezone.utc)
    rows = []
    for base, (_amend, title, kind, posted, closes) in latest.items():
        deadline = oracle_date(closes)
        if deadline and datetime.fromisoformat(deadline) <= now:
            continue
        row = base_row(source, title, f"{url}&solicitation={base}",
                       solicitation_number=base, deadline=deadline,
                       posted_date=(oracle_date(posted) or "")[:10] or None,
                       extraction_method="html",
                       raw={"listing_url": url, "solicitation_type": kind})
        row["categories"] = sorted(set(row["categories"]) | set(ORACLE_TYPES.get(kind, [])))
        rows.append(row)
    return rows


def oracle_date(text):
    """'10/29/26 01:30:59 PM' (Pacific) -> ISO."""
    try:
        d = datetime.strptime(text.strip(), "%m/%d/%y %I:%M:%S %p")
    except (ValueError, AttributeError):
        return None
    return d.replace(tzinfo=PACIFIC).isoformat()


ADAPTERS = {"civicplus": pull_civicplus, "opengov": pull_opengov, "oregonbuys": pull_oregonbuys,
            "oracle": pull_oracle}


def load_sources():
    rows = json.load(open(ROOT / "data" / "sources.seed.json"))
    fixes = []
    for f in sorted((ROOT / "data" / "agencies").glob("*.json")):
        data = json.load(open(f))
        if isinstance(data, list):
            rows += data
        else:  # wa_procurement_fixes.json, discovered_portals.json: apply after every list is loaded
            fixes.append(data)
    for data in fixes:
        for u in data.get("updates", []):
            for r in rows:  # ids can repeat across lists; update every copy
                if r["id"] == u["id"]:
                    r.update(u)
        rows += data.get("new", [])
    return rows


def adapter_for(source):
    plat = (source.get("platform") or "").lower()
    url = (source.get("procurement_url") or "").lower()
    if plat == "oregonbuys":
        return "oregonbuys"
    if plat == "oracle" or "negotiationabstracts" in url:
        return "oracle"
    if plat == "opengov" or "procurement.opengov.com" in url:
        return "opengov"
    if plat == "civicplus" or "bids.aspx" in url:
        return "civicplus"
    return None


def upsert(rows):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/bids?on_conflict=source_url"
    key = os.environ["SUPABASE_SECRET_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=minimal"}
    for i in range(0, len(rows), 200):
        r = requests.post(url, headers=headers, data=json.dumps(rows[i:i + 200]), timeout=60)
        if r.status_code >= 300:
            sys.exit(f"Supabase upsert failed {r.status_code}: {r.text[:500]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", choices=sorted(ADAPTERS), action="append")
    ap.add_argument("--state", choices=["WA", "OR", "ID"])
    ap.add_argument("--limit", type=int, help="max sources per platform")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    dry = args.dry_run or not os.environ.get("SUPABASE_SECRET_KEY")

    wanted = set(args.platform or ADAPTERS)
    todo = {}
    for s in load_sources():
        name = adapter_for(s)
        # State and local agencies only: federal bids (SAM.gov) are out of scope.
        if s.get("agency_type") == "federal" or s.get("state") not in ("WA", "OR", "ID"):
            continue
        if name in wanted and (not args.state or s["state"] == args.state):
            todo.setdefault(name, []).append(s)

    found, errors = [], []
    for name, sources in todo.items():
        for s in sources[: args.limit]:
            try:
                rows = ADAPTERS[name](s)
                print(f"{name:10} {s['id']:45} {len(rows):3} open bids")
                found += rows
            except Exception as e:  # keep going; one dead page shouldn't stop the crawl
                errors.append({"source_id": s["id"], "adapter": name, "error": str(e)[:300]})
                print(f"{name:10} {s['id']:45} ERROR {str(e)[:120]}")

    dedup = {r["source_url"]: r for r in found}
    rows = list(dedup.values())
    print(f"{len(rows)} bids from {sum(len(v[: args.limit]) for v in todo.values())} sources, {len(errors)} errors")
    if dry:
        out = ROOT / "data" / "bids.pulled.json"
        out.write_text(json.dumps({"bids": rows, "errors": errors}, indent=2) + "\n")
        print(f"dry run: wrote {out.relative_to(ROOT)}")
    else:
        upsert(rows)
        print("upserted to Supabase")


if __name__ == "__main__":
    main()
