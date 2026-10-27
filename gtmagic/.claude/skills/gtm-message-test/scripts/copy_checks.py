"""Copy checks for every message before simulated customers see it (used by build_test.py).

"block" drops a generated option; "caution" keeps it with a warning. The owner's current
message is never dropped, only flagged. MESSAGING_BANNED is copied from gtm-intake's
guardrails.py so both skills share one rule list; tests/test_message_test.py fails if they drift.
Unlike gtm-intake, its medical and drug rules apply only to health-related briefs, so "Treat
yourself" or "Prescription glasses" don't block a bakery or an optician.
"""
from __future__ import annotations

import re

# ---- Copied from .claude/skills/gtm-intake/scripts/guardrails.py (keep identical) ----
DRUG_NAMES = r"ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide|saxenda|liraglutide|glp[\s\-\u2010-\u2015]?1"
DRUG_TERMS = (DRUG_NAMES + r"|\bmedications?\b|\bmeds\b|\bprescri|\binjections?\b|\bjabs?\b"
              r"|weight[- ]loss (shots?|drugs?)")
CONDITION_TERMS = DRUG_TERMS + r"|diabet|obes|bariatric"
MESSAGING_BANNED = {
    "names a medication, drug class or treatment": DRUG_TERMS,
    "assumes the reader's health condition": r"\bare you on\b|\byour (meds|medication|shots?|injections?)\b",
    "uses a superlative or a guarantee": r"\bbest\b|#1|\bnumber one\b|\bguarantee",
    "makes a medical claim": r"\bcures?\b|\btreats?\b|\btreatment\b|\bprevents?\b|\bdiagnos|\bclinically\b|\bdoctor[- ]approved\b",
}
# ---- end of copy ----

# ---- Copied from gtm-intake's guardrails.py and provenance.py (keep identical; a test checks they agree) ----
# Words that carry no meaning of their own, ignored when checking that a line really uses a customer phrase.
STOPWORDS = frozenset("a an and are as at be but by do for from had has have i i'm i've in is it it's its "
                      "just me my of on or our so than that the their them then they this to too us was we "
                      "were what when with you you're your".split())


