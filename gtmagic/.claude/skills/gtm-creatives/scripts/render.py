"""The run's files: generated.json (the record), message-drafts.json and headlines.txt (the handoffs to the
evaluation skills), and creatives.md (the owner's view). Written by code from the cleaned, checked options.
"""
from __future__ import annotations

import hashlib
import json
import os
import re

import prompts
from writer import EFFORT

PRINCIPLE_NAME = re.compile(r"^(\d+)\.\s+\*\*(.+?)\.?\*\*", re.MULTILINE)


def option_record(oid: str, call: int, c, ctx) -> dict:  # noqa: ANN001 (Checked, Context)
    o = c.option
    lexicon_ids = [x for x in o["lexiconIds"] if x in ctx.phrases]
    return {
        "id": oid, "call": call, "status": "kept" if c.kept else "dropped", "reasons": c.reasons, "notes": c.notes,
        **{k: o[k] for k in ("angle", "targetSegmentId", "headline", "subheadline", "callToAction")},
        "lexiconIds": lexicon_ids,
        # Citations come from intake.json's lexicon, by code, never from the writer.
        "evidenceIds": sorted({ctx.lexicon_evidence[x] for x in lexicon_ids if ctx.lexicon_evidence.get(x)}),
        "principlesUsed": o["principlesUsed"],   # the writer's own claim, not a score
        **{k: o[k] for k in ("valueProposition", "differentiator", "whyItMightWork", "assumptions")},
        "isDraft": True,
    }


def total_cost(calls: list[dict]) -> float | None:
    """OpenRouter's figures summed; None (unknown) if any attempt may have been billed without a figure."""
    if any(c.get("maybeBilled") or c.get("earlierAttemptUnknown") for c in calls):
        return None
    costs = [c.get("costUsd") for c in calls if c.get("outcome") != "failed"]
    if any(not isinstance(x, (int, float)) for x in costs):
        return None
    return round(sum(costs), 6)


def run_record(p: dict, args, seed: int, worst: float, result, kept: list, ctx,  # noqa: ANN001
               warnings: list[str], created_at: str) -> dict:
    ids = {id(c): f"gen_{i}" for i, (_, c) in enumerate(result.checked, 1)}
    record = {
        "schemaVersion": 1, "isDraft": True,
        "writer": {"model": "mock" if args.mock else args.model, "via": "OpenRouter", "promptVersion": prompts.PROMPT_VERSION,
                   "effort": EFFORT, "seed": seed},
        "inputs": {"intakeSha256": p["intake_sha"], "principlesFile": os.path.relpath(p["principles_file"]),
                   "principlesSha256": hashlib.sha256(p["principles"].encode("utf-8")).hexdigest(),
                   "briefSha256": hashlib.sha256(json.dumps(p["brief"], sort_keys=True).encode("utf-8")).hexdigest()},
        "createdAt": created_at,
        "worstCaseUsd": worst, "costUsd": total_cost(result.calls),
        "calls": result.calls,
        "options": [option_record(ids[id(c)], n, c, ctx) for n, c in result.checked],
        "order": [ids[id(c)] for c in kept],   # handoff order: round-robin across customer groups
        "warnings": warnings,
    }
    if args.mock:
        record["_note"] = "FAKE: replayed a hand-written stand-in for the writer's reply; no model was called."
    return record


def kept_in_order(record: dict) -> list[dict]:
    by_id = {o["id"]: o for o in record["options"]}
    return [by_id[i] for i in record["order"]]


