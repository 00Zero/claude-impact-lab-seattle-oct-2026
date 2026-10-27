#!/usr/bin/env python3
"""Claim 1: the GTMagic pipeline (50/50 blend of Claude Opus and the simulated panel) vs Claude Opus alone.

For each demographic group with >= 25 people in a split, compare against the group's real mean rating of the 18 cards:
- Opus (high): predictions/vanilla-opus-high/segments.json (Opus asked for the group's average rating)
- Panel: predictions/sonnet-persona-demo/<split>-*.json (Claude Sonnet, high, one simulated twin per real person,
  demographics only), averaged within the group
- Pipeline: 0.5 * Opus + 0.5 * panel (weight fixed in advance, not tuned)
Paired bootstrap over groups (groups share people, so the CIs are somewhat optimistic).

Usage (from evals/): /path/to/python-with-numpy scripts/pipeline_blend.py
"""
import glob
import json
import os

import numpy as np

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "benchmarks", "megastudy")
CARDS = [f"c{i:02d}" for i in range(1, 19)]


def main() -> None:
    opus = json.load(open(os.path.join(HERE, "predictions", "vanilla-opus-high", "segments.json")))
    rng = np.random.default_rng(11)
    for split in ("val", "test"):
        people = {p["id"]: p for p in json.load(open(os.path.join(HERE, f"{split}.truth.json")))["people"]}
        twins = {}
        for f in glob.glob(os.path.join(HERE, "predictions", "sonnet-persona-demo", f"{split}-*.json")):
            twins.update(json.load(open(f)))
        groups = sorted({g for p in people.values() for g in p["segments"]})
        rows = []
        for g in groups:
            members = [i for i, p in people.items() if g in p["segments"] and i in twins]
            if len(members) < 25:
                continue
            truth = np.mean([people[i]["ratings"] for i in members], 0)
            panel = np.mean([[twins[i][c] for c in CARDS] for i in members], 0)
            op = np.array([opus[g][c] for c in CARDS])
            blend = 0.5 * panel + 0.5 * op
            rows.append([np.corrcoef(x, truth)[0, 1] for x in (op, panel, blend)] + [np.abs(x - truth).mean() for x in (op, panel, blend)])
        r = np.array(rows)
        n = len(r)
        print(f"\n{split.upper()}: {n} groups (n >= 25)")
        for j, name in enumerate(("Claude Opus (high)", "Simulated panel (Sonnet high)", "GTMagic pipeline (50/50)")):
            print(f"  {name:32s} card r {r[:, j].mean():.3f}   MAE {r[:, j + 3].mean():.3f}")
        d, dm = r[:, 2] - r[:, 0], r[:, 5] - r[:, 3]
        bs = sorted(np.mean(d[rng.integers(0, n, n)]) for _ in range(4000))
        bm = sorted(np.mean(dm[rng.integers(0, n, n)]) for _ in range(4000))
        print(f"  pipeline - Opus: card r {d.mean():+.3f} [{bs[100]:+.3f}, {bs[3900]:+.3f}]   "
              f"MAE {dm.mean():+.3f} [{bm[100]:+.3f}, {bm[3900]:+.3f}] ({dm.mean() / r[:, 3].mean():+.0%})   "
              f"pipeline better on {int((d > 0).sum())}/{n} groups")


if __name__ == "__main__":
    main()
