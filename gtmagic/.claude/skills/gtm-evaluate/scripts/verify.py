"""verify: re-check a finished run folder without trusting anything that was derived inside it.

1. outputs.sha256 lists exactly the five output files, each hash matches, and its last line is the digest
   of the lines above (and equals --digest, when the published digest is given).
2. The call plan and execution order are rebuilt from the seed, the ads and personas.jsonl, and must match
   run.json's design; responses.jsonl must hold exactly one record per planned call, and every field the
   plan decides (role, persona, group, ordering, label map, prompt version) must match the plan.
3. Every record's status, draft and result are re-derived from its raw reply text by the same pure code
   the run used (runner.outcome), and results.json must equal what those re-derived records give.
"""
from __future__ import annotations

import hashlib
import json
import os
from types import SimpleNamespace

import design
import outputs
from inputs import InputError, guard
from runner import outcome, record_for
from score import build_results

NO_REPLY_REASONS = {"timeout", "api-error", "budget", "aborted", "client-error"}  # skips with no reply text


def check_hashes(folder: str, digest: str | None) -> list[str]:
    path = guard(os.path.join(folder, outputs.HASH_FILE), "the hash file")
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines(keepends=True)
    entries, footer = lines[:-1], (lines[-1].strip() if lines else "")
    names = [line.split("  ", 1)[1].rstrip("\n") if "  " in line else "" for line in entries]
    if names != list(outputs.OUTPUT_FILES):
        return [f"{outputs.HASH_FILE} must list exactly {', '.join(outputs.OUTPUT_FILES)}"]
    problems = []
    for line, name in zip(entries, names):
        with open(guard(os.path.join(folder, name), name), "rb") as f:
            if hashlib.sha256(f.read()).hexdigest() != line.split("  ", 1)[0]:
                problems.append(f"{name} changed after the run")
    recorded = footer.rsplit(" ", 1)[-1]
    if hashlib.sha256("".join(entries).encode("utf-8")).hexdigest() != recorded:
        problems.append(f"the digest line in {outputs.HASH_FILE} doesn't match its lines")
    if digest and digest.strip().lower() != recorded:
        problems.append(f"the run's digest is {recorded}, not the published {digest}")
    return problems


def planned_calls(run: dict, people: list[dict]) -> tuple[dict, list[str]]:
    """The call plan from the seed and recorded inputs, as {callId: Call}, plus any design mismatch.
    (Call ids, persona ids and segments come from the plan and personas.jsonl, never from responses.jsonl.)"""
    seed, ids = run["seed"], [a["id"] for a in run["assets"]]
    base = design.base_order(ids, seed)
    problems = [] if base == run["design"]["baseOrder"] else ["the recorded base order doesn't follow from the seed"]
    stubs = [SimpleNamespace(id=p["id"], segment_id=p["segmentId"]) for p in people]
    calls = design.plan_calls(stubs, base, run["repeats"], run["n"] if run["crowd"] else 0, seed)
    if [c.persona_id for c in calls if c.role == "repeat"] != run["design"]["repeatPersonaIds"]:
        problems.append("the recorded repeat draws don't follow from the seed")
    if [c.id for c in design.execution_order(calls, seed)] != run["design"]["executionOrder"]:
        problems.append("the recorded execution order doesn't follow from the seed")
    return {c.id: c for c in calls}, problems


def rederive(records: list[dict], plan: dict, segment_of: dict[str, str]) -> tuple[list[dict], list[str]]:
    """Fresh records: the plan's own metadata, plus the outcome re-derived from each raw reply."""
    problems, seen, fresh = [], set(), []
    for r in records:
        call = plan.get(r.get("callId"))
        if call is None or r["callId"] in seen:
            problems.append(f"unexpected or repeated record {r.get('callId')}")
            continue
        seen.add(r["callId"])
        canonical = record_for(call, segment_of)
        if any(r.get(key) != value for key, value in canonical.items()):
            problems.append(f"{r['callId']}: its role, persona, ordering or label map differs from the plan")
            continue
        if "rawText" in r:
            again = outcome(call.role, call.label_map(), r.get("stopReason", ""), r["rawText"])
        elif r.get("status") == "skipped" and r.get("skipReason") in NO_REPLY_REASONS:
            again = {"status": "skipped", "skipReason": r["skipReason"]}
        else:
            problems.append(f"{r['callId']}: no reply text to check")
            continue
        for key in ("status", "skipReason", "draft", "result"):
            if r.get(key) != again.get(key):
                problems.append(f"{r['callId']}: stored {key} doesn't match its raw reply")
                break
        fresh.append({**canonical, **again})
    missing = sorted(set(plan) - seen)
    if missing:
        problems.append(f"{len(missing)} planned call(s) have no record, e.g. {missing[0]}")
    return fresh, problems


def verify_folder(folder: str, digest: str | None = None) -> list[str]:
    """Every problem found; an empty list means the run checks out."""
    folder = guard(folder, "the run folder")
    for name in (outputs.HASH_FILE,) + outputs.OUTPUT_FILES:
        if not os.path.isfile(os.path.join(folder, name)):
            raise InputError(f"{folder} isn't a finished run folder ({name} is missing)")
    problems = check_hashes(folder, digest)

    def load(name: str):
        with open(os.path.join(folder, name), encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()] if name.endswith(".jsonl") else json.load(f)

    run, people, records, saved = load("run.json"), load("personas.jsonl"), load("responses.jsonl"), load("results.json")
    plan, design_problems = planned_calls(run, people)
    fresh, record_problems = rederive(records, plan, {p["id"]: p["segmentId"] for p in people})
    problems += design_problems + record_problems
    stopped_by = [r for r in records if r.get("stoppedRun")]
    if bool(stopped_by) != bool(run.get("aborted")):
        problems.append("run.json's 'aborted' doesn't match the record that stopped the run")
    if any(r.get("skipReason") == "aborted" for r in fresh) and not run.get("aborted"):
        problems.append("records were skipped as 'aborted' in a run that didn't stop early")
    landing = [c for c in run["design"]["executionOrder"] if c in {r["callId"] for r in fresh}]
    budget = [r["callId"] for r in fresh if r.get("skipReason") == "budget"]
    if budget and set(budget) != set(landing[len(landing) - len(budget):]):
        problems.append("budget skips aren't the tail of the execution order")
    if json.loads(json.dumps(build_results(run, fresh))) != saved:
        problems.append("results.json differs from what the raw replies give")
    return problems
