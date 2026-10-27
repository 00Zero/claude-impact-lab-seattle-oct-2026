"""Payments in flight: approved by the guard, their tool call not logged yet.

A small JSON file, logs/pending.json, maps a bill id to when its payment was approved. The
guard sets an entry when it approves a payment (or puts it to the owner) and refuses a second
payment for that bill while the entry is younger than WINDOW_SECONDS (check C7). The log hook
clears the entry when the payment tool's call is logged. A refusal never touches it, so a
refused retry can't let a third call through. Callers hold the guard's lock.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

WINDOW_SECONDS = 120


def _path(root: Path) -> Path:
    return root / "logs" / "pending.json"


def lock_path(root: Path) -> Path:
    return root / "logs" / "guard.lock"


def _read(root: Path) -> dict[str, float]:
    try:
        data = json.loads(_path(root).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): float(v) for k, v in data.items() if isinstance(v, (int, float))}


def _write(root: Path, data: dict[str, float]) -> None:
    path = _path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".tmp{os.getpid()}")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    os.replace(tmp, path)


def in_flight(root: Path, bill_id: str, now: float) -> bool:
    started = _read(root).get(bill_id)
    return started is not None and now - started < WINDOW_SECONDS


def start(root: Path, bill_id: str, now: float) -> None:
    data = {b: t for b, t in _read(root).items() if now - t < WINDOW_SECONDS}
    data[bill_id] = now
    _write(root, data)


def finish(root: Path, bill_id: str) -> None:
    data = _read(root)
    if data.pop(bill_id, None) is not None:
        _write(root, data)
