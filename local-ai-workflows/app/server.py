"""Local web server for the note-style coach demo.

Run:  python3 app/server.py   then open http://127.0.0.1:8765
HTTP binds to loopback. Ollama defaults to loopback; explicit private-host routing sends content to that host.
"""

import json
import hashlib
import mimetypes
import os
import re
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import coach  # noqa: E402
import ollama  # noqa: E402
from store import Store, new_id  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("COACH_PORT", "8765"))
STATIC = Path(__file__).resolve().parent / "static"
MAX_REFINEMENT_ROUNDS = 2

store = Store()
jobs = {}
jobs_lock = threading.Lock()


# ---------------------------------------------------------------- jobs

class Job:
    def __init__(self, kind):
        self.id = new_id("job")
        self.kind = kind
        self.status = "queued"
        self.phase = "Queued"
        self.iteration = 0
        self.max_iterations = 0
        self.log = []
        self.result = None
        self.error = None
        self.started = time.time()
        self.finished = None
        self.cancel = threading.Event()

    def set_phase(self, phase):
        self.phase = phase
        self.log.append({"t": round(time.time() - self.started, 1), "phase": phase})

    def to_json(self):
        end = self.finished or time.time()
        return {"id": self.id, "kind": self.kind, "status": self.status, "phase": self.phase,
                "iteration": self.iteration, "maxIterations": self.max_iterations, "log": self.log,
                "elapsed": round(end - self.started, 1), "result": self.result, "error": self.error}


def start_job(kind, fn, *args):
    job = Job(kind)
    with jobs_lock:
        jobs[job.id] = job

    def runner():
        job.status = "running"
        try:
            job.result = fn(job, *args)
            job.status = "completed"
        except ollama.Cancelled:
            job.status = "cancelled"
            job.set_phase("Cancelled. Nothing was saved or changed.")
        except (ollama.GenerationError, ValueError) as e:
            job.status = "failed"
            job.error = str(e)
            job.set_phase("Failed")
        except Exception as e:  # keep content out of logs: print only the type and location
            job.status = "failed"
            job.error = "Unexpected error (%s). Your inputs were kept; try again." % e.__class__.__name__
            tb = traceback.extract_tb(e.__traceback__)[-1]
            print("job %s failed: %s at %s:%s" % (job.id, e.__class__.__name__, Path(tb.filename).name, tb.lineno), file=sys.stderr)
            job.set_phase("Failed")
        job.finished = time.time()

    threading.Thread(target=runner, daemon=True).start()
    return job


def generate_run(job, version_like, fixture_id, purpose, role, version_id=None, correction=None, parent_run_id=None):
    """One real local generation + code checks, recorded as an immutable run."""
    meta = coach.load_fixture_manifest()["fixtures"][fixture_id]
    transcript = coach.load_transcript(fixture_id)
    prompt = version_like["prompt"]
    effective_prompt = prompt if not correction else prompt + "\n\nNOTE-ONLY CORRECTION (applies only to this retry; does not change style): " + correction
    runtime = ollama.runtime_info()
    if not runtime["available"]:
        raise ollama.GenerationError(runtime.get("error", "Local model unavailable."))
    t0 = time.time()
    base = dict(purpose=purpose, fixtureRole=role, fixtureId=fixture_id, fixtureVersion=meta["version"],
                versionId=version_id, promptSnapshot=effective_prompt, runtime=runtime, jobId=job.id,
                promptHash=hashlib.sha256(effective_prompt.encode()).hexdigest(), sourceHash=hashlib.sha256(transcript.encode()).hexdigest(),
                parentRunId=parent_run_id, retryCorrection=correction,
                evidenceStatus="reused" if parent_run_id else None)
    try:
        output, stats = ollama.chat(effective_prompt, coach.user_message(transcript), job.cancel)
    except ollama.Cancelled:
        store.add_run(status="cancelled", durationMs=int((time.time() - t0) * 1000), **base)
        raise
    except ollama.GenerationError:
        store.add_run(status="failed", durationMs=int((time.time() - t0) * 1000), **base)
        raise
    checks = coach.check_note(output, version_like["preferences"], meta, transcript)
    return store.add_run(status="completed", output=output, checks=checks, stats=stats,
                         durationMs=int((time.time() - t0) * 1000), **base)


