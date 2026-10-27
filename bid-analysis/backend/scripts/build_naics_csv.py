"""Convert a NAICS "2-6 digit codes listed numerically" xlsx (sheet 1: seq no, code, title) into backend/data/naics.csv.

Usage: python scripts/build_naics_csv.py <path to xlsx>

Current source: 2017-NAICS-2-3-4-5-6-Digit-Codes-Listed-Numerically.xlsx (NAICS 2017, not 2022).
Census blocks scripted downloads, so the 2022 file has to be downloaded in a browser.
"""

import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
OUT = Path(__file__).resolve().parent.parent / "data" / "naics.csv"


def read_rows(path: str) -> list[dict[str, str]]:
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared = ["".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")) for si in root.findall("m:si", NS)]
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for r in sheet.find("m:sheetData", NS):
        cells = {}
        for c in r:
            col = re.match(r"[A-Z]+", c.get("r")).group()
            v = c.find("m:v", NS)
            if v is not None:
                cells[col] = shared[int(v.text)] if c.get("t") == "s" else v.text
            else:
                inline = c.find("m:is", NS)
                if inline is not None:
                    cells[col] = "".join(t.text or "" for t in inline.iter(f"{{{NS['m']}}}t"))
        rows.append(cells)
    return rows


def clean_title(title: str) -> str:
    # Census marks titles that are comparable across US/Canada/Mexico with a trailing "T"
    return re.sub(r"\s+T$", "", re.sub(r"\s+", " ", title).strip())


def main(path: str) -> None:
    out = {}
    for row in read_rows(path):
        # data rows: column A = seq no, B = code, C = title
        code = row.get("B", "").strip()
        if re.fullmatch(r"\d{2,6}(-\d{2})?", code) and row.get("C"):
            out[code] = clean_title(row["C"])
    if len(out) < 1000:
        sys.exit(f"Only {len(out)} codes parsed; is this the 2-6 digit code file?")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["code", "title"])
        for code in sorted(out):
            w.writerow([code, out[code]])
    print(f"wrote {len(out)} codes to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
