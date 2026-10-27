"""Deterministic Send Check signals for one draft, as JSON.

Usage: pass a JSON object with --json (or on stdin), get JSON on stdout.

    python3 check.py --json '{"text": "...", "message_type": "cold"}'

Write apostrophes as ’ (typographic) so the single-quoted argument stays intact;
real line breaks inside the JSON are fine.

    {"text": "...", "subject": "...", "message_type": "cold",
     "recipient_name": "Dana Lee", "recipient_company": "Northside Remodeling",
     "recipient_context": "bio, CRM notes, site copy",
     "owner_samples": ["an email the owner actually sent", "..."]}

message_type is one of cold, follow_up, warm, post_meeting, customer (default cold).
Pass "audience": "segment" for a template going to a list (merge fields allowed).
The output's disqualifying list holds tells that cap the draft at 30 (scrap).
owner_samples is optional; with it, the output includes a voice match.
Standard library only. Runs from the plugin root layout:
skills/send-check/scripts/check.py -> scorers/naive/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))


def main() -> None:
    try:
        from scorers.naive import mechanical, slop, voice
    except ImportError as e:
        print(json.dumps({"error": f"scorers not found next to the skill: {e}"}))
        return

    try:
        # --json '<object>' is the preferred form: an argument matches the
        # plugin's permission rule, input piped on stdin does not.
        if len(sys.argv) >= 3 and sys.argv[1] == "--json":
            req = json.loads(sys.argv[2], strict=False)   # allow real line breaks
        else:
            req = json.load(sys.stdin)
        text = req["text"]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(json.dumps({"error": f"expected JSON with a 'text' field: {e}"}))
        return

    mech = mechanical.check(
        text,
        message_type=req.get("message_type", "cold"),
        recipient_context=req.get("recipient_context", ""),
        recipient_name=req.get("recipient_name", ""),
        recipient_company=req.get("recipient_company", ""),
    )
    try:
        sl = slop.check(text)
    except OSError as e:
        sl = {"score": None, "matches": [], "generic_opener": False,
              "error": f"phrase list unavailable: {e}"}

    caps = [f["detail"] for f in mech["findings"] if f["cap"]]
    if sl["generic_opener"]:
        opener = next(m["phrase"] for m in sl["matches"] if m["in_opener"] and m["words"] >= 3)
        caps.append(f'opens with a generic phrase: "{opener}"')

    disqualifying, reminders = mechanical.disqualifiers(
        text, req.get("subject", ""), req.get("message_type", "cold"),
        merge_fields_ok=req.get("audience") == "segment" or req.get("message_type") == "customer")

    out = {"mechanical": mech, "slop": sl, "caps": caps,
           "disqualifying": disqualifying, "reminders": reminders}
    samples = req.get("owner_samples") or []
    if samples:
        out["voice"] = voice.compare(text, samples)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
