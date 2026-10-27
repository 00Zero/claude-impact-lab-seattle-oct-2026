"""Checks every option the writer returns: kept, or dropped with a plain reason. Nothing is rewritten.

The copy rules are gtm-message-test's copy_checks (which carries gtm-intake's messaging list), loaded from
the sibling skill, so a draft that passes here also passes that skill's build_test.py. Every field is
cleaned first (type-guarded, Unicode-normalized), and the cleaned values are what's checked and shipped.
"""
from __future__ import annotations

import importlib.util
import os
import re
import unicodedata
from dataclasses import dataclass, field

from brief import numbers

# Loaded by path (not via sys.path) so the sibling's other modules can never shadow this skill's own.
COPY_CHECKS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                           "gtm-message-test", "scripts", "copy_checks.py")
try:
    _spec = importlib.util.spec_from_file_location("gtm_message_test_copy_checks", COPY_CHECKS)
    _copy_checks = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
    _spec.loader.exec_module(_copy_checks)  # type: ignore[union-attr]
except (OSError, AttributeError) as err:  # a missing sibling is a setup problem, not a crash
    raise SystemExit(f"ERROR gtm-creatives needs gtm-message-test installed alongside it ({COPY_CHECKS}): {err}")
check_copy, dedupe_key, is_health_brief = _copy_checks.check_copy, _copy_checks.dedupe_key, _copy_checks.is_health_brief
norm, uses_phrase, words = _copy_checks.norm, _copy_checks.uses_phrase, _copy_checks.words

MAX_HEADLINE_WORDS = 10      # gtm-message-test's limits, so drafts fit its test as they are
MAX_SUBHEADLINE_WORDS = 30
MAX_CTA_WORDS = 5
MAX_CHARS = {"headline": 90, "subheadline": 240, "callToAction": 40}   # hyphen-chains count as one word
OVERLAP_WORDS = 6            # RESEARCH.md §8: 6+ consecutive words shared with a real quote is copying it
STRING_FIELDS = ("angle", "targetSegmentId", "headline", "subheadline", "callToAction",
                 "valueProposition", "differentiator", "whyItMightWork")
I = re.IGNORECASE
# Testimonial framing: copy that speaks as a customer, or tells a made-up person's story (principles 1, 4 and
# 12 pull a writer toward "a retired nurse who…"). Customer phrases count too: "I'm barely eating as it is"
# in an ad reads as a customer talking, so the writer turns them into second person.
FIRST_PERSON = re.compile(r"\b(i|i'm|i've|i'd|i'll|me|my|mine|myself)\b", I)
THIRD_PERSON = re.compile(r"\b(she|he|her|hers|herself|him|his|himself)\b", I)
QUOTES = re.compile(r"[\"“”„‟«»‹›「」『』〝〞″‘‚]")   # not ’: it's GPT's usual apostrophe
# Additions to copy_checks for generated copy only (the owner's own lines are never checked here).
ALWAYS_BLOCK = [("states a statistic the owner didn't give",
                 re.compile(r"\b(hundreds|thousands|millions|dozens) of\b|\bpercent\b", I))]
HEALTH_BLOCK = [("promises a body result",
                 re.compile(r"\bmetaboli|\bfat[- ]?burn|\bburns? (belly |body )?fat\b|\bmelts? (away )?fat\b"
                            r"|\bfor good\b|\bpermanent(ly)?\b|\bdetox", I))]
CAUTION = [("makes an offer (free, a trial, cancelling) the owner must confirm",
            re.compile(r"\bfree\b|\btrials?\b|\bcancel any ?time\b|\bmoney[- ]back\b|\bno commitment\b", I)),
           ("uses a number word; the owner must confirm it's true",
            re.compile(r"\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty"
                       r"|hundred|dozen|twice|double|triple|half)\b", I))]


