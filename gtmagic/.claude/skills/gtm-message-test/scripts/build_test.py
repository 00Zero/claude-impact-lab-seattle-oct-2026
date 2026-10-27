#!/usr/bin/env python3
"""Build the message test: drafted options + intake.json -> positioning-set.json + experiment-request.json.

Usage: python3 build_test.py <intake.json> <drafts.json> --out-dir <workspace> [--current-creative cr_1 |
                             --current-headline H [--current-subheadline S]] [--category "fitness app"] [--channel landing-page]
                             [--audience audience-sample.json] [--seed N]

Checks every drafted option (references, copy rules, length, duplicates, shape), adds the owner's
current message and a code-built decoy, assigns blind labels and a Williams Latin-square order.
Exits 1 if intake.json isn't ready or there aren't enough clean options, so Claude drafts more.
Standard library only (runs in Claude chat's sandbox too).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I too
from copy_checks import check_copy, dedupe_key, is_health_brief, uses_phrase, words  # noqa: E402
from ordering import pick_repeats, williams_square  # noqa: E402

OPTIONS_PER_TEST = 6          # generated + current message (if any) + decoy
MAX_SUBHEADLINE_WORDS = 30    # CONTRACTS.md: headline + <=30-word subheadline is what customers see
MAX_HEADLINE_WORDS = 10
PROTOCOL_VERSION = "protocol-v1"  # bump whenever INSTRUCTIONS or DIMENSIONS change
DIMENSIONS = {
    "relevance": "How much this speaks to your situation and what you care about right now.",
    "credibility": "How believable it is, coming from a company you don't know yet.",
    "differentiation": "How different it sounds from what you use or have seen before.",
    "clarity": "How quickly you understand what's offered and who it's for.",
    "actionIntent": "How likely you'd be to click or sign up after seeing it.",
}
INSTRUCTIONS = (
    "You're shown several short messages for the same kind of product, labeled with letters. "
    "Answer as yourself, using only your own situation as described. Pick the one message that would make "
    "you most likely to act, or \"none\" if none would. Rate every message from 1 (not at all) to 5 (very) "
    "on each dimension. For any message you have a doubt about, give one short objection in your own words. "
    "Don't assume anything about the company beyond the message itself."
)


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise SystemExit(f"ERROR {path} must be a JSON object")
    return data


def text(value: object) -> str:
    """A string field, or "" for null, numbers, lists and other wrong types."""
    return value.strip() if isinstance(value, str) else ""


def id_list(value: object) -> list[str]:
    return [x for x in value if isinstance(x, str)] if isinstance(value, list) else []


def sentence(s: str) -> str:
    """Every option ends its headline and subheadline the same way, so punctuation can't single one out."""
    s = s.strip()
    return s if not s or s[-1] in ".?!" else s + "."


def article(noun: str) -> str:
    return ("an " if noun[:1].lower() in "aeiou" else "a ") + noun


def current_message(intake: dict, args: argparse.Namespace, errors: list[str], warnings: list[str]) -> dict | None:
    """The owner's current message in their exact words: a creative from intake.json, copied by code (--current-creative),
    else the command line, else business.currentMessage if intake has it."""
    creative_id, headline, subheadline = getattr(args, "current_creative", None), args.current_headline, args.current_subheadline
    if creative_id:
        cr = next((c for c in intake.get("creatives") or [] if isinstance(c, dict) and c.get("id") == creative_id), None)
        if not cr or not text(cr.get("headline")):
            errors.append(f"--current-creative {creative_id}: intake.json has no creative with that id and a headline")
            return None
        body = text(cr.get("body"))
        if words(body) > MAX_SUBHEADLINE_WORDS:  # an ad's main text would stand out next to one-line subheadlines
            warnings.append(f"creative {creative_id}'s main text is over {MAX_SUBHEADLINE_WORDS} words, so only its headline is tested")
            body = ""
        return {"headline": text(cr["headline"]), "subheadline": body}
    if headline and headline.strip():
        return {"headline": headline.strip(), "subheadline": (subheadline or "").strip()}
    stored = (intake.get("business") or {}).get("currentMessage") or {}
    if isinstance(stored, dict) and text(stored.get("headline")):
        return {"headline": text(stored.get("headline")), "subheadline": text(stored.get("subheadline"))}
    return None


