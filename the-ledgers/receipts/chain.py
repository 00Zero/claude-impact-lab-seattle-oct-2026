"""Tamper-evident log: one JSON object per line, each holding the previous line's hash.

Editing or deleting any line breaks the chain. Cutting lines off the end leaves a valid
shorter chain, so every append also records the latest hash and count in a small head file
next to the log; verify() compares against it. (Someone who can rewrite both files can
still forge a shorter log. A real deployment would also send the head somewhere off the
machine.)
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from receipts.filelock import locked

GENESIS = "0" * 64


def _canonical(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _hash(entry: dict, prev: str) -> str:
    body = {k: v for k, v in entry.items() if k not in ("prev", "hash")}
    return hashlib.sha256((prev + _canonical(body)).encode()).hexdigest()


def _head_path(path: Path) -> Path:
    return path.with_suffix(".head")


def _last_line(f: BinaryIO, size: int) -> bytes:
    """The file's last line, read from the end so appends don't reread the whole log."""
    chunk, data = 4096, b""
    while True:
        start = max(0, size - chunk)
        f.seek(start)
        data = f.read(size - start)
        body = data.rstrip(b"\n")
        if b"\n" in body or start == 0:
            return body.rsplit(b"\n", 1)[-1]
        chunk *= 4


def _prev_of(line: bytes) -> str:
    """The hash the next entry links to. A damaged last line (half written, edited) has no
    usable hash; the next entry links to the line's own SHA-256 instead, so logging goes on
    and verify() still reports the damage at that line."""
    try:
        value = json.loads(line)["hash"]
        if isinstance(value, str):
            return value
    except (ValueError, KeyError, TypeError):
        pass
    return hashlib.sha256(line).hexdigest()


def _count(f: BinaryIO, path: Path, size: int, prev: str) -> int:
    """How many lines the log has: from the head file when it agrees, else by counting."""
    try:
        found = _read_head(path)
        if found and found[1] == prev:
            return found[0]
    except (OSError, ValueError):
        pass
    f.seek(0)
    return sum(1 for line in f.read(size).splitlines() if line.strip())


def _write_head(path: Path, count: int, last: str) -> None:
    """Replace the head file in one rename, so a reader never sees it half written."""
    head = _head_path(path)
    tmp = head.with_suffix(f".tmp{os.getpid()}")
    tmp.write_text(f"{count} {last}\n")
    os.replace(tmp, head)


def _read_head(path: Path) -> tuple[int, str] | None:
    """(count, last hash) from the head file; None if there's none. Raises ValueError if it's
    damaged."""
    head = _head_path(path)
    if not head.exists():
        return None
    parts = head.read_text().split()
    if len(parts) != 2 or not parts[0].isdigit() or len(parts[1]) != 64:
        raise ValueError("damaged head file")
    return int(parts[0]), parts[1]


def append(entry: dict, path: Path) -> dict:
    """Append entry to the log and return it with prev and hash filled in."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Parallel tool calls must not share a prev hash.
    with locked(path.with_suffix(".lock")), open(path, "a+b") as f:
        size = f.seek(0, 2)
        if size == 0:
            prev, count = GENESIS, 0
        else:
            prev = _prev_of(_last_line(f, size))
            count = _count(f, path, size, prev)
            f.seek(size - 1)
            if f.read(1) != b"\n":
                f.write(b"\n")  # a half-written line must not swallow this entry
        record = {**entry, "prev": prev, "hash": _hash(entry, prev)}
        f.write((_canonical(record) + "\n").encode("utf-8"))
        f.flush()
        _write_head(path, count + 1, record["hash"])
    return record


@dataclass
class ChainStatus:
    ok: bool
    entries: int
    head: str
    error: str | None = None
    line: int | None = None  # 1-based line where the chain breaks, matching "log:N" evidence


def verify(path: Path) -> ChainStatus:
    """Whether the log is intact. Holds the log's lock, so an append in progress can't make an
    intact log look cut short. Never raises on a damaged log: it reports where it breaks."""
    with locked(path.with_suffix(".lock")):
        return _verify(path)


def _verify(path: Path) -> ChainStatus:
    try:
        head = _read_head(path)
    except (OSError, ValueError):
        return ChainStatus(False, 0, GENESIS, "the head file is damaged")
    if not path.exists():
        if head and head[0] > 0:
            return ChainStatus(False, 0, GENESIS, f"the log was deleted (it had {head[0]} entries)")
        return ChainStatus(True, 0, GENESIS)
    prev, count = GENESIS, 0
    for n, raw in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        try:
            record = json.loads(raw)
        except ValueError:
            return ChainStatus(False, n - 1, prev, "line is not valid JSON", n)
        if not isinstance(record, dict):
            return ChainStatus(False, n - 1, prev, "line is not a log entry", n)
        if record.get("prev") != prev:
            return ChainStatus(False, n - 1, prev, "a line before this one was removed", n)
        if record.get("hash") != _hash(record, prev):
            return ChainStatus(False, n - 1, prev, "this line was edited", n)
        prev, count = record["hash"], n
    if head and (head[0] != count or head[1] != prev):
        return ChainStatus(False, count, prev, "lines were cut from the end of the log")
    return ChainStatus(True, count, prev)