@dataclass
class Context:
    """Everything the checks need from intake.json, computed once by code."""
    seg_ids: set[str]
    phrases: dict[str, str]              # customer-voice lexicon id -> phrase
    lexicon_evidence: dict[str, str]     # lexicon id -> its evidence id (citations come from code, not the writer)
    excerpt_grams: set[tuple[str, ...]]  # every 6-word run in any evidence excerpt
    phrase_grams: set[tuple[str, ...]]   # every 6-word run inside a customer phrase's own words (allowed, even
                                         # when the copy rewords the rest of the phrase)
    allowed_numbers: set[str]
    excluded: list[str]                  # the owner's "never say" values
    competitors: list[str]
    health: bool
    seen: set[str] = field(default_factory=set)   # dedupe keys of owner, brief and already-kept headlines


@dataclass
class Checked:
    option: dict                         # the cleaned option: what was checked is what ships
    kept: bool
    reasons: list[str]                   # why it was dropped (empty when kept)
    notes: list[str]                     # cautions on a kept option
    copies_quote: bool = False           # shares 6+ words with a real quote, whatever else dropped it


def clean_text(value: object) -> str:
    """NFKC (fullwidth letters and digits, superscripts), format characters (zero-width spaces) removed,
    whitespace collapsed. A line break is kept as one, so the shape check can drop it."""
    if not isinstance(value, str):
        return ""
    value = "".join(ch for ch in unicodedata.normalize("NFKC", value) if unicodedata.category(ch) != "Cf")
    lines = [" ".join(line.split()) for line in re.split(r"[\r\n  \x0b\x0c\x85]+", value.strip())]
    return "\n".join(line for line in lines if line)


def clean_option(raw: object) -> dict:
    """The writer's option with every field the right type, whatever the reply held."""
    o = raw if isinstance(raw, dict) else {}
    out: dict = {k: clean_text(o.get(k)) for k in STRING_FIELDS}
    ids, principles, claims = o.get("lexiconIds"), o.get("principlesUsed"), o.get("assumptions")
    out["lexiconIds"] = list(dict.fromkeys(x for x in ids if isinstance(x, str))) if isinstance(ids, list) else []
    out["principlesUsed"] = sorted({n for n in principles if type(n) is int}) if isinstance(principles, list) else []
    claims = [claims] if isinstance(claims, str) else claims if isinstance(claims, list) else []
    out["assumptions"] = [c for c in (clean_text(x) for x in claims) if c and "\n" not in c][:6]
    return out


