#!/usr/bin/env python3
"""Write draft ad wording with GPT Sol (through OpenRouter) from a ready intake.json, then check every draft.

Usage:
  python3 generate.py estimate <intake.json> [--model M] [--count 8] [--alongside]
  python3 generate.py run <intake.json> --out <workspace>/creatives [--max-usd 0.50] [--model M] [--count 8]
                          [--seed N] [--alongside] [--principles FILE] [--mock] [--replace]

At most 2 calls a run (each retried once at most): the second only if fewer than 6 drafts pass the checks or
a customer group got none. Exit 0: enough drafts for a test; 1: too few clean drafts (files are still
written); 2: bad input, bad setup, or the first call failed. Standard library only.
"""
from __future__ import annotations

import argparse
import datetime
import glob
import hashlib
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I too
import brief as briefs  # noqa: E402
import prompts  # noqa: E402
import render  # noqa: E402
import writer  # noqa: E402
from checks import Context, balance_warnings, dedupe_key, grams, interleave, is_health_brief  # noqa: E402
from openrouter_client import ModelPrice, OpenRouterClient, Reply, SetupError, load_key, redact  # noqa: E402

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
MOCK_REPLY = os.path.join(REPO_DIR, "fixtures", "demo", "creatives", "writer-reply.json")
DEFAULT_MODEL = "openai/gpt-6.1-sol"   # pinned, not the ~latest alias, so runs are reproducible
DEFAULT_COUNT = 8
MAX_COUNT = 12         # gtm-evaluate takes at most 12 ads
MIN_USABLE = 5         # gtm-message-test needs 4 drafts beside the owner's message and 5 without one; which the
                       # owner will pick isn't known here, so ask for the larger


