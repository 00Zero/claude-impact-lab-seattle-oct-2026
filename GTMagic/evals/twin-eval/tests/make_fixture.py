"""Cut a small slice of the real dataset into tests/fixtures (run from twin-eval/).

python3 tests/make_fixture.py
"""
import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from twin_eval.data import FILES, SELF_DESCRIPTION_COL, SPENDING_QIDS  # noqa: E402
from twin_eval.tasks import EXPERIMENTS, PRICING_COLUMNS  # noqa: E402

SRC, DST, PEOPLE = Path("data"), Path("tests/fixtures"), 80

catalog = json.loads((SRC / FILES["catalog"]).read_text())
demo = [c for q in catalog if (q.get("BlockName") or "").strip() == "Demographics" for c in q["csv_columns"]]
cols = ["pid"] + demo + SPENDING_QIDS + [SELF_DESCRIPTION_COL] + PRICING_COLUMNS + \
    [c for e in EXPERIMENTS for cond in e.conditions for c in cond.columns]
DST.mkdir(parents=True, exist_ok=True)
(DST / FILES["catalog"]).write_text(json.dumps(
    [q for q in catalog if set(q.get("csv_columns") or []) & set(cols)], indent=1))
csv.field_size_limit(sys.maxsize)
rows4 = list(csv.DictReader((SRC / FILES["wave4"]).open()))
pids = set(random.Random(1).sample(sorted(r["pid"] for r in rows4), PEOPLE))
for key in ("wave1_3", "wave4"):
    with (SRC / FILES[key]).open() as f, (DST / FILES[key]).open("w", newline="") as g:
        reader = csv.DictReader(f)
        present = [c for c in cols if c in reader.fieldnames]
        w = csv.DictWriter(g, fieldnames=present)
        w.writeheader()
        for row in reader:
            if row["pid"] in pids:
                w.writerow({c: row[c] for c in present})
print(f"wrote {PEOPLE} people to {DST}")