def untouched_fixture(note_type, exclude=()):
    nt = next(n for n in coach.load_fixture_manifest()["noteTypes"] if n["id"] == note_type)
    for role in ("simulation", "fresh"):
        fid = nt["fixtures"][role]
        if fid not in exclude and not store.fixture_is_development(fid):
            return fid, role
    return None, None


def prepare_job(job, prefs, note_type, name):
    nt = next(n for n in coach.load_fixture_manifest()["noteTypes"] if n["id"] == note_type)
    fixture_a = nt["fixtures"]["development"]
    job.max_iterations = 1 + MAX_REFINEMENT_ROUNDS
    store.event("refinement_started", attemptId=job.id, noteType=note_type, fixtureId=fixture_a)
    job.set_phase("Selected fictional development transcript (%s)" % fixture_a)

    candidate = {"preferences": prefs, "prompt": coach.compile_prompt(prefs)}
    job.set_phase("Compiled first template from your confirmed preferences")
    attempts = []
    for i in range(job.max_iterations):
        if job.cancel.is_set():
            raise ollama.Cancelled()
        job.iteration = i + 1
        job.set_phase("Writing a practice note locally (attempt %d of up to %d)" % (i + 1, job.max_iterations))
        run = generate_run(job, candidate, fixture_a, "development", "development")
        failures = coach.failed_ids(run["checks"])
        attempts.append((len(failures), i, candidate, run))
        store.event("refinement_iteration_completed", attemptId=job.id, runId=run["id"], iteration=i + 1,
                    failedChecks=failures, durationMs=run["durationMs"])
        job.set_phase("Checked the note: %d of %d checks passed" % (
            sum(c["status"] != "fail" for c in run["checks"]), len(run["checks"])))
        if not failures or i == job.max_iterations - 1:
            break
        revised, added = coach.revise_for_failures(candidate["preferences"], run["checks"])
        if not added:
            job.set_phase("No further targeted revision available for the remaining issues")
            break
        candidate = {"preferences": revised, "prompt": coach.compile_prompt(revised)}
        job.set_phase("Revised template for: " + ", ".join(coach.CHECK_LABELS[a].lower() for a in added))

    _, _, best, best_run = min(attempts, key=lambda a: (a[0], a[1]))
    store.mark_fixture_development(fixture_a, "refinement")
    style = store.create_style(name, "generated", note_type)
    added_total = best["preferences"]["emphasis"]
    expl = "Created from your example and confirmed preferences. Practiced on fictional transcript %s, %d attempt(s)." % (fixture_a, len(attempts))
    if added_total:
        expl += " Added emphasis: " + ", ".join(coach.CHECK_LABELS.get(k, k).lower() for k in added_total) + "."
    v = store.add_version(style["id"], best["preferences"], best["prompt"], expl, state="draft",
                          validation={"runId": best_run["id"], "fixtureId": fixture_a, "kind": "development",
                                      "checks": best_run["checks"], "attempts": len(attempts)})
    store.event("refinement_finished", attemptId=job.id, outcome="success", iterations=len(attempts),
                failedChecks=coach.failed_ids(best_run["checks"]))
    job.set_phase("Draft template ready for your review")
    return {"styleId": style["id"], "versionId": v["id"], "runId": best_run["id"]}


