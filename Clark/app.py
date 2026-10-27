"""Clark: say a change once, and Clark checks it against past decisions,
saves it, lists what to update and drafts a staff message.

Storage is a CSV file (data/decisions.csv) so the app runs with no setup.
Google Sheets is the next step (see README)."""

import csv
import json
import os
import re
import shutil
from datetime import date
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

ROOT = Path(__file__).parent
DATA = ROOT / "data"
DECISIONS = DATA / "decisions.csv"
SAMPLE = DATA / "sample-decisions.csv"
PLACES = DATA / "where-rules-live.csv"
MODEL = os.getenv("CLARK_MODEL", "claude-sonnet-5-5")

FIELDS = ["ID", "Date", "Decision", "Type", "Labels", "Status", "Context",
          "Options", "Why", "Cost", "Revisit when", "Original quote"]

_client = None


def client():
    """Create the Claude client on first use, so a missing key gives a clear message."""
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(500, "ANTHROPIC_API_KEY isn't set on the server.")
        _client = Anthropic()
    return _client


app = FastAPI(title="Clark")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


# ---------- storage ----------

def ensure_data():
    """Start from a copy of the sample café log so the sample stays clean."""
    if not DECISIONS.exists():
        shutil.copy(SAMPLE, DECISIONS)


def read_decisions():
    ensure_data()
    with DECISIONS.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_decisions(rows):
    with DECISIONS.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})


def read_places():
    with PLACES.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def next_id(rows):
    nums = [int(r["ID"][1:]) for r in rows if re.fullmatch(r"D\d+", r.get("ID", ""))]
    return f"D{(max(nums) if nums else 0) + 1:02d}"


# ---------- Claude ----------

def ask_json(system, user, max_tokens=2000):
    msg = client().messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise HTTPException(502, "Clark couldn't read the model's answer. Try again.")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        raise HTTPException(502, "Clark couldn't read the model's answer. Try again.")


CHECK_SYSTEM = """You are Clark, an assistant that keeps a small business's decisions consistent.
The owner has said or typed a note. Do two things.

1. Extract every decision in the note (there may be more than one). For each, fill:
   decision (short, plain), type ("Rule" for a standing rule staff should follow, "One-time" otherwise),
   labels (1-2 from: Strategy, Product, Finance, Social media, Marketing, Operations, People, Customers, Legal),
   context, options, why, cost, revisit_when, original_quote (the owner's exact words for this decision).
   If something was not said, write "not said". Never guess.

2. Compare each decision with the ACTIVE decisions provided. If it contradicts one, directly or
   indirectly, set "conflict". Think about real effects: for example "double punches on a punch card"
   is roughly 20% off, which breaks a 15% discount cap. A decision that goes the same direction as an
   old one (closing even earlier) is not a contradiction: put it in "related" instead.
   If a decision settles something marked "Still deciding", put that in "related".
   Only cite decisions that exist in the list. Do not invent IDs.

Reply with JSON only, in this shape:
{"decisions": [{
  "decision": "", "type": "Rule", "labels": [""], "context": "", "options": "", "why": "",
  "cost": "", "revisit_when": "", "original_quote": "",
  "conflict": null or {"id": "D01", "date": "2026-03-04", "rule": "what the old decision says",
                       "why": "the old reason", "quote": "the old original quote",
                       "explanation": "one plain sentence on why these clash"},
  "related": null or {"id": "D04", "note": "one plain sentence"}
}]}"""

APPLY_SYSTEM = """You are Clark. The owner just confirmed a decision. Write what changes and a staff update.
Only name places from the PLACES list for the checklist; never invent a place the business doesn't have.
Only include places this change actually affects. Keep everything short and plain, like a friendly manager.

Reply with JSON only:
{"what_changes": "one line", "stays_the_same": "one line, or empty if nothing",
 "checklist": [{"place": "exact place name from the list", "todo": "short action"}],
 "staff_message": "2-3 short sentences, ready to paste into a group chat"}"""


# ---------- API ----------

class Note(BaseModel):
    text: str


class Apply(BaseModel):
    decision: dict
    action: str  # "replace" | "exception" | "new"
    conflict_id: str | None = None


@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")


@app.post("/api/check")
def check(note: Note):
    if not note.text.strip():
        raise HTTPException(400, "Say or type a change first.")
    active = [r for r in read_decisions() if r["Status"] in ("Active", "Still deciding")]
    user = (
        f"Today is {date.today().isoformat()}.\n\nACTIVE DECISIONS (JSON):\n"
        f"{json.dumps(active, ensure_ascii=False)}\n\nOWNER'S NOTE:\n{note.text.strip()}"
    )
    return ask_json(CHECK_SYSTEM, user)


@app.post("/api/apply")
def apply(body: Apply):
    rows = read_decisions()
    d = body.decision
    replaced = None
    if body.action == "replace" and body.conflict_id:
        for r in rows:
            if r["ID"] == body.conflict_id:
                r["Status"] = "Replaced"
                replaced = r
    new_row = {
        "ID": next_id(rows),
        "Date": date.today().isoformat(),
        "Decision": d.get("decision", ""),
        "Type": "One-time" if body.action == "exception" else d.get("type", "Rule"),
        "Labels": ", ".join(d.get("labels") or []),
        "Status": "Active",
        "Context": d.get("context", "not said"),
        "Options": d.get("options", "not said"),
        "Why": d.get("why", "not said"),
        "Cost": d.get("cost", "not said"),
        "Revisit when": d.get("revisit_when", "not said"),
        "Original quote": d.get("original_quote", ""),
    }
    if body.action == "exception" and body.conflict_id:
        new_row["Context"] = f"One-time exception to {body.conflict_id}. " + new_row["Context"]
    rows.append(new_row)
    write_decisions(rows)

    user = json.dumps({
        "new_decision": new_row,
        "owner_chose": body.action,
        "replaced_decision": replaced,
        "exception_to": body.conflict_id if body.action == "exception" else None,
        "PLACES": read_places(),
    }, ensure_ascii=False)
    result = ask_json(APPLY_SYSTEM, user, max_tokens=1000)
    result["saved_id"] = new_row["ID"]
    return result


@app.get("/api/rules")
def rules():
    rows = read_decisions()
    active = [r for r in rows if r["Status"] == "Active" and r["Type"] == "Rule"]
    exceptions = [r for r in rows if r["Status"] == "Active" and r["Type"] == "One-time"
                  and r["Context"].startswith("One-time exception to ")]
    groups = {}
    for r in active:
        label = (r["Labels"].split(",")[0].strip() or "Other")
        groups.setdefault(label, []).append({
            "id": r["ID"], "rule": r["Decision"], "since": r["Date"],
            "why": r["Why"], "quote": r["Original quote"],
            "exceptions": [e["Decision"] for e in exceptions
                           if e["Context"].startswith(f"One-time exception to {r['ID']}")],
        })
    return groups


@app.get("/api/recent")
def recent():
    rows = read_decisions()
    return [{"decision": r["Decision"], "date": r["Date"]} for r in rows[-3:]][::-1]


@app.post("/api/reset")
def reset():
    """Restore the sample café log (handy before a demo)."""
    shutil.copy(SAMPLE, DECISIONS)
    return {"ok": True}