def norm(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip().lower()


def content_words(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+(?:'[a-z]+)?", norm(text))
    return {w for w in words if w not in STOPWORDS} or set(words)


def uses_phrase(line: str, phrase: str) -> bool:
    """At least half of the phrase's content words appear in the line: borrowed in substance, not just cited."""
    wanted = content_words(phrase)
    return bool(wanted) and 2 * len(wanted & content_words(line)) >= len(wanted)
# ---- end of copy ----

HEALTH_ONLY = {"names a medication, drug class or treatment", "assumes the reader's health condition", "makes a medical claim"}
NUM = r"(?:\d+(?:\.\d+)?\+?|a|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty)"
WEIGHT_UNIT = r"(?:lbs?|pounds?|kgs?|kilos?|kilograms?|stone|(?:dress |clothing )?sizes?|inch(?:es)?|%|percent)"
LOSS_VERB = r"(?:lose|lost|losing|drop|dropped|shed|cut|melt|burn|down|slim)"
I = re.IGNORECASE

# (reason, pattern, flags). Every business: no invented proof, ratings, testimonials or superlatives.
ALWAYS_BLOCK = [
    ("reads like a rating", r"\btestimonials?\b|\brated\s+\d|\bfive[- ]stars?\b|\b\d(\.\d)?[- ]?(stars?|★)|★{3,}", I),
    # A first-person quote followed by a name: “This saved my mornings” — Sarah
    ("reads like a testimonial", r"[\"“'][^\"”']*\b(?i:i|i'm|my|me)\b[^\"”']*[\"”']\s*(?:[-—–]|,?\s*(?i:says)\b)\s*[A-Z][a-z]+", 0),
    ("superlative", r"\bno\.?\s?1\b|\bnumber 1\b|\btop[- ]rated\b|\bworld'?s\b", I),
    ("promises a result", r"\bproven to\b|\bscientifically proven\b|\bresults guaranteed\b|\bresults or your money back\b|\bnever lose\b", I),
    ("states a statistic the owner didn't give",
     r"\b(trusted|used|loved|chosen|joined)\s+by\s+(over\s+|more than\s+)?\d[\d,.]*\s*(k|m|thousand|million)?\b"
     r"|\bjoin\s+(over\s+|more than\s+)?\d[\d,.]*\b|\b\d+\s?%\s+of\s+(users|customers|people|members|women|men)\b", I),
]
# Health-related briefs only.
HEALTH_BLOCK = [
    ("names a health condition", CONDITION_TERMS, I),
    ("assumes the reader's treatment", r"\byour\b[^.?!]{0,15}\b(shots?|injections?|dose|doses)\b", I),
    ("states a weight-loss number", rf"\b{LOSS_VERB}\b[^.?!]{{0,20}}\b{NUM}\s?{WEIGHT_UNIT}(?!\w)", I),
    ("medical claim or endorsement",
     r"\bheal(s|ing)?\b|\bfda[- ]?(approved|cleared)\b|\blowers?\s+(your\s+)?(blood|cholesterol|a1c|insulin)"
     r"|\b(recommended|approved|endorsed|trusted)\s+by\s+(doctors?|physicians?|dietitians?|nutritionists?|nurses?|experts?)\b"
     r"|\bdoctor[- ]recommended\b", I),
]
CAUTION = [
    ("states a number that needs proof", rf"\b\d+(\.\d+)?\+?\s?{WEIGHT_UNIT}(?!\w)", I),
    ("promises results by a date", rf"\bin (just |only )?{NUM} (days?|weeks?|months?)\b", I),
]


def is_health_brief(intake: dict) -> bool:
    """Health-related if the business or an interest group names a condition or medication, or there's a
    healthCondition constraint: the same signal gtm-intake uses to require its health locks."""
    texts = [str((intake.get("business") or {}).get("description", ""))]
    texts += [str(g.get("researchDefinition", "")) for g in intake.get("interests") or [] if isinstance(g, dict)]
    if any(isinstance(c, dict) and c.get("dimension") == "healthCondition" for c in intake.get("constraints") or []):
        return True
    return any(re.search(CONDITION_TERMS, t, I) for t in texts)


def check_copy(text: str, competitors: list[str] | None = None, health: bool = True) -> tuple[str, list[str]]:
    """Return ("ok" | "caution" | "block", reasons) for one message's visible text."""
    plain = text.replace("’", "'").replace("‘", "'")
    rules = [(why, p, I) for why, p in MESSAGING_BANNED.items() if health or why not in HEALTH_ONLY]
    rules += ALWAYS_BLOCK + (HEALTH_BLOCK if health else [])
    reasons = [why for why, pattern, flags in rules if re.search(pattern, plain, flags)]
    level = "block" if reasons else "ok"
    cautions = [why for why, pattern, flags in CAUTION if re.search(pattern, plain, flags)]
    reasons += cautions
    if cautions and level == "ok":
        level = "caution"
    for name in competitors or []:
        name = str(name).split(" (")[0].strip()
        if len(name) < 3 or not re.search(rf"(?<![\w]){re.escape(name)}(?![\w])", plain, I):
            continue
        # A distinctive name (MyFitnessPal, Lose It!, two words) is blocked in any case. A single plain word
        # ("Strong", "Noom") may be an ordinary word, so it's only flagged for a person to check.
        distinctive = " " in name or re.search(r"[^A-Za-z]", name) or re.search(r"[A-Z]", name[1:])
        reasons.append(f"names a competitor ({name})" if distinctive else f"may name a competitor ({name}); check it")
        if distinctive:
            level = "block"  # no competitor names in generated copy (CLAUDE.md)
        elif level == "ok":
            level = "caution"
    return level, reasons


def dedupe_key(headline: str) -> str:
    """Headlines that differ only in case, quotes, punctuation or spacing count as the same."""
    text = headline.replace("’", "'").lower()
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]+", " ", text)).strip()


def words(text: str) -> int:
    return len(re.findall(r"[\w'’-]+", text))
