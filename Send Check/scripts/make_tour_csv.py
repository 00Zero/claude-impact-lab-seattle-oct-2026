"""Generate the synthetic past-guest list for the tour-operator apology fixture (#21).

Saltwind Kayak & Whale Tours, 520 past guests, fictional people with example.com
emails. Fixed seed, so the file is the same every time. Writes
corpus/fixtures/data/saltwind-tours-guests.csv.

Usage: uv run python scripts/make_tour_csv.py
"""
from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "corpus" / "fixtures" / "data" / "saltwind-tours-guests.csv"
FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Jamie", "Avery", "Quinn",
         "Drew", "Rowan", "Parker", "Reese", "Skyler", "Emerson", "Hayden", "Kendall", "Logan", "Blair"]
LAST = ["Rivera", "Chen", "Okafor", "Novak", "Haddad", "Lindqvist", "Moreau", "Tanaka", "Silva",
        "Kowalski", "Nguyen", "Brennan", "Duarte", "Feld", "Gupta", "Ivanova", "Mbeki", "Ortiz"]
TOURS = ["half-day sea kayak", "whale-watch paddle", "sunset paddle", "full-day island circuit"]
NO_SHOW_DATES = [date(2026, 8, 9), date(2026, 8, 16)]

# (count, first-trip range, last-trip range, trips range, stranded, booked 2027)
GROUPS = [
    (31, (date(2024, 6, 1), date(2026, 8, 16)), None, (1, 2), True, False),
    (58, (date(2019, 6, 1), date(2025, 9, 30)), (date(2024, 6, 1), date(2026, 9, 30)), (1, 6), False, True),
    (140, (date(2019, 6, 1), date(2023, 9, 30)), (date(2024, 6, 1), date(2026, 9, 30)), (3, 9), False, False),
    (120, (date(2024, 6, 1), date(2026, 9, 30)), None, (1, 1), False, False),
    (171, (date(2019, 6, 1), date(2023, 9, 30)), None, (1, 1), False, False),
]


def day_between(rng: random.Random, start: date, end: date) -> date:
    """A random tour-season day (May to September) in [start, end]."""
    while True:
        day = start + timedelta(days=rng.randint(0, (end - start).days))
        if 5 <= day.month <= 9:
            return day


def main() -> None:
    rng = random.Random(20261025)
    rows = []
    for count, first_range, last_range, trips, stranded, booked in GROUPS:
        for _ in range(count):
            first, last = rng.choice(FIRST), rng.choice(LAST)
            first_trip = day_between(rng, *first_range)
            n = rng.randint(*trips)
            if stranded:
                last_trip = rng.choice(NO_SHOW_DATES)
                first_trip = min(first_trip, last_trip) if n > 1 else last_trip
            elif last_range:
                last_trip = max(first_trip, day_between(rng, *last_range))
            else:
                last_trip = first_trip
            rows.append({
                "name": f"{first} {last}",
                "email": f"{first}.{last}{rng.randint(1, 999)}@example.com".lower(),
                "first_trip": first_trip.isoformat(),
                "last_trip": last_trip.isoformat(),
                "trips": n,
                "last_tour": rng.choice(TOURS),
                "party_size": rng.randint(1, 5),
                "aug_2026_shuttle_no_show": "yes" if stranded else "no",
                "booked_2027": day_between(rng, date(2027, 5, 15), date(2027, 9, 15)).isoformat()
                               if booked else "",
                "deposit_paid": rng.choice([150, 200, 300]) if booked else 0,
            })
    rng.shuffle(rows)
    rows = [{"guest_id": f"G{i:04d}", **row} for i, row in enumerate(rows, 1)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