def message_drafts(record: dict) -> dict:
    """gtm-message-test's draft format (references/schema.md), so build_test.py takes it as is."""
    note = ("FAKE: a hand-written stand-in reply, replayed by gtm-creatives --mock; no model was called."
            if record.get("_note") else
            f"Draft ad wording written by {record['writer']['model']} via OpenRouter (gtm-creatives); not tested.")
    return {
        "_note": note,
        "options": [{"angle": o["angle"], "headline": o["headline"], "subheadline": o["subheadline"],
                     "targetSegmentIds": [o["targetSegmentId"]], "lexiconIds": o["lexiconIds"], "evidenceIds": o["evidenceIds"],
                     "valueProposition": o["valueProposition"], "differentiator": o["differentiator"],
                     "callToAction": o["callToAction"], "assumptions": o["assumptions"]}
                    for o in kept_in_order(record)],
    }


def principle_names(section: str) -> dict[int, str]:
    """From the numbered principles only (the caller passes just that section)."""
    names: dict[int, str] = {}
    for n, name in PRINCIPLE_NAME.findall(section):
        names.setdefault(int(n), name.strip())
    return names


def markdown(record: dict, intake: dict, section: str) -> str:
    """The owner's view, in plain words: no ids, no 'segment', no scores."""
    business = intake.get("business") if isinstance(intake.get("business"), dict) else {}
    name = str(business.get("name") or "your business")
    groups = {s.get("id"): str(s.get("name") or "a customer group") for s in intake.get("segments") or [] if isinstance(s, dict)}
    phrases = {x.get("id"): str(x.get("phrase") or "") for x in intake.get("lexicon") or [] if isinstance(x, dict)}
    names = principle_names(section)
    kept = kept_in_order(record)
    out = [f"# Draft ad wording for {name}", ""]
    if record.get("_note"):
        out += ["> **FAKE:** a hand-written stand-in for the writer's reply, replayed for the demo. No model was called.", ""]
    else:
        out += [f"Written by {record['writer']['model']}, through OpenRouter.", ""]
    out += ["**These are drafts, not tested yet.** Next, simulated customers compare them. That tells you which to test "
            "first with real money, not which will win.", ""]
    for gid, gname in groups.items():
        mine = [o for o in kept if o["targetSegmentId"] == gid]
        if not mine:
            continue
        out += [f"## For {gname}", ""]
        for o in mine:
            used = ", ".join(f"{n} ({names[n].lower()})" if n in names else str(n) for n in o["principlesUsed"])
            out += [f"**{o['headline']}** (draft)", "",
                    f"- The line under it: {o['subheadline']}",
                    f"- Button: {o['callToAction']}",
                    f"- Customer words it borrows: {'; '.join(phrases.get(x, '') for x in o['lexiconIds'])}"]
            if used:
                out.append(f"- The writer says it uses headline principles {used}")
            out += [f"- Claims to confirm are true: {a}" for a in o["assumptions"]]
            out += [f"- Check before using: {n}" for n in o["notes"]]
            out.append("")
    dropped = [o for o in record["options"] if o["status"] == "dropped"]
    if dropped:
        out += ["## What the checks dropped", ""]
        out += [f"- {o['headline'] or '(no headline)'}: {o['reasons'][0]}" for o in dropped]
        out.append("")
    if record["warnings"]:
        out += ["## Worth knowing", ""] + [f"- {w}" for w in record["warnings"]] + [""]
    cost = record.get("costUsd")
    out += [f"This run made {len(record['calls'])} call(s) to the writer"
            + (f" and cost ${cost:.4f} (OpenRouter's figure)." if isinstance(cost, (int, float))
               else "; its exact cost is unknown, so check your OpenRouter activity page.")]
    return "\n".join(out) + "\n"


def write_all(out: str, record: dict, intake: dict, section: str) -> None:
    def write(name: str, content: str) -> None:
        with open(os.path.join(out, name), "w", encoding="utf-8") as f:
            f.write(content)

    write("generated.json", json.dumps(record, indent=1, ensure_ascii=False) + "\n")
    write("message-drafts.json", json.dumps(message_drafts(record), indent=1, ensure_ascii=False) + "\n")
    write("headlines.txt", "".join(o["headline"] + "\n" for o in kept_in_order(record)))
    write("creatives.md", markdown(record, intake, section))
