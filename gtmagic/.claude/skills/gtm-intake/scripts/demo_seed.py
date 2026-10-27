#!/usr/bin/env python3
"""Seed a demo workspace from the cached demo run, so nobody hand-copies evidence on stage.

Usage: python3 demo_seed.py <fixtures/demo/intake.json> <workspace-folder>

Appends to <workspace>/research-log.jsonl (one source line per cached evidence record, one
search line per skeptic query; earlier lines such as a website fetch are kept) and <workspace>/evidence.json (the cached evidence, concerns and
skeptic entries to load into intake.json). It never copies readiness checks or the owner's
confirmation: the demo still has to earn "ready".
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip().splitlines()[2])
        return 64
    fixture, workspace = sys.argv[1], sys.argv[2]
    with open(fixture, encoding="utf-8") as f:
        brief = json.load(f)
    os.makedirs(workspace, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    lines = [{"kind": "search", "query": q, "at": now} for s in brief.get("skeptic", []) for q in s.get("queries", [])]
    lines += [{"kind": "source", "url": e["url"], "title": e.get("title", ""), "excerpt": e["excerpt"], "at": now}
              for e in brief.get("evidence", []) if e.get("url")]
    with open(os.path.join(workspace, "research-log.jsonl"), "a", encoding="utf-8") as f:  # never erase earlier log lines
        f.writelines(json.dumps(line, ensure_ascii=False) + "\n" for line in lines)
    cached = {k: brief.get(k, []) for k in ("evidence", "concerns", "skeptic")}
    with open(os.path.join(workspace, "evidence.json"), "w", encoding="utf-8") as f:
        json.dump(cached, f, indent=2, ensure_ascii=False)
    print(f"seeded {workspace}: {len(lines)} log lines, {len(cached['evidence'])} evidence records")
    return 0


if __name__ == "__main__":
    sys.exit(main())
