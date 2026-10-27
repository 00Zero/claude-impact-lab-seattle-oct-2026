"""Generate the synthetic customer list for the price-increase fixture (#1).

Cascade Self Storage, 340 renters, fictional people with example.com emails.
Fixed seed, so the file is the same every time. Writes
corpus/fixtures/data/cascade-storage-customers.csv.

Usage: uv run python scripts/make_sample_csv.py
"""
from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "corpus" / "fixtures" / "data" / "cascade-storage-customers.csv"
AS_OF = date(2026, 10, 25)
FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Jamie", "Avery", "Quinn",
         "Drew", "Rowan", "Parker", "Reese", "Skyler", "Emerson", "Hayden", "Kendall", "Logan", "Blair"]
LAST = ["Rivera", "Chen", "Okafor", "Novak", "Haddad", "Lindqvist", "Moreau", "Tanaka", "Silva",
        "Kowalski", "Nguyen", "Brennan", "Duarte", "Feld", "Gupta", "Ivanova", "Mbeki", "Ortiz"]

# (count, unit_type, tenure days range, rate_type, rate range, late payments, billing options)
GROUPS = [
    (140, "household", (20, 175), "standard", (89, 149), (0, 1), ["card"]),
    (60, "household", (3700, 6200), "standard", (89, 149), (0, 0), ["card", "ACH"]),
    (90, "household", (400, 2200), "negotiated", (69, 119), (0, 1), ["card", "ACH"]),
    (50, "commercial", (200, 3000), "standard", (189, 349), (0, 2), ["invoice", "ACH"]),
]


def main() -> None:
    rng = random.Random(20261025)
    rows = []
    for count, unit, tenure, rate_type, rate, late, billing in GROUPS:
        for _ in range(count):
            first, last = rng.choice(FIRST), rng.choice(LAST)
            rows.append({
                "name": f"{first} {last}",
                "email": f"{first}.{last}{rng.randint(1, 999)}@example.com".lower(),
                "unit_type": unit,
                "move_in_date": (AS_OF - timedelta(days=rng.randint(*tenure))).isoformat(),
                "rate_type": rate_type,
                "monthly_rate": rng.randint(*rate),
                "late_payments_12m": rng.randint(*late),
                "billing": rng.choice(billing),
            })
    rng.shuffle(rows)
    for i, row in enumerate(rows, 1):
        row = {"customer_id": f"C{i:04d}", **row}
        rows[i - 1] = row
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
