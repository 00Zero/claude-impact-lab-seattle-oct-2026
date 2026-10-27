"""The writer's prompts and reply schema. Bump PROMPT_VERSION whenever any prompt text below changes."""
from __future__ import annotations

import json
import re

PROMPT_VERSION = "creatives-v1"

SYSTEM = """You write draft ad wording for a small business: a headline, the line under it, and a button.
A separate step tests your drafts on simulated customers later, so don't rank or praise them.

How to write each option:
- One angle per option, different from every other option: a different need, barrier or reason to act.
- Write for the customer group named, in plain words that group would use.
- Borrow at least one real customer phrase from customerPhrases and use its key words in the HEADLINE
  (the test may show the headline alone). Give the phrase's id in lexiconIds. Turn it into second person
  ("my strength" becomes "your strength"); keep its key words.
- Speak to the reader as "you". Never write as a customer (no I, I'm, me, my), and never invent a person
  or a story about one (no "a retired nurse", she, he, her, his).
- headline: at most 10 words. subheadline (the line under it): at most 30 words. callToAction: at most 5 words.
- Write in your own words: never more than five words in a row copied from the brief, except a customer
  phrase used word for word.
- Don't copy a headline from firstMessagingIdeas or alreadyTried; go further. alreadyTried shows what the
  owner ran and whether it worked; learn from it, never repeat it.

- In assumptions, list what the option claims about the product (features, price, who it's for), so the
  owner can confirm each claim is true.

Use the headline principles below. They were learned from news-headline A/B tests, not ads, so adapt them:
- Principles 1 and 12 (a concrete, specific, human scene) mean the READER's own moment, in second person,
  drawn from their needs and barriers. Never a made-up character.
- Principle 4's payoff is what the reader gets to do with the product. A curiosity gap (2) must still say
  what's on offer.
- Two exceptions, because these rules beat the principles:
  - Principle 5: no first-person reactions at all; name the reader's feeling in second person instead.
  - Principle 10: no numbers (digits or words like "three") except the price and a number inside a customer
    phrase you borrow.
In principlesUsed, list the numbers of the principles each option relies on.

Never write:
- Testimonials, reviews, ratings, or anything that reads as a customer speaking. No quotation marks.
- Statistics, results, user counts or any number the brief doesn't give.
- Superlatives ("best", "#1", "top-rated", "world's") or guarantees ("guaranteed", "proven", "for good").
- Offers the brief doesn't mention: free, a free trial, cancel anytime, money back.
- Competitor names or any other brand names.
- Anything the brief's messagingRules forbid.
- If the business touches health, weight or medication: no medication or drug names (GLP-1 included), nothing
  that assumes the reader's condition or treatment ("your shots", "are you on"), no medical claims (cure, treat,
  prevent, heal, doctor-approved), no body results (metabolism, fat-burning, detox, "permanent"), and no
  weight-loss numbers.

The headline principles:
"""

PRINCIPLE_LINE = re.compile(r"^(\d+)\.\s+\*\*", re.MULTILINE)


def principle_numbers(principles: str) -> list[int]:
    """The numbered principles (1–12 today; pass only the principles section), so the schema allows real ones."""
    return sorted({int(n) for n in PRINCIPLE_LINE.findall(principles)})


def system_prompt(principles: str) -> str:
    return SYSTEM + principles.strip() + "\n"


def first_call(brief: dict, per_group: dict[str, int]) -> str:
    """Call 1: the brief, plus how many options to write for each customer group."""
    plan = ", ".join(f"{n} for {sid}" for sid, n in per_group.items() if n)
    return (f"Write {sum(per_group.values())} options: {plan}. Each option must stand on its own; their order doesn't matter.\n\n"
            f"The brief:\n{json.dumps(brief, indent=1, ensure_ascii=False)}")


def replacement_call(brief: dict, per_group: dict[str, int], kept: list[str], dropped: list[tuple[str, str]]) -> str:
    """Call 2: replacements for options the checks dropped, with the plain reason for each."""
    lines = [first_call(brief, per_group), "", "These earlier options were dropped by the checks; don't repeat the mistakes:"]
    lines += [f"- {head}: {why}" for head, why in dropped] or ["- (none)"]
    lines += ["", "These were kept; write different angles from them:"]
    lines += [f"- {head}" for head in kept] or ["- (none)"]
    return "\n".join(lines)


def reply_schema(segment_ids: list[str], lexicon_ids: list[str], principles: list[int]) -> dict:
    """Strict JSON schema for the reply. Enums keep ids to ones in the brief; code still checks every field."""
    string = {"type": "string"}
    option = {
        "type": "object", "additionalProperties": False,
        "properties": {
            "angle": string,
            "targetSegmentId": {"type": "string", "enum": segment_ids},
            "headline": string, "subheadline": string, "callToAction": string,
            "lexiconIds": {"type": "array", "items": {"type": "string", "enum": lexicon_ids}},
            "principlesUsed": {"type": "array", "items": {"type": "integer", "enum": principles}},
            "valueProposition": string, "differentiator": string, "whyItMightWork": string,
            "assumptions": {"type": "array", "items": string},
        },
    }
    option["required"] = sorted(option["properties"])
    return {"type": "object", "additionalProperties": False, "required": ["options"],
            "properties": {"options": {"type": "array", "items": option}}}
