"""Gate the run, and build the writer's brief from intake.json.

The brief is an allow-list: only the fields named here ever leave the machine. Never evidence excerpts,
URLs, customer details, the owner's revenue or ad figures, owner-voice lexicon, or image descriptions.
Every read is type-guarded, so an odd but valid intake.json gives a plain error, never a traceback.
"""
from __future__ import annotations

import os
import re

STOP_RECOMMENDATIONS = {"fix-setup": "research says to fix its setup first: finish gtm-research",
                        "refine": "research says to refine the brief first: finish gtm-research"}
VERDICT_WORDS = {"worked": "worked: learn from it, don't copy it", "didnt-work": "didn't work"}  # else no clear result
DIGITS = re.compile(r"\d+(?:[.,]\d+)?")


def text(value: object) -> str:
    """A string field, or "" for null, numbers, lists and other wrong types."""
    return value.strip() if isinstance(value, str) else ""


def obj(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def dicts(value: object) -> list[dict]:
    return [x for x in value if isinstance(x, dict)] if isinstance(value, list) else []


def strings(value: object) -> list[str]:
    return [text(x) for x in value if text(x)] if isinstance(value, list) else []


def numbers(value: str) -> set[str]:
    return set(DIGITS.findall(value))


def customer_lexicon(intake: dict) -> list[dict]:
    """Only customer voice: gtm-intake tags the owner's own ad copy "owner", and that never counts."""
    return [x for x in dicts(intake.get("lexicon"))
            if x.get("voice") == "customer" and text(x.get("id")) and text(x.get("phrase"))]


def decision(intake: dict) -> dict:
    return obj(obj(intake.get("research")).get("decision"))


def research_choice(intake: dict) -> str:
    """The owner's recorded choice if there is one, else research's recommendation; "" before research."""
    d = decision(intake)
    return text(d.get("ownerChoice")) or text(d.get("recommendation"))


def gate(intake: dict, alongside: bool) -> tuple[list[str], list[str]]:
    """(errors, warnings). Any error means the run must not start."""
    errors: list[str] = []
    warnings: list[str] = []
    status = obj(intake.get("readiness")).get("status")
    if status != "ready":
        errors.append(f"intake.json readiness is '{status}', not 'ready': finish gtm-intake first")
    choice = research_choice(intake)
    if choice in STOP_RECOMMENDATIONS:
        errors.append(STOP_RECOMMENDATIONS[choice])
    elif not choice:
        warnings.append("No research decision in intake.json yet (gtm-research hasn't run), so drafts rest on intake alone.")
    owner_creatives = dicts(intake.get("creatives"))
    if (choice == "evaluate-creatives" or len(owner_creatives) >= 2) and not alongside:
        errors.append(f"the owner already has {len(owner_creatives)} creatives to evaluate, so this step is skippable: "
                      "go to the evaluation step, or pass --alongside if the owner wants new drafts next to theirs")
    if not focus_segments(intake):
        errors.append("intake.json has no customer groups to write for")
    if not customer_lexicon(intake):
        errors.append("intake.json has no customer-voice phrases (lexicon voice 'customer'), and every draft must borrow one")
    return errors, warnings


def focus_segments(intake: dict) -> list[dict]:
    """The groups research chose to focus on, else every group, in intake.json order."""
    segments = [s for s in dicts(intake.get("segments")) if text(s.get("id"))]
    focus = set(strings(decision(intake).get("focusSegmentIds")))
    return [s for s in segments if s["id"] in focus] or segments


def allocation(segment_ids: list[str], count: int) -> dict[str, int]:
    """Spread `count` options evenly across groups; earlier groups (the owner's ranking) get any remainder."""
    base, extra = divmod(count, len(segment_ids))
    return {sid: base + (1 if i < extra else 0) for i, sid in enumerate(segment_ids)}


def messaging_constraints(intake: dict) -> list[dict]:
    return [c for c in dicts(intake.get("constraints"))
            if c.get("appliesTo") in ("messaging", "all") and c.get("bucket") in ("locked", "preference")]


def messaging_rules(intake: dict) -> list[str]:
    """Constraints that apply to wording, in plain words, for the writer."""
    rules = []
    for c in messaging_constraints(intake):
        rule, dim = obj(c.get("rule")), text(c.get("dimension"))
        values = ", ".join(strings(rule.get("values")))
        if rule.get("op") == "exclude" and values:
            rules.append(f"Never: {values}")
        elif rule.get("op") == "include" and values:
            rules.append(f"{dim}: {values}")
        elif rule.get("op") == "range":
            rules.append(f"{dim}: {rule.get('min')} to {rule.get('max')}")
    return rules


def excluded_terms(intake: dict) -> list[str]:
    """The owner's own "never say" values, enforced word for word by the checks (not just asked of the writer)."""
    return [v for c in messaging_constraints(intake) if obj(c.get("rule")).get("op") == "exclude"
            for v in strings(obj(c.get("rule")).get("values"))]


def price_text(intake: dict) -> str:
    pricing = obj(obj(intake.get("business")).get("pricing"))
    amount, currency, period = pricing.get("amount"), text(pricing.get("currency")), text(pricing.get("period"))
    if not isinstance(amount, (int, float)) or isinstance(amount, bool):
        return ""
    shown = f"{amount:.2f}".rstrip("0").rstrip(".")  # 14.99, 13000: never 1.3e+04
    return " ".join(x for x in (currency, shown) if x) + (f" per {period}" if period else "")


def concern_ranking(segment: dict, concerns: dict) -> list[dict]:
    """The group's concerns, most raised first. The counts stay here, so copy can't turn them into statistics."""
    counts: dict[str, int] = {}
    for bundle in dicts(segment.get("concernBundles")):
        n = bundle.get("observedCount")
        for cid in strings(bundle.get("concernIds")):
            counts[cid] = counts.get(cid, 0) + (n if isinstance(n, int) and not isinstance(n, bool) else 0)
    return [{"label": text(concerns[cid].get("label")), "definition": text(concerns[cid].get("definition"))}
            for cid, _ in sorted(counts.items(), key=lambda kv: -kv[1]) if cid in concerns]


def build_brief(intake: dict) -> dict:
    """The writer's whole view of the business. Every field is copied from intake.json by code."""
    business = obj(intake.get("business"))
    segments = focus_segments(intake)
    seg_ids = {s["id"] for s in segments}
    concerns = {text(c.get("id")): c for c in dicts(intake.get("concerns"))}
    groups = [{"id": s["id"], "name": text(s.get("name")), "description": text(s.get("description")),
               "needs": strings(s.get("needs")), "barriers": strings(s.get("barriers")),
               "decisionCriteria": strings(s.get("decisionCriteria")),
               "concernsMostRaisedFirst": concern_ranking(s, concerns)} for s in segments]
    phrases = [{"id": text(x["id"]), "phrase": text(x["phrase"]),
                "customerGroupIds": [g for g in strings(x.get("segmentIds")) if g in seg_ids]}
               for x in customer_lexicon(intake)]
    return {
        "business": {"name": text(business.get("name")), "description": text(business.get("description")),
                     "price": price_text(intake)},
        "customerGroups": groups,
        "customerPhrases": [p for p in phrases if p["customerGroupIds"]] or phrases,
        "firstMessagingIdeas": [{"angle": text(m.get("angle")), "headline": text(m.get("headline"))}
                                for m in dicts(intake.get("roughMessaging")) if text(m.get("headline"))],
        "messagingRules": messaging_rules(intake),
        "alreadyTried": [{"headline": text(c.get("headline")),
                          "result": VERDICT_WORDS.get(text(obj(c.get("performance")).get("verdict")), "no clear result")}
                         for c in dicts(intake.get("creatives")) if text(c.get("headline"))],
    }


def competitor_names(intake: dict) -> list[str]:
    """Same source as gtm-message-test's build_test.py, so both block the same names."""
    return [text(i.get("name")) for s in dicts(intake.get("segments"))
            for i in dicts(obj(s.get("serviceability")).get("incumbents")) if text(i.get("name"))]


def owner_numbers(intake: dict) -> set[str]:
    """Numbers the owner gave: the business description and the price. Drafts may use only these (and a
    number inside a customer phrase they really use)."""
    return numbers(text(obj(intake.get("business")).get("description"))) | numbers(price_text(intake))


def principles_path(skill_dir: str) -> str:
    """gtm-ad-wording's learned headline principles, read where that sibling skill keeps them."""
    return os.path.join(os.path.dirname(skill_dir), "gtm-ad-wording", "references", "headline-principles.md")


def principles_section(principles: str) -> str:
    """Just the numbered principles: the file's later sections (the procedure for comparing headlines, with
    "higher total wins") are about ranking, which isn't the writer's job."""
    body = re.sub(r"<!--.*?-->", "", principles, flags=re.DOTALL)
    return re.split(r"\n## ", body, maxsplit=1)[0].strip()
