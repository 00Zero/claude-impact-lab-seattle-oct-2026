"""Append a tool call Claude made to the hash-chain log, masked.

Claude Code calls it as a PostToolUse hook (hooks/log.py) with the event as JSON (session_id,
tool_name, tool_input, tool_response). It logs only in a Receipts project: a folder with a
receipts.json.
"""

from __future__ import annotations

import time

from receipts import chain, config, pending, pii
from receipts.filelock import locked


def entry_from_event(event: dict, cfg: config.Config) -> dict:
    tool = str(event.get("tool_name", ""))
    return {
        "ts": round(time.time(), 3),
        "session": str(event.get("session_id", "")),
        "tool": tool,
        "input": cfg.masked_input(tool, event.get("tool_input", {})),
        "response": pii.mask(event.get("tool_response", {})),
    }


def log_event(event: object, cfg: config.Config) -> None:
    if not isinstance(event, dict):
        return
    chain.append(entry_from_event(event, cfg), cfg.log_path)
    tool = str(event.get("tool_name", ""))
    bill_id = (cfg.payment_args(tool, event.get("tool_input")) or {}).get("bill_id")
    if isinstance(bill_id, str):
        # The payment's tool call has run: it's no longer in flight.
        with locked(pending.lock_path(cfg.root)):
            pending.finish(cfg.root, bill_id)
