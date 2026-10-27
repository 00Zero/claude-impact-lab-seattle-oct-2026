"""Load .env into the environment for the web app and scripts."""
from __future__ import annotations

import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_env(path: Path = ENV_PATH) -> None:
    """Read KEY=value lines from .env without overriding the real environment."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        value = value.split("#", 1)[0].strip()
        if sep and key.strip() and not key.startswith("#") and value:
            os.environ.setdefault(key.strip(), value)
