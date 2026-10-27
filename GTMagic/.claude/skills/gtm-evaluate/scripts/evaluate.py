#!/usr/bin/env python3
"""Rank one set of the owner's ads (images or headlines) with simulated customers: GTMagic's evaluate step.

Usage:
  evaluate.py estimate <inputs>                   the plan and a cost estimate; no network, no key
  evaluate.py run <inputs> --out DIR --mock       full run with mock replies; no API calls
  evaluate.py run <inputs> --out DIR --max-usd X  live run; only after the owner has OK'd the estimate
  evaluate.py verify DIR [--digest HEX]           re-check hashes, the plan, and results from the raw replies

<inputs>: --intake intake.json --scenario-file FILE --seed N and one of --images FILE... | --headlines FILE |
          --creatives image|text [--creative-ids cr_1,cr_2]; optional --n 48 --repeats 10 --crowd
          --blind --intake-sha256 HEX
Standard library only. Exit 0 ok, 1 verify mismatch, 2 bad input or setup.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import sys
from dataclasses import dataclass
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # works under python -I too
import cost  # noqa: E402
import design  # noqa: E402
import inputs  # noqa: E402
import outputs  # noqa: E402
import personas  # noqa: E402
import verify  # noqa: E402
from claude_client import ClaudeClient, SetupError, load_key, require_capabilities  # noqa: E402
from mock import failing_calls, mock_reply  # noqa: E402
from prompts import EFFORT, MAX_TOKENS, MODEL, PROMPT_VERSION, build_request, judge_brief  # noqa: E402
from runner import Ledger, run_calls  # noqa: E402
from score import build_results  # noqa: E402

LIVE_WORKERS = 8


@dataclass
class Setup:
    brief: dict
    intake_sha: str
    assets: list
    scenario: str
    people: list
    calls: list
    bodies: dict
    base: list
    warnings: list
    estimate: dict
    worst_usd: dict        # call id → that call's ceiling (unrounded)

    def worst_total(self) -> float:
        return sum(self.worst_usd.values())

    def cap_to_cover_all(self) -> float:
        return cost.cents_up(self.worst_total())


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def code_fingerprint() -> dict[str, str]:
    """sha256 of every script, so a run can be tied to the exact code it ran (pre-registration)."""
    out = {}
    for name in sorted(os.listdir(HERE)):
        if name.endswith(".py"):
            with open(os.path.join(HERE, name), "rb") as f:
                out[name] = hashlib.sha256(f.read()).hexdigest()
    return out


def prepare(args: argparse.Namespace) -> Setup:
    brief, intake_sha, warnings = inputs.load_intake(args.intake, args.blind, args.intake_sha256)
    if args.images:
        assets = inputs.from_images(args.images)
    elif args.headlines:
        assets = inputs.from_headlines(args.headlines)
    else:
        only = [c.strip() for c in args.creative_ids.split(",")] if args.creative_ids else None
        assets = inputs.from_creatives(brief, args.intake, args.creatives, only)
    scenario, scenario_warnings = inputs.load_scenario(args.scenario_file, args.blind)
    people, people_warnings = personas.draw_personas(brief, args.n, args.seed)
    base = design.base_order([a.id for a in assets], args.seed)
    calls = design.plan_calls(people, base, args.repeats, args.n if args.crowd else 0, args.seed)
    by_id = {a.id: a for a in assets}
    person = {p.id: p for p in people}
    groups = judge_brief(personas.group_facts(brief))
    bodies = {c.id: build_request(c, by_id, scenario, person.get(c.persona_id), groups) for c in calls}
    image_tokens = {a.b64: a.tokens for a in assets if a.kind == "image"}
    worst = {cid: cost.worst_usd(b, image_tokens) for cid, b in bodies.items()}
    return Setup(brief, intake_sha, assets, scenario, people, calls, bodies, base,
                 warnings + scenario_warnings + people_warnings, cost.estimate(list(bodies.values()), image_tokens), worst)


def describe(s: Setup, args: argparse.Namespace) -> str:
    counts: dict[str, int] = {}
    for p in s.people:
        counts[p.segment_id] = counts.get(p.segment_id, 0) + 1
    kind = "images" if s.assets[0].kind == "image" else "headlines"
    lines = [f"Plan (nothing sent yet): {len(s.assets)} {kind}"]
    lines += [f"  {a.id}: " + (f"{os.path.basename(a.path)} ({a.tokens} image tokens)" if a.kind == "image"
                               else f'"{a.text}"') for a in s.assets]
    roles: dict[str, int] = {}
    for c in s.calls:
        roles[c.role] = roles.get(c.role, 0) + 1
    lines.append(f"  {args.n} simulated draws ({', '.join(f'{k}: {v}' for k, v in counts.items())}); "
                 + ", ".join(f"{v} {k}" for k, v in roles.items()) + f" calls; {len(s.calls)} in all")
    e = s.estimate
    lines.append(f"  Estimated cost on {MODEL}: about ${e['expectedUsd']:.2f}. A cap of ${s.cap_to_cover_all():.2f} "
                 "covers every call even in the worst case; a lower cap may skip the last calls.")
    lines += [f"  warning: {w}" for w in s.warnings]
    return "\n".join(lines)


def cmd_estimate(args: argparse.Namespace) -> int:
    print(describe(prepare(args), args))
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    s = prepare(args)
    print(describe(s, args))
    out = os.path.abspath(args.out)
    inputs.guard(out, "the output folder")
    ledger_path = os.path.join(os.path.dirname(out), "ledger.jsonl")
    inputs.guard(ledger_path, "the run ledger")  # then opened by its literal path, without following a symlink
    if os.path.islink(ledger_path):
        raise SetupError(f"{ledger_path} is a symlink; the run ledger must be a plain file")
    model_check: dict = {"checked": False, "reason": "mock run: no API calls"}
    client = None
    if not args.mock:
        if args.max_usd is None:
            raise SetupError("A live run needs --max-usd: the spend cap the owner agreed to after seeing the estimate.")
        if s.estimate["expectedUsd"] > args.max_usd:
            raise SetupError(f"The estimate (${s.estimate['expectedUsd']:.2f}) is above --max-usd ${args.max_usd:.2f}.")
        if args.blind and s.worst_total() > args.max_usd:
            raise SetupError(f"--blind: the one blind run can't be cut short, so --max-usd must cover the worst case "
                             f"(${s.cap_to_cover_all():.2f}).")
        client = ClaudeClient(load_key())
        needs_images = s.assets[0].kind == "image"
        require_capabilities(client.model_capabilities(MODEL), MODEL, needs_images, EFFORT)
        model_check = {"checked": True, "structuredOutputs": True, "imageInput": True if needs_images else None}
    outputs.prepare_dir(out)
    outputs.write_jsonl(os.path.join(out, "personas.jsonl"), [p.to_json() for p in s.people])
    started = now()
    stamp = {"runFolder": os.path.basename(out), "mode": "mock" if args.mock else "live", "seed": args.seed,
             "intakeSha256": s.intake_sha, "assets": {a.id: a.sha256 for a in s.assets}, "promptVersion": PROMPT_VERSION}
    outputs.append_ledger(ledger_path, {"event": "started", "at": started, **stamp})
    failures = failing_calls(s.calls, args.seed) if args.mock else {}

    def send(call: design.Call):
        return mock_reply(call, args.seed, failures) if client is None else client.message(s.bodies[call.id])

    responses = os.path.join(out, "responses.jsonl")
    ledger = Ledger(None if args.mock else args.max_usd, s.worst_usd)
    order = design.execution_order(s.calls, args.seed)
    try:
        records, aborted = run_calls(order, send, {p.id: p.segment_id for p in s.people}, ledger,
                                     lambda r: outputs.append_jsonl(responses, r),
                                     workers=1 if args.mock else LIVE_WORKERS)
        outputs.write_jsonl(responses, records)  # the live appends were crash insurance; this is the record
        run = run_json(s, args, order, model_check, started, records, ledger.spent, aborted)
        results = build_results(run, records)
        outputs.write_json(os.path.join(out, "run.json"), run)
        outputs.write_json(os.path.join(out, "results.json"), results)
        with open(os.path.join(out, "summary.md"), "w", encoding="utf-8") as f:
            f.write(outputs.summary_md(run, results))
        digest = outputs.seal(out)
    except BaseException as err:  # the ledger must show a run that started and never finished
        outputs.append_ledger(ledger_path, {"event": "crashed", "at": now(), **stamp, "error": type(err).__name__})
        raise
    outputs.append_ledger(ledger_path, {"event": "aborted" if aborted else "finished", "at": now(), **stamp,
                                        "outputsDigest": digest})
    print(f"\nWrote {out}\nSummary: {os.path.join(out, 'summary.md')}\nOutputs sha256: {digest}")
    if aborted:
        print(f"error: the run stopped early and sent no further calls: {aborted}", file=sys.stderr)
        return 2
    return 0


def run_json(s: Setup, args: argparse.Namespace, order: list, model_check: dict, started: str, records: list,
             cap_usd: float, aborted: str | None) -> dict:
    counts: dict[str, int] = {}
    for p in s.people:
        counts[p.segment_id] = counts.get(p.segment_id, 0) + 1
    repeats = [c.persona_id for c in s.calls if c.role == "repeat"]
    return {"skill": "gtm-evaluate", "mode": "mock" if args.mock else "live", "model": MODEL, "effort": EFFORT,
            "maxTokens": MAX_TOKENS, "promptVersion": PROMPT_VERSION, "seed": args.seed, "n": args.n,
            "repeats": args.repeats, "crowd": args.crowd, "blind": args.blind, "aborted": aborted,
            "assetType": s.assets[0].kind, "assets": [a.to_json() for a in s.assets],
            "inputs": {"intake": {"file": os.path.basename(args.intake), "sha256": s.intake_sha},
                       "scenario": {"file": os.path.basename(args.scenario_file), "text": s.scenario,
                                    "sha256": inputs.sha256_bytes(s.scenario.encode("utf-8"))}},
            "codeSha256": code_fingerprint(), "python": platform.python_version(),
            "design": {"baseOrder": s.base, "orderings": design.latin_square(s.base), "repeatPersonaIds": repeats,
                       "executionOrder": [c.id for c in order]},
            "drawsPerSegment": counts, "modelCheck": model_check,
            "cost": {"estimate": s.estimate, "maxUsd": args.max_usd,
                     "actualUsd": round(sum(r.get("costUsd", 0.0) for r in records), 6),  # from replies' usage
                     "countedAgainstCapUsd": round(cap_usd, 6)},  # plus the worst case for calls with no reply
            "warnings": s.warnings, "startedAt": started, "finishedAt": now()}


def cmd_verify(args: argparse.Namespace) -> int:
    """Hashes match, the plan follows from the seed, and results.json recomputes from the raw replies."""
    try:
        problems = verify.verify_folder(args.folder, args.digest)
    except (KeyError, TypeError, AttributeError, json.JSONDecodeError) as err:
        problems = [f"a run file is malformed ({type(err).__name__}: {err})"]
    for problem in problems:
        print(f"MISMATCH: {problem}")
    print("verify failed" if problems else
          "verified: hashes match, the plan follows from the seed, and results.json recomputes from the raw replies")
    return 1 if problems else 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rank one set of ads with simulated customers (gtm-evaluate).")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("estimate", "run"):
        p = sub.add_parser(name)
        p.add_argument("--intake", required=True)
        p.add_argument("--scenario-file", required=True)
        p.add_argument("--seed", type=int, required=True)
        group = p.add_mutually_exclusive_group(required=True)
        group.add_argument("--images", nargs="+")
        group.add_argument("--headlines")
        group.add_argument("--creatives", choices=("image", "text"))
        p.add_argument("--creative-ids")
        p.add_argument("--n", type=int, default=48)
        p.add_argument("--repeats", type=int, default=10)
        p.add_argument("--crowd", action="store_true")
        p.add_argument("--blind", action="store_true", help="refuse a brief that carries ad results")
        p.add_argument("--intake-sha256", help="refuse unless intake.json has this sha256 (a frozen brief)")
        if name == "run":
            p.add_argument("--out", required=True)
            p.add_argument("--mock", action="store_true")
            p.add_argument("--max-usd", type=float)
    check = sub.add_parser("verify")
    check.add_argument("folder")
    check.add_argument("--digest", help="the run's published outputs digest, to compare with")
    args = parser.parse_args(argv)
    if args.command == "verify":
        return args
    if args.n < 1 or args.repeats < 0:
        parser.error("--n must be at least 1 and --repeats at least 0")
    if args.creative_ids and not args.creatives:
        parser.error("--creative-ids only works with --creatives")
    if args.blind and not args.intake_sha256:
        parser.error("--blind needs --intake-sha256: a blind run is tied to the brief frozen before results existed")
    if args.command == "run" and args.max_usd is not None and not (math.isfinite(args.max_usd) and args.max_usd > 0):
        parser.error("--max-usd must be a positive number")
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        return {"estimate": cmd_estimate, "run": cmd_run, "verify": cmd_verify}[args.command](args)
    except (inputs.InputError, SetupError, OSError, ValueError) as err:
        print(f"error: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
