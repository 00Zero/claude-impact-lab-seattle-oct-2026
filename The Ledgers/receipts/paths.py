"""Where Receipts keeps what Claude must not see: outside the project folder.

The secrets folder holds QuickBooks sign-ins (when not in the macOS Keychain) and each
project's payee list. It is RECEIPTS_SECRETS_DIR when set, else $XDG_CONFIG_HOME/receipts,
else ~/.config/receipts. Keeping these out of the project means a search of the project (which
Claude does all the time) can't reach them; the guard also refuses Claude's reads of the folder.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


def secrets_dir() -> Path:
    base = os.environ.get("RECEIPTS_SECRETS_DIR") or os.path.join(
        os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "receipts"
    )
    return Path(base).resolve()


def payees_file(project_root: Path) -> Path:
    """The payee list for the project in project_root (one list per project folder)."""
    key = hashlib.sha256(str(project_root.resolve()).encode()).hexdigest()[:16]
    return secrets_dir() / f"payees-{key}.json"
