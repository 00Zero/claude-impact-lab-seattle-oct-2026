"""The experiment design, in plain code: seeds, the presentation orders, and the list of calls to make.

Randomness is built only on Random.random() from an integer seed, which is stable across Python
versions, so the same seed gives the same orders and draws on any machine (pre-registration needs that).
Labels follow position: the first ad shown is always "A", so letter bias and position bias are the same
thing, and the cyclic Latin square balances both.
"""
from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

LABELS = "ABCDEFGHIJKL"   # at most 12 ads in one set
MIN_ASSETS, MAX_ASSETS = 2, len(LABELS)
JUDGE_ROLES = ("judge-brief", "judge-plain")


def sub_seed(seed: int, purpose: str) -> int:
    """An independent, reproducible seed per purpose, so adding one draw never shifts another."""
    return int.from_bytes(hashlib.sha256(f"{seed}:{purpose}".encode("utf-8")).digest()[:8], "big")


def rng(seed: int, purpose: str) -> random.Random:
    return random.Random(sub_seed(seed, purpose))


def shuffled(items: list, r: random.Random) -> list:
    """Fisher-Yates on r.random() only (Random.shuffle's internals have changed between versions)."""
    out = list(items)
    for i in range(len(out) - 1, 0, -1):
        j = int(r.random() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out


def weighted_choice(items: list, weights: list[float], r: random.Random):
    total = sum(w for w in weights if w > 0)
    if total <= 0:
        return items[int(r.random() * len(items))]
    point, running = r.random() * total, 0.0
    for item, weight in zip(items, weights):
        running += max(weight, 0.0)
        if point < running:
            return item
    return items[-1]


def latin_square(base: list[str]) -> list[list[str]]:
    """Cyclic Latin square: row r is the base order rotated by r, so every ad sits in every position once."""
    k = len(base)
    return [[base[(r + j) % k] for j in range(k)] for r in range(k)]


@dataclass
class Call:
    id: str
    role: str                  # persona | repeat | judge-brief | judge-plain | crowd
    order: list[str]           # asset IDs in the order shown; label = position
    ordering_index: int        # Latin-square row this order came from (a repeat keeps its persona's row)
    reversed_order: bool = False
    persona_id: str = ""

    def label_map(self) -> dict[str, str]:
        return {LABELS[i]: asset_id for i, asset_id in enumerate(self.order)}


def base_order(asset_ids: list[str], seed: int) -> list[str]:
    """Shuffle once, so the square's first row isn't simply the order the files were given in."""
    return shuffled(asset_ids, rng(seed, "base-order"))


def repeat_ids(personas: list, count: int, seed: int) -> list[str]:
    """Pick draws to ask again, round-robin across segments so every group is checked."""
    groups: dict[str, list[str]] = {}
    for p in personas:
        groups.setdefault(p.segment_id, []).append(p.id)
    r = rng(seed, "repeats")
    queues = [shuffled(groups[s], r) for s in sorted(groups)]
    picked: list[str] = []
    while len(picked) < min(count, len(personas)):
        for queue in queues:
            if queue and len(picked) < count:
                picked.append(queue.pop(0))
    return picked


def plan_calls(personas: list, base: list[str], repeats: int, crowd: int, seed: int) -> list[Call]:
    """Every call the run will make, in a fixed order. Draw g sees Latin-square row g % k."""
    square = latin_square(base)
    k = len(square)
    calls: list[Call] = []
    row_of: dict[str, int] = {}
    for g, p in enumerate(personas):
        row_of[p.id] = g % k
        calls.append(Call(f"persona-{p.id}", "persona", square[g % k], g % k, persona_id=p.id))
    for pid in repeat_ids(personas, repeats, seed):
        row = row_of[pid]
        calls.append(Call(f"repeat-{pid}", "repeat", list(reversed(square[row])), row, True, pid))
    for role in JUDGE_ROLES:
        calls.extend(Call(f"{role}-o{r}", role, square[r], r) for r in range(k))
    calls.extend(Call(f"crowd-c_{i + 1:03d}", "crowd", square[i % k], i % k) for i in range(crowd))
    return calls


def execution_order(calls: list[Call], seed: int) -> list[Call]:
    """A seeded shuffle of the plan, so roles, groups and orderings are interleaved when calls run."""
    return shuffled(calls, rng(seed, "execution-order"))