def tokens(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", norm(value))


def grams(value: str, n: int = OVERLAP_WORDS) -> set[tuple[str, ...]]:
    t = tokens(value)
    return {tuple(t[i:i + n]) for i in range(len(t) - n + 1)}


def contains(value: str, term: str) -> bool:
    return bool(term) and re.search(rf"(?<!\w){re.escape(norm(term))}(?!\w)", norm(value)) is not None


def shape_problem(o: dict) -> str | None:
    head, sub, cta = o["headline"], o["subheadline"], o["callToAction"]
    if not head or not sub or not cta:
        return "missing a headline, the line under it, or the button"
    if any("\n" in o[k] for k in MAX_CHARS):
        return "has a line break inside it"
    if any(len(o[k]) > n for k, n in MAX_CHARS.items()):
        return "too long to show as an ad"
    if words(head) > MAX_HEADLINE_WORDS:
        return f"headline is over {MAX_HEADLINE_WORDS} words"
    if words(sub) > MAX_SUBHEADLINE_WORDS:
        return f"the line under the headline is over {MAX_SUBHEADLINE_WORDS} words"
    if words(cta) > MAX_CTA_WORDS:
        return f"the button is over {MAX_CTA_WORDS} words"
    return None


def check_option(raw: object, ctx: Context) -> Checked:
    """One option from the writer. Kept options' headlines join ctx.seen, so later duplicates drop."""
    o = clean_option(raw)
    head, sub, cta = o["headline"], o["subheadline"], o["callToAction"]
    cited = [x for x in o["lexiconIds"] if x in ctx.phrases]
    visible, all_copy = f"{head} {sub}", f"{head} {sub} {cta}"
    level, rule_reasons = check_copy(visible, ctx.competitors, ctx.health)
    cta_level, cta_reasons = check_copy(cta, ctx.competitors, ctx.health)
    blocks = [why for why, rx in ALWAYS_BLOCK + (HEALTH_BLOCK if ctx.health else []) if rx.search(all_copy)]
    cautions = [why for why, rx in CAUTION if rx.search(all_copy)]
    used = [x for x in cited if uses_phrase(visible, ctx.phrases[x])]   # only phrases really used unlock numbers
    phrase_numbers = set().union(*(numbers(ctx.phrases[x]) for x in used))
    stray = sorted(numbers(all_copy) - ctx.allowed_numbers - phrase_numbers)
    copied = bool(({g for k in ("headline", "subheadline", "callToAction") for g in grams(o[k])}
                   & ctx.excerpt_grams) - ctx.phrase_grams)
    excluded = [t for t in ctx.excluded if contains(all_copy, t)]

    problem = (
        shape_problem(o)
        or ("not written for a customer group in the brief" if o["targetSegmentId"] not in ctx.seg_ids else None)
        or ("borrows no real customer phrase" if not cited else None)
        or ("the headline doesn't really use the customer phrase it cites"
            if not any(uses_phrase(head, ctx.phrases[x]) for x in cited) else None)
        or ("; ".join(rule_reasons) if level == "block" else None)
        or ("the button: " + "; ".join(cta_reasons) if cta_level == "block" else None)
        or ("; ".join(blocks) if blocks else None)
        or (f"says something the owner ruled out ({', '.join(excluded)})" if excluded else None)
        or ("copies a real customer's words too closely (6 or more words in a row from a quote)" if copied else None)
        or ("uses quotation marks, which reads like a testimonial" if QUOTES.search(all_copy) else None)
        or ("speaks as a customer (I, me, my), which reads like a testimonial" if FIRST_PERSON.search(visible) else None)
        or ("tells a made-up person's story (she, he, her, his), which reads like a testimonial"
            if THIRD_PERSON.search(visible) else None)
        or (f"uses a number the owner didn't give ({', '.join(stray)})" if stray else None)
        or ("same headline as one the owner already has, the brief's first ideas, or another draft"
            if dedupe_key(head) in ctx.seen else None)
    )
    if problem:
        return Checked(o, False, [problem], [], copied)
    ctx.seen.add(dedupe_key(head))
    notes = list(rule_reasons) + [f"the button: {r}" for r in cta_reasons] + cautions  # cautions; blocks dropped above
    for k in ("valueProposition", "differentiator"):  # not shown to customers, but a report may quote them
        notes += [f"{k}: {r}" for r in check_copy(o[k], ctx.competitors, ctx.health)[1]]
    return Checked(o, True, [], notes, copied)


def balance_warnings(kept: list[Checked], seg_ids: list[str]) -> list[str]:
    """Warnings, never drops: repeated angles and lopsided coverage of the customer groups."""
    angles: dict[str, int] = {}
    for c in kept:
        key = dedupe_key(c.option["angle"])
        angles[key] = angles.get(key, 0) + 1
    out = [f"{n} drafts share the angle '{a}'" for a, n in angles.items() if a and n > 1]
    counts = {sid: sum(1 for c in kept if c.option["targetSegmentId"] == sid) for sid in seg_ids}
    if len(seg_ids) > 1 and max(counts.values()) - min(counts.values()) > 1:
        spread = ", ".join(f"{n} for {sid}" for sid, n in counts.items())
        out.append(f"customer groups are unevenly covered ({spread}); the evaluation mostly reflects who the "
                   "drafts were written for")
    return out


def interleave(kept: list[Checked], seg_ids: list[str]) -> list[Checked]:
    """Round-robin across groups, writer's order within each, so the first few drafts (the ones a test
    uses before its spares) cover every group."""
    queues = {sid: [c for c in kept if c.option["targetSegmentId"] == sid] for sid in seg_ids}
    out: list[Checked] = []
    while any(queues.values()):
        for sid in seg_ids:
            if queues[sid]:
                out.append(queues[sid].pop(0))
    return out