def check_draft(d: object, i: int, ctx: dict) -> tuple[dict | None, list[str]]:
    """One drafted option -> a hypothesis, or None with the reason it was dropped."""
    where = f"option {i + 1}"
    if not isinstance(d, dict):
        return None, [f"{where} dropped: not an object"]
    notes: list[str] = []
    head, sub = text(d.get("headline")), text(d.get("subheadline"))
    kept = {}
    for key, known in (("targetSegmentIds", ctx["seg_ids"]), ("lexiconIds", ctx["lex_ids"]), ("evidenceIds", ctx["ev_ids"])):
        kept[key] = [x for x in id_list(d.get(key)) if x in known]
        notes += [f"{where}: dropped {key[:-3]} '{x}': not tagged customer voice in intake.json" if x in ctx["not_customer_lex_ids"]
                  else f"{where}: dropped unknown {key[:-3]} '{x}'" for x in id_list(d.get(key)) if x not in known]
    level, reasons = check_copy(ctx["visible"](head, sub), ctx["competitors"], ctx["health"])
    problem = (
        "no headline" if not head
        else "borrows no real customer phrase (lexiconIds)" if not kept["lexiconIds"]
        else "doesn't really use any customer phrase it cites" if not any(
            uses_phrase(ctx["visible"](head, sub), ctx["phrases"][x]) for x in kept["lexiconIds"])
        else "no subheadline, but every option shows one" if ctx["show_sub"] and not sub
        else f"subheadline over {MAX_SUBHEADLINE_WORDS} words" if ctx["show_sub"] and words(sub) > MAX_SUBHEADLINE_WORDS
        else "; ".join(r for r in reasons if level == "block") if level == "block"
        else "same headline as another option" if dedupe_key(head) in ctx["seen"]
        else None
    )
    if problem:
        return None, notes + [f"{where} dropped: {problem}: \"{head}\""]
    if words(head) > MAX_HEADLINE_WORDS:
        notes.append(f"{where}: headline is over {MAX_HEADLINE_WORDS} words")
    notes += [f"{where}: {r}" for r in reasons]  # cautions only; blocks were dropped above
    extra = {k: text(d.get(k)) for k in ("valueProposition", "differentiator", "callToAction")}
    for k, v in extra.items():  # not shown to customers, but the report may quote them
        notes += [f"{where} {k}: {r}" for r in check_copy(v, ctx["competitors"], ctx["health"])[1]]
    return {
        "id": "", "round": 1, "source": "generated", "angle": text(d.get("angle")) or f"Angle {i + 1}",
        "targetSegmentIds": kept["targetSegmentIds"], "headline": head, "subheadline": sub if ctx["show_sub"] else "",
        **extra, "assumptions": [a.strip() for a in d.get("assumptions") or [] if isinstance(a, str) and a.strip()]
        if isinstance(d.get("assumptions"), list) else [],
        "evidenceIds": kept["evidenceIds"], "lexiconIds": kept["lexiconIds"],
    }, notes


