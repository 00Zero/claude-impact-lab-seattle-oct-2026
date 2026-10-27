"""Test design: the order each customer sees the options in (used by build_test.py, and by the simulation
via ordering_index), and who is asked twice. Standard library only."""
from __future__ import annotations

import json
import random

REPEATS = 10  # customers asked again with their ordering reversed


def williams_square(labels: list[str]) -> list[list[str]]:
    """Every label in every position equally often, and (for an even count) right after every other label
    exactly once, so no option always follows the same one. An odd count needs the mirrored rows too."""
    n = len(labels)
    base, lo, hi = [0], 1, n - 1
    while len(base) < n:
        base.append(lo)
        lo += 1
        if len(base) < n:
            base.append(hi)
            hi -= 1
    rows = [[labels[(b + r) % n] for b in base] for r in range(n)]
    return rows if n % 2 == 0 else rows + [list(reversed(row)) for row in rows]


def ordering_index(segment_index: int, n_segments: int, j: int, k: int) -> int:
    """The ordering the j-th customer (from 0) of a segment sees. segment_index counts only segments that have
    customers in the sample, in intake.json segments[] order. Each segment starts at an evenly spaced row, so with
    equal-sized segments the whole sample sees every ordering within one of equally often. Plain j % k would stack
    every segment's leftover customers on the first rows."""
    return (segment_index * k // n_segments + j) % k


def pick_repeats(audience_path: str | None, rng: random.Random, warnings: list[str], seg_ids: set) -> list[str]:
    """About 10 customers, taken round-robin across segments, asked again with the ordering reversed."""
    if not audience_path:
        warnings.append("No audience sample given (--audience), so repeatCustomerIds is empty; "
                        f"the simulation should repeat {REPEATS} customers spread across segments.")
        return []
    by_seg: dict[str, list[str]] = {}
    with open(audience_path, encoding="utf-8") as f:
        audience = json.load(f)
    if not isinstance(audience, dict):
        raise SystemExit(f"ERROR {audience_path} must be a JSON object")
    for c in audience.get("customers") or []:
        if isinstance(c, dict) and isinstance(c.get("id"), str):
            by_seg.setdefault(str(c.get("segmentId")), []).append(c["id"])
    unknown = sorted(set(by_seg) - seg_ids)
    if unknown:
        warnings.append(f"the audience sample has customer groups intake.json doesn't: {', '.join(unknown)}; is it from the same run?")
    for ids in by_seg.values():
        rng.shuffle(ids)
    picked: list[str] = []
    while len(picked) < REPEATS and any(by_seg.values()):
        for seg in sorted(by_seg):
            if by_seg[seg] and len(picked) < REPEATS:
                picked.append(by_seg[seg].pop())
    return picked
