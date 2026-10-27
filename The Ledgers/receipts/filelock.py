"""An exclusive lock on an open file, on macOS, Linux and Windows."""

from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import IO

if sys.platform == "win32":
    import msvcrt

    def _try_lock(f: IO) -> bool:
        f.seek(0)
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return False
        return True

    def _unlock(f: IO) -> None:
        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)

else:
    import fcntl

    def _try_lock(f: IO) -> bool:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        return True

    def _unlock(f: IO) -> None:
        fcntl.flock(f, fcntl.LOCK_UN)


class LockTimeout(TimeoutError):
    """The lock wasn't free within the time allowed."""


@contextmanager
def locked(path: Path, timeout: float = 15.0) -> Iterator[None]:
    """Hold an exclusive lock on `path` (created if missing) for the duration of the block.
    Raises LockTimeout if another process holds it for more than `timeout` seconds."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a+") as f:
        if os.fstat(f.fileno()).st_size == 0:
            f.write("\n")  # Windows locks a byte range; make sure there's a byte to lock
            f.flush()
        give_up = time.monotonic() + timeout
        while not _try_lock(f):
            if time.monotonic() >= give_up:
                raise LockTimeout(f"{path.name} stayed locked for {timeout:.0f}s")
            time.sleep(0.02)
        try:
            yield
        finally:
            _unlock(f)