def build(intake: dict, drafts: dict, args: argparse.Namespace) -> tuple[dict, dict, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    status = (intake.get("readiness") or {}).get("status")
    if status != "ready":
        errors.append(f"intake.json readiness is '{status}', not 'ready': finish gtm-intake first")
    segments = [s for s in intake.get("segments") or [] if isinstance(s, dict)]
    owner = current_message(intake, args, errors, warnings)
    if not owner and not getattr(args, "current_creative", None):
        warnings.append("No current message given, so nothing is tested against it (pass --current-creative or --current-headline).")
    show_sub = not owner or bool(owner["subheadline"])  # same shape: no current subheadline, nobody shows one
    if not show_sub:
        warnings.append("The current message has no subheadline, so every option shows its headline only.")
    category = args.category.strip().rstrip(".")
    for prefix in ("a ", "an ", "the "):
        category = category[len(prefix):] if category.lower().startswith(prefix) else category
    category = category or "product"
    decoy = f"The {category} for everyone"
    lexicon = [x for x in intake.get("lexicon") or [] if isinstance(x, dict)]
    ctx = {
        "seg_ids": {s.get("id") for s in segments},
        # gtm-intake tags the owner's own ad copy voice "owner"; only customer voice counts as a real customer phrase.
        "lex_ids": {x.get("id") for x in lexicon if x.get("voice") == "customer"},
        "phrases": {x.get("id"): text(x.get("phrase")) for x in lexicon},
        "not_customer_lex_ids": {x.get("id") for x in lexicon if x.get("voice") != "customer"},
        "ev_ids": {e.get("id") for e in intake.get("evidence") or [] if isinstance(e, dict)},
        "competitors": [i.get("name", "") for s in segments for i in (s.get("serviceability") or {}).get("incumbents") or []
                        if isinstance(i, dict)],
        "health": is_health_brief(intake), "show_sub": show_sub,
        "visible": lambda h, s: f"{h} {s}" if show_sub and s else h,
        "seen": {dedupe_key(decoy)} | ({dedupe_key(owner["headline"])} if owner else set()),  # no draft may copy either
    }
    if check_copy(decoy, ctx["competitors"], ctx["health"])[0] == "block":
        errors.append(f"the decoy \"{decoy}\" breaks a messaging rule: pass a plainer --category")
    needed = OPTIONS_PER_TEST - 1 - (1 if owner else 0)

    hypotheses: list[dict] = []
    angles: set[str] = set()
    options = drafts.get("options") if isinstance(drafts.get("options"), list) else []
    for i, d in enumerate(options):
        if len(hypotheses) == needed:
            break
        hyp, notes = check_draft(d, i, ctx)
        warnings += notes
        if hyp:
            if hyp["angle"].lower() in angles:
                warnings.append(f"option {i + 1}: repeats the angle \"{hyp['angle']}\"")
            angles.add(hyp["angle"].lower())
            ctx["seen"].add(dedupe_key(hyp["headline"]))
            hypotheses.append(hyp)
    if len(hypotheses) < needed:
        errors.append(f"only {len(hypotheses)} of {needed} new options passed the checks: draft more and re-run")
    aimed = {seg.get("id"): sum(seg.get("id") in h["targetSegmentIds"] for h in hypotheses) for seg in segments}
    if aimed and max(aimed.values()) - min(aimed.values()) > 1:
        # The customer-group comparison mostly measures which group the messages were written for.
        counts = ", ".join(f"\"{s.get('name')}\" {aimed[s.get('id')]}" for s in segments)
        warnings.append(f"new options aren't balanced across customer groups ({counts}); the group comparison will favour "
                        "the group with more. Draft options so each group has about the same number")

    blank = {"targetSegmentIds": [], "valueProposition": "", "differentiator": "", "callToAction": "",
             "assumptions": [], "evidenceIds": [], "lexiconIds": []}
    if owner:
        reasons = check_copy(ctx["visible"](owner["headline"], owner["subheadline"]), ctx["competitors"], ctx["health"])[1]
        warnings += [f"current message: {r} (kept: it's the owner's own)" for r in reasons]
        hypotheses.append({"id": "", "round": 1, "source": "founder-current", "angle": "Your current message",
                           **blank, "headline": owner["headline"], "subheadline": owner["subheadline"]})
    hypotheses.append({"id": "", "round": 1, "source": "decoy", "angle": "Generic decoy (control)", **blank,
                       "headline": decoy,
                       "subheadline": "Everything you need, all in one place." if show_sub else ""})
    for n, h in enumerate(hypotheses, 1):
        h["id"] = f"hyp_{n}"

    # Blind labels in a shuffle seeded by the content, so the decoy's label differs between businesses.
    seed = args.seed if args.seed is not None else zlib.crc32("|".join(h["headline"] for h in hypotheses).encode())
    rng = random.Random(seed)
    order = [h["id"] for h in hypotheses]
    rng.shuffle(order)
    labels = [chr(ord("A") + i) for i in range(len(order))]
    by_id = {h["id"]: h for h in hypotheses}
    shown = lambda h: f"{sentence(h['headline'])} {sentence(h['subheadline'])}".strip() if show_sub else sentence(h["headline"])  # noqa: E731
    channel = {"landing-page": "landing page", "ad": "ad", "email": "email"}[args.channel]
    request = {
        "schemaVersion": 1, "id": "exp_1", "round": 1,
        "scenario": {"context": f"You're looking at {article(channel)} for {article(category)}.",
                     "decision": "Which of these would make you most likely to sign up? You can pick none.",
                     "channel": args.channel},
        "stimuli": [{"label": lab, "candidateId": cid, "text": shown(by_id[cid])} for lab, cid in zip(labels, order)],
        "orderings": williams_square(labels),
        "repeatCustomerIds": pick_repeats(args.audience, rng, warnings, {str(s) for s in ctx["seg_ids"]}),
        "protocol": {"version": PROTOCOL_VERSION, "instructions": INSTRUCTIONS, "dimensionDefinitions": DIMENSIONS},
    }
    # Ids repeat across rebuilds (exp_1, hyp_1…), so this is what tells answers to an older build apart: a hash of
    # everything customers are shown or asked. Opaque to readers, who only compare it for equality.
    request["fingerprint"] = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()[:12]
    return {"schemaVersion": 1, "round": 1, "hypotheses": hypotheses, "warnings": warnings}, request, errors, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("intake")
    ap.add_argument("drafts")
    ap.add_argument("--out-dir", required=True, help="the workspace folder; never fixtures/demo")
    ap.add_argument("--current-creative", help="id of the owner's creative in intake.json to test as the current message")
    ap.add_argument("--current-headline")
    ap.add_argument("--current-subheadline")
    ap.add_argument("--category", default="product", help="1-3 generic words for the decoy, e.g. 'fitness app'")
    ap.add_argument("--channel", default="landing-page", choices=["landing-page", "ad", "email"])
    ap.add_argument("--audience", help="audience-sample.json, to choose the repeat customers")
    ap.add_argument("--seed", type=int, help="label shuffle seed (default: derived from the options)")
    args = ap.parse_args()

    intake, drafts = load(args.intake), load(args.drafts)
    positioning, request, errors, warnings = build(intake, drafts, args)
    for w in warnings:
        print(f"WARNING {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        return 1
    os.makedirs(args.out_dir, exist_ok=True)
    for name, data in (("positioning-set.json", positioning), ("experiment-request.json", request)):
        with open(os.path.join(args.out_dir, name), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    print(f"OK {len(positioning['hypotheses'])} options; wrote positioning-set.json and experiment-request.json to {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
