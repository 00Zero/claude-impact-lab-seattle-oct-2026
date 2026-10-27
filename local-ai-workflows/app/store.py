"""Local JSON store for styles, immutable versions, runs, and content-free events.

Version content (preferences, prompt, parent, explanation) is never modified after
creation. Only the approval state changes, and each change is appended to
stateHistory. Runs keep a snapshot of the exact prompt and runtime used.
"""

import json
import os
import threading
import time
import uuid
from pathlib import Path

DATA_DIR = Path(os.environ.get("COACH_DATA_DIR", Path(__file__).resolve().parent / "data"))

VERSION_STATES = ("draft", "proposed", "active", "archived", "rejected", "deferred")
RUN_PURPOSES = ("development", "simulation", "real")


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def new_id(prefix):
    return "%s_%s" % (prefix, uuid.uuid4().hex[:10])


class Store:
    def __init__(self, data_dir=DATA_DIR):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path = self.dir / "store.json"
        self.events_path = self.dir / "events.jsonl"
        self.lock = threading.RLock()
        if self.path.exists():
            self.data = json.loads(self.path.read_text())
        else:
            self.data = {"styles": [], "versions": [], "runs": [], "fixtureUse": {}, "proposals": []}
            self._save()
        self.data.setdefault("proposals", [])
        self._save()

    def _save(self):
        with self.lock:
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, indent=2))
            os.replace(tmp, self.path)

    # -------------------------------------------------- events (no raw text)
    def event(self, etype, **fields):
        allowed = {k: v for k, v in fields.items() if isinstance(v, (int, float, bool, type(None))) or
                   (isinstance(v, str) and len(v) <= 64) or (isinstance(v, list) and all(isinstance(x, str) and len(x) <= 40 for x in v))}
        rec = {"eventId": new_id("ev"), "type": etype, "ts": now(), "schema": 1}
        rec.update(allowed)
        with self.lock, open(self.events_path, "a") as f:
            f.write(json.dumps(rec) + "\n")

    # -------------------------------------------------- lookups
    def style(self, sid):
        return next((s for s in self.data["styles"] if s["id"] == sid), None)

    def version(self, vid):
        return next((v for v in self.data["versions"] if v["id"] == vid), None)

    def run(self, rid):
        return next((r for r in self.data["runs"] if r["id"] == rid), None)

    def proposal(self, pid):
        return next((p for p in self.data["proposals"] if p["id"] == pid), None)

    def add_proposal(self, **proposal):
        with self.lock:
            proposal.setdefault("id", new_id("patch"))
            proposal.setdefault("createdAt", now())
            proposal.setdefault("status", "pending")
            self.data["proposals"].append(proposal)
            self._save()
            return proposal

    def decide_proposal(self, proposal_id, decision):
        if decision not in ("declined", "deferred"):
            raise ValueError("decision must be declined or deferred")
        with self.lock:
            p = self.proposal(proposal_id)
            if not p or p.get("status") != "pending":
                raise ValueError("Patch proposal is no longer pending.")
            p["status"] = decision
            self._save()
            return p

    def _proposal_base_is_current(self, style, base_id):
        if style.get("activeVersionId"):
            return style["activeVersionId"] == base_id
        usable = [v for v in self.versions_of(style["id"]) if v.get("state") not in ("rejected", "deferred")]
        current = max(usable, key=lambda v: v["version"], default=None)
        return bool(current and current["id"] == base_id)

    def confirm_proposal(self, proposal_id, expected_base_id, preferences, prompt, explanation, change_summary):
        """Atomically revalidate, materialize one proposed version, and consume its proposal."""
        with self.lock:
            p = self.proposal(proposal_id)
            if not p or p.get("status") != "pending":
                raise ValueError("Patch proposal is no longer pending.")
            style = self.style(p.get("styleId"))
            base = self.version(p.get("baseVersionId"))
            if (not style or not base or base.get("version") != p.get("baseVersion") or
                    expected_base_id != base["id"] or not self._proposal_base_is_current(style, base["id"])):
                raise ValueError("The proposal's base version is stale; review feedback from the current version.")
            version = self.add_version(style["id"], preferences, prompt, explanation, state="proposed",
                                       parent_id=base["id"], change_summary=change_summary)
            p["status"] = "confirmed"
            p["versionId"] = version["id"]
            self._save()
            return version

    def versions_of(self, sid):
        return [v for v in self.data["versions"] if v["styleId"] == sid]

    # -------------------------------------------------- styles & versions
    def create_style(self, name, source, note_type):
        with self.lock:
            s = {"id": new_id("style"), "name": name, "source": source, "noteType": note_type,
                 "activeVersionId": None, "createdAt": now()}
            self.data["styles"].append(s)
            self._save()
            return s

    def add_version(self, style_id, preferences, prompt, explanation, state="draft", parent_id=None,
                    validation=None, prompt_edited=False, change_summary=None):
        assert state in ("draft", "proposed")
        with self.lock:
            n = len(self.versions_of(style_id)) + 1
            v = {"id": new_id("ver"), "styleId": style_id, "version": n, "parentId": parent_id,
                 "preferences": preferences, "prompt": prompt, "promptEdited": prompt_edited,
                 "explanation": explanation, "changeSummary": change_summary, "state": state, "createdAt": now(),
                 "stateHistory": [{"state": state, "at": now()}], "validation": validation or {}}
            self.data["versions"].append(v)
            self._save()
            return v

    def _set_state(self, v, state):
        v["state"] = state
        v["stateHistory"].append({"state": state, "at": now()})

    def activate(self, vid):
        """Make a version active. The previously active version is archived, not deleted."""
        with self.lock:
            v = self.version(vid)
            if v is None:
                raise KeyError(vid)
            if v["state"] == "rejected":
                raise ValueError("A rejected version cannot be activated.")
            s = self.style(v["styleId"])
            prev = self.version(s["activeVersionId"]) if s["activeVersionId"] else None
            restored = v["state"] == "archived"
            if prev and prev["id"] != vid:
                self._set_state(prev, "archived")
            if v["state"] != "active":
                self._set_state(v, "active")
            s["activeVersionId"] = vid
            self._save()
            return restored

    def decide(self, vid, decision):
        assert decision in ("rejected", "deferred")
        with self.lock:
            v = self.version(vid)
            if v["state"] not in ("proposed", "deferred", "draft"):
                raise ValueError("Only drafts or proposals can be rejected or deferred.")
            self._set_state(v, decision)
            self._save()

    def set_validation(self, vid, validation):
        """Attach check results. Validation is a reference, not version content."""
        with self.lock:
            self.version(vid)["validation"] = validation
            self._save()

    # -------------------------------------------------- runs
    def add_run(self, **run):
        assert run["purpose"] in RUN_PURPOSES
        with self.lock:
            run.setdefault("id", new_id("run"))
            run.setdefault("createdAt", now())
            run.setdefault("feedback", None)
            run.setdefault("noteEdit", None)
            self.data["runs"].append(run)
            self._save()
            return run

    def update_run(self, rid, **fields):
        with self.lock:
            r = self.run(rid)
            r.update(fields)
            self._save()
            return r

    # -------------------------------------------------- fixture provenance
    def mark_fixture_development(self, fixture_id, reason):
        with self.lock:
            self.data["fixtureUse"][fixture_id] = {"role": "development", "reason": reason, "at": now()}
            self._save()

    def fixture_is_development(self, fixture_id):
        return fixture_id in self.data["fixtureUse"]

    def counts(self):
        runs = self.data["runs"]
        return {p: sum(1 for r in runs if r["purpose"] == p) for p in RUN_PURPOSES}