def simulate_job(job, version_id, library_id=None):
    v = store.version(version_id)
    style = store.style(v["styleId"])
    warning = None
    if library_id:
        fid, role = library_id, "library"
        warning = "Library session: a fictional sample transcript from the team. It is useful for trying the style on different modalities, but it is not a held-out check."
    else:
        fid, role = untouched_fixture(style["noteType"])
    if fid is None:
        nt = next(n for n in coach.load_fixture_manifest()["noteTypes"] if n["id"] == style["noteType"])
        fid, role = nt["fixtures"]["simulation"], "simulation"
        warning = "Every fictional transcript for this note type has already informed the template, so this is not a fresh generalization check."
    job.max_iterations = 1
    job.iteration = 1
    store.event("simulation_started", runAlias=job.id, versionId=version_id, fixtureId=fid)
    label = coach.load_fixture_manifest()["fixtures"][fid].get("label")
    job.set_phase("Loaded fictional session transcript (%s)" % (label or fid))
    job.set_phase("Writing the session note locally with %s v%d" % (style["name"], v["version"]))
    run = generate_run(job, v, fid, "simulation", role, version_id)
    store.event("simulation_finished", runId=run["id"], outcome="success", durationMs=run["durationMs"])
    job.set_phase("Note ready")
    return {"runId": run["id"], "warning": warning}


def interpret_feedback_job(job, run_id, feedback):
    run = store.run(run_id)
    if not run or run.get("status") != "completed":
        raise ValueError("Original completed note is no longer available.")
    version = store.version(run["versionId"])
    job.set_phase("Interpreting feedback locally into a bounded preference patch")
    try:
        result = coach.interpret_feedback(version["preferences"], feedback["text"], feedback["tags"],
            feedback["addSection"], lambda system, user: ollama.interpret_feedback(system, user, job.cancel))
    except ollama.Cancelled:
        raise
    except Exception:
        # Keep malformed local responses and interpreter failures on the normal
        # no-change path; never let them create a proposal or escape as a broken UI request.
        result = {"kind": "no_change", "explanation": "Local feedback interpretation failed. No style change was saved."}
    if job.cancel.is_set():
        raise ollama.Cancelled()
    store.update_run(run_id, feedback=feedback["record"])
    store.event("feedback_submitted", runId=run_id, scope="future", tags=feedback["tags"], accepted=False,
                hasComment=bool(feedback["text"]))
    if result["kind"] != "patch":
        return {"interpretation": result}
    proposal = store.add_proposal(runId=run_id, styleId=version["styleId"], baseVersionId=version["id"],
        baseVersion=version["version"], patch=result["patch"], preferences=result["preferences"],
        explanation=result.get("explanation", ""), status="pending")
    return {"patchProposal": proposal}


def retry_note_job(job, run_id, correction):
    original = store.run(run_id)
    if not original or original.get("status") != "completed":
        raise ValueError("Original completed note is no longer available.")
    version = store.version(original["versionId"])
    job.set_phase("Regenerating from the same fictional source with a note-only correction")
    run = generate_run(job, version, original["fixtureId"], original["purpose"], "retry_reused",
                       original["versionId"], correction=correction, parent_run_id=run_id)
    return {"runId": run["id"], "parentRunId": run_id}


def proposal_check_job(job, proposal_id, fixture_id):
    prop = store.version(proposal_id)
    style = store.style(prop["styleId"])
    current_id = style["activeVersionId"] or prop["parentId"]
    current = store.version(current_id)
    store.mark_fixture_development(fixture_id, "confirmed style proposal preview")
    job.max_iterations = 2
    job.iteration = 1
    job.set_phase("Writing a note with the current template on fresh fictional transcript %s" % fixture_id)
    before = generate_run(job, current, fixture_id, "simulation", "fresh_check", current_id)
    job.iteration = 2
    job.set_phase("Writing a note with the proposed update on the same transcript")
    after = generate_run(job, prop, fixture_id, "simulation", "fresh_check", proposal_id)
    store.set_validation(proposal_id, {"kind": "fresh_check", "fixtureId": fixture_id, "runId": after["id"],
                                       "compareRunId": before["id"], "compareVersionId": current_id, "checks": after["checks"]})
    job.set_phase("Preview ready. Waiting for your decision")
    return {"proposalId": proposal_id, "runId": after["id"], "compareRunId": before["id"]}


# ---------------------------------------------------------------- views

