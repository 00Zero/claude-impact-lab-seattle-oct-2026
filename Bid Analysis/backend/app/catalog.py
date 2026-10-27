"""Apply the frontend's CatalogFilter to bid rows (a subset of src/lib/catalogQuery.ts).
Not implemented: agencyIds / agencyTypes (need the sources join). fitTiers is applied by the frontend after matching."""

from datetime import date, datetime, timedelta, timezone

from .models import Bid, CatalogFilter
from .taxonomy import norm_categories, normalize_county


def apply_filter(bids: list[Bid], f: CatalogFilter, now: datetime | None = None) -> list[Bid]:
    now = now or datetime.now(timezone.utc)
    counties = {normalize_county(c) for c in f.county_names}
    q = f.query.strip().lower()
    out = []
    for b in bids:
        if q and q not in " ".join(filter(None, [b.title, b.summary, b.description, b.agency])).lower():
            continue
        if f.work_categories and not set(f.work_categories) & set(norm_categories(b.categories)):
            continue
        has_place = bool(b.county) or (b.lat is not None and b.lng is not None)
        if not has_place and not f.include_unknown_locations:
            continue
        if counties and b.county and normalize_county(b.county) not in counties:
            continue
        if counties and not b.county and not f.include_unknown_locations:
            continue
        if f.viewport_bounds and b.lat is not None and b.lng is not None:
            v = f.viewport_bounds
            if not (v.south <= b.lat <= v.north and v.west <= b.lng <= v.east):
                continue
        if f.published_within_days is not None:
            if b.posted_date is None:
                if not f.include_unknown_dates:
                    continue
            elif b.posted_date < date.today() - timedelta(days=f.published_within_days):
                continue
        if f.deadline_within_days == "unknown":
            if b.deadline is not None:
                continue
        elif isinstance(f.deadline_within_days, int):
            if b.deadline is None or b.deadline > now + timedelta(days=f.deadline_within_days):
                continue
        out.append(b)
    return out
