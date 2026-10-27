"""NAICS code -> title lookup, loaded from backend/data/naics.csv (currently NAICS 2017)."""

import csv
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "naics.csv"


@lru_cache(maxsize=1)
def load_titles() -> dict[str, str]:
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"{DATA_FILE} not found. Run: python scripts/build_naics_csv.py <NAICS codes xlsx>"
        )
    with DATA_FILE.open(newline="", encoding="utf-8") as f:
        return {row["code"]: row["title"] for row in csv.DictReader(f)}


def title_for(code: str) -> str | None:
    return load_titles().get(code.strip())
