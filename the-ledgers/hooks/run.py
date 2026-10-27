"""Entry point for the plugin's hooks: python3 hooks/run.py guard|log|stop

Claude Code pipes the hook event as JSON on stdin. Standard library only, so it runs on the
system python3 (3.9 or newer). In a folder without a receipts.json every hook does nothing.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from receipts import config, guard, hook_log, stop


def _guard(event: object) -> None:
    try:
        cfg = config.load()
        result = guard.decide(event, cfg) if cfg else None
    except config.ConfigError as exc:  # the message is ours and safe to show
        result = ("deny", f"Receipts couldn't check this call: {exc}")
    except Exception as exc:  # noqa: BLE001 - when in doubt, refuse; the type only, no args
        result = ("deny", f"Receipts couldn't check this call ({type(exc).__name__})")
    if result is not None:
        decision, reason = result
        out = {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
        print(json.dumps({"hookSpecificOutput": out}))


def _log(event: object) -> None:
    try:
        cfg = config.load()
        if cfg:
            hook_log.log_event(event, cfg)
    except Exception as exc:  # noqa: BLE001 - report, don't crash Claude's turn
        print(f"Receipts log hook failed: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)  # non-blocking: Claude Code shows the error, the tool result stands


def _stop(event: object) -> None:
    try:
        cfg = config.load()
        text = stop.report(event, cfg) if cfg else None
    except Exception as exc:  # noqa: BLE001 - a Stop hook must never block the turn
        text = f"Receipts: couldn't build the receipts ({type(exc).__name__})."
    if text is not None:
        print(json.dumps({"systemMessage": text}))


HOOKS = {"guard": _guard, "log": _log, "stop": _stop}


def main() -> None:
    try:
        event = json.loads(sys.stdin.read() or "null")
    except ValueError:
        event = None
    HOOKS[sys.argv[1]](event)


if __name__ == "__main__":
    main()
