"""Split a customer list into segments without showing Claude the rows.

Two steps, both reading the file locally:

    python3 segment_csv.py profile customers.csv
        Drops columns that look like personal data (names, emails, phones,
        addresses, IDs, free text, protected characteristics) and prints
        JSON summaries of the rest: ranges, common values, counts.

    python3 segment_csv.py apply customers.csv --rules '{"segments": [
        {"label": "10+ year tenants", "why": "...",
         "rules": [{"column": "move_in_date", "op": ">=", "value": "3650"}]}]}'
        Applies the proposed rules to the real rows (all rules in a segment
        must hold; rows go to the first matching segment; the rest become
        "Everyone else") and prints each segment's exact size and facts.

ops: < <= > >= == != in (comma-separated values). Date columns are in days ago.
CSV only. Standard library only. Runs from the plugin root layout:
skills/send-check/scripts/segment_csv.py -> scorers/autosegment.py.
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))


def main() -> None:
    if len(sys.argv) not in (3, 5) or sys.argv[1] not in ("profile", "apply"):
        print(json.dumps({"error": "usage: segment_csv.py profile <file.csv> | "
                                   "apply <file.csv> --rules '<json>'"}))
        return
    try:
        from scorers.autosegment import apply, prepare, read_csv
    except ImportError as e:
        print(json.dumps({"error": f"scorers not found next to the skill: {e}"}))
        return

    path = Path(sys.argv[2]).expanduser()
    if path.suffix.lower() != ".csv":
        print(json.dumps({"error": "save the list as CSV first (File > Save As or Export > CSV)"}))
        return
    try:
        rows = read_csv(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as e:
        print(json.dumps({"error": f"couldn't read {path.name}: {e}"}))
        return
    clean, summaries, skipped = prepare(rows)

    if sys.argv[1] == "profile":
        print(json.dumps({"rows": len(rows), "columns": summaries,
                          "kept_private": skipped}, indent=2))
        return

    try:
        # --rules '<json>' matches the plugin's permission rule; stdin does not
        proposal = json.loads(sys.argv[4], strict=False) if sys.argv[3:4] == ["--rules"] else json.load(sys.stdin)
        segments = [SimpleNamespace(label=s["label"], why=s.get("why", ""),
                                    rules=[SimpleNamespace(**r) for r in s["rules"]])
                    for s in proposal["segments"]]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(json.dumps({"error": f"expected JSON with segments, each with label and rules: {e}"}))
        return
    result, notes = apply(SimpleNamespace(segments=segments), clean, summaries)
    print(json.dumps({"rows": len(rows), "segments": [asdict(s) for s in result],
                      "notes": notes}, indent=2))


if __name__ == "__main__":
    main()