def run_summary(r):
    keys = ("id", "purpose", "fixtureRole", "evidenceStatus", "fixtureId", "versionId", "status", "createdAt", "durationMs", "checks", "feedback", "parentRunId", "retryCorrection", "sourceHash", "promptHash")
    return {k: r.get(k) for k in keys}


def state_view():
    d = store.data
    styles = []
    for s in d["styles"]:
        vs = sorted(store.versions_of(s["id"]), key=lambda v: v["version"])
        styles.append(dict(s, versions=vs))
    manifest = coach.load_fixture_manifest()
    return {
        "styles": styles,
        "runs": [run_summary(r) for r in d["runs"]][-60:],
        "counts": store.counts(),
        "defaults": coach.DEFAULT_STYLES,
        "noteTypes": manifest["noteTypes"],
        "fixtureUse": d["fixtureUse"],
        "patchProposals": d.get("proposals", []),
        "feedbackTags": coach.FEEDBACK_TAGS,
        "checkLabels": coach.CHECK_LABELS,
        "groundingBlock": coach.GROUNDING_BLOCK,
        "samples": coach.load_samples(),
        "library": [{"id": f, "label": manifest["fixtures"][f]["label"]} for f in manifest["library"]["sessions"]],
        "runtime": ollama.runtime_info(),
    }


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "NoteStyleCoach/0.1"

    def log_message(self, fmt, *args):  # request lines only; never bodies
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def err(self, msg, code=400):
        self.send_json({"error": msg}, code)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/state":
            return self.send_json(state_view())
        m = re.match(r"^/api/jobs/([\w-]+)$", path)
        if m:
            job = jobs.get(m.group(1))
            return self.send_json(job.to_json()) if job else self.err("No such job", 404)
        m = re.match(r"^/api/runs/([\w-]+)$", path)
        if m:
            r = store.run(m.group(1))
            if not r:
                return self.err("No such run", 404)
            return self.send_json(dict(r, transcript=coach.load_transcript(r["fixtureId"])))
        m = re.match(r"^/api/fixtures/([\w-]+)$", path)
        if m:
            try:
                return self.send_json({"id": m.group(1), "text": coach.load_transcript(m.group(1))})
            except KeyError:
                return self.err("No such fixture", 404)
        f = (STATIC / ("index.html" if path == "/" else path.lstrip("/").replace("static/", "", 1))).resolve()
        if STATIC in f.parents and f.is_file():
            data = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(str(f))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        self.err("Not found", 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            b = self.body()
        except ValueError:
            return self.err("Invalid JSON")

        if path == "/api/extract":
            text = (b.get("text") or "").strip()
            if not text:
                return self.err("Paste or upload an example note first.")
            store.event("intake_started", chars=len(text) // 500 * 500)
            return self.send_json(coach.extract_preferences(text, b.get("name") or "My note style"))

        if path == "/api/prepare":
            prefs, note_type = b.get("preferences"), b.get("noteType")
            errors = coach.validate_preferences(prefs or {})
            if errors:
                return self.err(" ".join(errors))
            store.event("intake_confirmed", noteType=note_type)
            job = start_job("prepare", prepare_job, prefs, note_type, prefs.get("name") or "My note style")
            return self.send_json({"jobId": job.id})

        m = re.match(r"^/api/defaults/([\w-]+)/use$", path)
        if m:
            d = next((x for x in coach.DEFAULT_STYLES if x["id"] == m.group(1)), None)
            if not d:
                return self.err("No such default", 404)
            style = store.create_style(d["label"], "default", b.get("noteType") or "narrative")
            v = store.add_version(style["id"], d["preferences"], coach.compile_prompt(d["preferences"]),
                                  "Started from built-in default '%s'." % d["label"])
            store.event("default_selected", defaultId=d["id"])
            return self.send_json({"styleId": style["id"], "versionId": v["id"]})

        if path == "/api/versions":
            parent = store.version(b.get("parentId") or "")
            if not parent:
                return self.err("Unknown parent version")
            prefs = b.get("preferences") or parent["preferences"]
            errors = coach.validate_preferences(prefs)
            if errors:
                return self.err(" ".join(errors))
            compiled = coach.compile_prompt(prefs)
            prompt = b.get("prompt") or compiled
            edited = prompt.strip() != compiled.strip()
            if edited and not coach.prompt_keeps_grounding(prompt):
                return self.err("The fixed grounding rules must stay in the prompt unchanged. Edit the other parts instead.")
            if prompt.strip() == parent["prompt"].strip():
                return self.err("Nothing changed compared with v%d, so no new version was saved." % parent["version"])
            v = store.add_version(parent["styleId"], prefs, prompt,
                                  (b.get("explanation") or "Edited in Template Control.").strip()[:300],
                                  parent_id=parent["id"], prompt_edited=edited,
                                  change_summary={"changes": [], "notes": [],
                                                  "promptDiff": coach.prompt_diff(parent["prompt"], prompt)})
            store.event("template_saved", versionId=v["id"], promptEdited=edited)
            return self.send_json({"versionId": v["id"]})

        m = re.match(r"^/api/versions/([\w-]+)/activate$", path)
        if m:
            try:
                restored = store.activate(m.group(1))
            except (KeyError, ValueError) as e:
                return self.err(str(e))
            store.event("style_restored" if restored else "template_activated", versionId=m.group(1))
            return self.send_json({"ok": True, "restored": restored})

        m = re.match(r"^/api/versions/([\w-]+)/decide$", path)
        if m:
            decision = b.get("decision")
            if decision not in ("rejected", "deferred"):
                return self.err("decision must be 'rejected' or 'deferred'")
            try:
                store.decide(m.group(1), decision)
            except ValueError as e:
                return self.err(str(e))
            store.event("style_update_decided", versionId=m.group(1), outcome=decision)
            return self.send_json({"ok": True})

        if path == "/api/simulate":
            v = store.version(b.get("versionId") or "")
            if not v:
                return self.err("Choose a template version first.")
            if v["state"] == "rejected":
                return self.err("This version was rejected.")
            lib = b.get("libraryId")
            manifest = coach.load_fixture_manifest()
            if lib and lib not in manifest["library"]["sessions"]:
                return self.err("Unknown library session.")
            job = start_job("simulate", simulate_job, v["id"], lib or None)
            return self.send_json({"jobId": job.id})

        m = re.match(r"^/api/runs/([\w-]+)/feedback$", path)
        if m:
            return self.feedback(m.group(1), b)

        m = re.match(r"^/api/runs/([\w-]+)/retry$", path)
        if m:
            r = store.run(m.group(1))
            correction = b.get("correction")
            if not isinstance(correction, str): return self.err("A note-only correction is required.")
            correction = correction.strip()
            if not r or r.get("status") != "completed": return self.err("Choose a completed note to retry.")
            if not correction or len(correction) > 500: return self.err("A note-only correction of 1–500 characters is required.")
            if r.get("purpose") != "simulation": return self.err("Only a simulated note can be retried here.")
            store.mark_fixture_development(r["fixtureId"], "note-only retry requested")
            job = start_job("note_retry", retry_note_job, r["id"], correction)
            return self.send_json({"jobId": job.id, "parentRunId": r["id"]})

        m = re.match(r"^/api/patch-proposals/([\w-]+)/confirm$", path)
        if m:
            return self.confirm_patch(m.group(1), b)
        m = re.match(r"^/api/patch-proposals/([\w-]+)/decide$", path)
        if m:
            try:
                p = store.decide_proposal(m.group(1), b.get("decision"))
            except ValueError as e:
                return self.err(str(e))
            return self.send_json({"ok": True, "status": p["status"]})

        m = re.match(r"^/api/jobs/([\w-]+)/cancel$", path)
        if m:
            job = jobs.get(m.group(1))
            if not job:
                return self.err("No such job", 404)
            job.cancel.set()
            return self.send_json({"ok": True})

        self.err("Not found", 404)

    def feedback(self, run_id, b):
        r = store.run(run_id)
        if not r or r["status"] != "completed": return self.err("No completed run to give feedback on.")
        scope = b.get("scope") or "note_only"
        if scope not in ("future", "note_only"): return self.err("scope must be future or note_only")
        raw_tags = b.get("tags") if isinstance(b.get("tags"), list) else []
        tags = [t for t in raw_tags if isinstance(t, str) and t in coach.FEEDBACK_TAGS]
        raw_text = b.get("text") if isinstance(b.get("text"), str) else ""
        text = raw_text.strip()[:500]
        add_section = b.get("addSection") if isinstance(b.get("addSection"), dict) else None
        fb = {"accepted": bool(b.get("accepted")), "scope": scope, "tags": tags, "comment": text or None,
              "addedSection": (add_section or {}).get("name") or None, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}
        if b.get("editedNote") is not None:
            store.update_run(run_id, feedback=fb, noteEdit={"text": b["editedNote"], "at": fb["at"], "appliesTo": "this note only"})
        if scope != "future":
            store.update_run(run_id, feedback=fb)
            return self.send_json({"ok": True, "scope": "note_only"})
        # Choosing future scope explicitly exposes this fixture before sending its feedback to inference.
        store.mark_fixture_development(r["fixtureId"], "future-style feedback submitted")
        job = start_job("feedback_interpretation", interpret_feedback_job, run_id,
            {"text": text, "tags": tags, "addSection": add_section, "record": fb})
        return self.send_json({"jobId": job.id, "scope": "future"})

    def confirm_patch(self, proposal_id, b):
        # Validation, freshness comparison, proposal consumption, and version creation
        # are serialized by the store RLock. The store method repeats all checks.
        with store.lock:
            p = store.proposal(proposal_id)
            base = store.version(p.get("baseVersionId")) if p else None
            if not p or not base:
                return self.err("Patch proposal is no longer available.")
            try:
                prefs, changes = coach.apply_typed_patch(base["preferences"], p["patch"])
                prompt = coach.compile_prompt(prefs)
                version = store.confirm_proposal(proposal_id, b.get("baseVersionId"), prefs, prompt,
                    "Confirmed preference patch: " + (p.get("explanation") or "Clinician-confirmed feedback."),
                    {"changes": changes, "notes": [p.get("explanation", "")],
                     "promptDiff": coach.prompt_diff(base["prompt"], prompt)})
            except (TypeError, ValueError) as e:
                return self.err("This proposal could not be confirmed: " + str(e))
            style = store.style(version["styleId"])
            original = store.run(p.get("runId"))
            fixture, _ = untouched_fixture(style["noteType"], exclude=((original or {}).get("fixtureId"),))
        if fixture is None:
            return self.send_json({"proposalId": version["id"], "jobId": None, "warning": "No untouched fictional transcript is left for preview."})
        job = start_job("proposal_check", proposal_check_job, version["id"], fixture)
        return self.send_json({"proposalId": version["id"], "jobId": job.id})



STARTERS = (("narrative-three-part", "Narrative notes"), ("soap-structured", "SOAP note"), ("dap-concise", "DAP note"))


def seed_starters():
    """Preload three active note templates from the fictional sample notes (first launch only)."""
    if store.data["styles"] or os.environ.get("COACH_STARTERS", "1") == "0":
        return
    samples = {x["id"]: x["text"] for x in coach.load_samples()}
    for sample_id, name in STARTERS:
        prefs = coach.extract_preferences(samples[sample_id], name)["preferences"]
        style = store.create_style(name, "starter", "narrative")
        v = store.add_version(style["id"], prefs, coach.compile_prompt(prefs), "Built-in starter template.")
        store.activate(v["id"])


def main():
    seed_starters()
    info = ollama.runtime_info()
    print("Note-Style Coach on http://%s:%d  (data: %s)" % (HOST, PORT, store.dir))
    print("Model: %s  available=%s  %s" % (info["model"], info["available"], info.get("error", "")))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