def load_json(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise SetupError(f"Couldn't read {path}: {err}") from None
    if not isinstance(data, dict):
        raise SetupError(f"{path} must be a JSON object")
    return data


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def build_context(intake: dict) -> Context:
    lexicon = briefs.customer_lexicon(intake)
    excerpts = [briefs.text(e.get("excerpt")) for e in briefs.dicts(intake.get("evidence"))]
    seen = {dedupe_key(briefs.text(c.get("headline"))) for c in briefs.dicts(intake.get("creatives"))}
    seen |= {dedupe_key(briefs.text(m.get("headline"))) for m in briefs.dicts(intake.get("roughMessaging"))}
    return Context(
        seg_ids={s["id"] for s in briefs.focus_segments(intake)},
        phrases={x["id"]: briefs.text(x["phrase"]) for x in lexicon},
        lexicon_evidence={x["id"]: briefs.text(x.get("evidenceId")) for x in lexicon},
        excerpt_grams=set().union(*(grams(e) for e in excerpts)),
        phrase_grams=set().union(*(grams(x["phrase"]) for x in lexicon)),
        allowed_numbers=briefs.owner_numbers(intake), excluded=briefs.excluded_terms(intake),
        competitors=briefs.competitor_names(intake), health=is_health_brief(intake), seen=seen - {""})


def prepare(args: argparse.Namespace) -> dict:
    """Everything both commands need; raises SetupError on anything that blocks the run."""
    intake = load_json(args.intake)
    errors, warnings = briefs.gate(intake, args.alongside)
    principles_file = args.principles or briefs.principles_path(SKILL_DIR)
    if not os.path.isfile(principles_file):
        errors.append(f"headline principles not found at {principles_file}: install gtm-ad-wording alongside this "
                      "skill, or pass --principles")
    if errors:
        raise SetupError("Can't write drafts yet:\n" + "\n".join(f"- {e}" for e in errors))
    with open(principles_file, encoding="utf-8") as f:
        principles = f.read()
    section = briefs.principles_section(principles)
    numbers = prompts.principle_numbers(section)
    if not numbers:
        raise SetupError(f"{principles_file} has no numbered principles ('1. **…**')")
    brief = briefs.build_brief(intake)
    seg_ids = [g["id"] for g in brief["customerGroups"]]
    per_group = briefs.allocation(seg_ids, args.count)
    with open(args.intake, "rb") as f:
        intake_sha = hashlib.sha256(f.read()).hexdigest()
    user = prompts.first_call(brief, per_group)
    return {"intake": intake, "warnings": warnings, "principles": principles, "section": section,
            "principles_file": principles_file, "brief": brief, "seg_ids": seg_ids, "per_group": per_group,
            "system": prompts.system_prompt(section), "user": user, "intake_sha": intake_sha,
            "schema": prompts.reply_schema(seg_ids, [p["id"] for p in brief["customerPhrases"]], numbers)}


def worst_case(p: dict, price: ModelPrice, count: int) -> float:
    return writer.worst_case_usd(price, p["system"], writer.call2_bound(p["user"], count), p["schema"])


def mock_chat() -> writer.Chat:
    """Replays the demo fixture's replies in order; None once they run out."""
    replies = [r for r in load_json(MOCK_REPLY).get("replies") or [] if isinstance(r, dict)]

    def chat(body: dict) -> Reply | None:
        if not replies:
            return None
        return Reply(text=json.dumps(replies.pop(0)), finish_reason="stop", generation_id="mock", model="mock",
                     usage={"prompt_tokens": 0, "completion_tokens": 0, "cost": 0})
    return chat


def cmd_estimate(args: argparse.Namespace) -> int:
    p = prepare(args)
    price = OpenRouterClient(key="").model_price(args.model)  # the public models list needs no key
    print(f"Model: {args.model} via OpenRouter, at most ${price.prompt_per_million:g}/M input and "
          f"${price.completion_per_million:g}/M output tokens.")
    print(f"Plan: {args.count} drafts ({', '.join(f'{n} for {s}' for s, n in p['per_group'].items())}); "
          f"a second call only if fewer than {writer.MIN_KEPT} pass the checks or a customer group gets none.")
    print(f"Worst case for the whole run: ${worst_case(p, price, args.count):.2f}, if every call and retry used "
          "every token (a typical run is a small fraction of that).")
    for w in p["warnings"]:
        print(f"WARNING {w}")
    return 0


def prepare_out(out: str, replace: bool) -> None:
    if "fixtures" in os.path.realpath(out).split(os.sep):
        raise SetupError("--out must be a workspace folder (gtm-workspace/<slug>/creatives), never fixtures/")
    if os.path.exists(os.path.join(out, "generated.json")) and not replace:
        raise SetupError(f"{out} already holds a run; pass --replace to write over it, or choose a new --out")
    os.makedirs(out, exist_ok=True)
    for stale in glob.glob(os.path.join(out, "raw", "call-*.json")):  # this skill's own earlier replies only
        os.remove(stale)


def cmd_run(args: argparse.Namespace) -> int:
    p = prepare(args)
    prepare_out(args.out, args.replace)
    seed = args.seed if args.seed is not None else random.SystemRandom().randrange(1, 2**31)
    if args.mock:
        chat, price = mock_chat(), ModelPrice("mock", 0.0, 0.0)
    else:
        client = OpenRouterClient(load_key())
        price = client.model_price(args.model)
        chat = client.chat
    worst = worst_case(p, price, args.count)
    if worst > args.max_usd:
        raise SetupError(f"The worst case (${worst:.2f}) is over the cap (${args.max_usd:.2f}); "
                         "raise --max-usd with the owner's OK.")
    ctx = build_context(p["intake"])
    result = writer.run_calls(p, ctx, chat, args.model, seed, price, args.out, now)
    kept = interleave([c for _, c in result.checked if c.kept], p["seg_ids"])
    warnings = p["warnings"] + result.warnings + balance_warnings(kept, p["seg_ids"])
    record = render.run_record(p, args, seed, worst, result, kept, ctx, warnings, now())
    render.write_all(args.out, record, p["intake"], p["section"])
    print(f"{len(kept)} drafts kept, {len(result.checked) - len(kept)} dropped; files in {args.out}")
    for w in warnings:
        print(f"WARNING {w}")
    if result.first_call_failed:
        return 2
    if len(kept) < MIN_USABLE:
        print(f"Too few clean drafts for a test (need {MIN_USABLE}). Show the owner what was dropped and why.")
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("estimate", "run"):
        sp = sub.add_parser(name)
        sp.add_argument("intake")
        sp.add_argument("--model", default=DEFAULT_MODEL)
        sp.add_argument("--count", type=int, default=DEFAULT_COUNT, choices=range(writer.MIN_KEPT, MAX_COUNT + 1),
                        metavar=f"{writer.MIN_KEPT}-{MAX_COUNT}")
        sp.add_argument("--alongside", action="store_true", help="write drafts even though the owner has creatives")
        sp.add_argument("--principles", help="headline principles file (default: gtm-ad-wording's)")
        if name == "run":
            sp.add_argument("--out", required=True, help="<workspace>/creatives; never fixtures/")
            sp.add_argument("--max-usd", type=float, default=0.50)
            sp.add_argument("--seed", type=int)
            sp.add_argument("--mock", action="store_true", help="replay the demo reply; no key, no network")
            sp.add_argument("--replace", action="store_true", help="write over an earlier run in --out")
    args = ap.parse_args()
    try:
        return cmd_estimate(args) if args.cmd == "estimate" else cmd_run(args)
    except SetupError as err:
        print(f"ERROR {err}", file=sys.stderr)
        return 2
    except Exception as err:  # noqa: BLE001 (last resort: never let a traceback print the key)
        print(f"ERROR unexpected {type(err).__name__}: {redact(str(err))}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
