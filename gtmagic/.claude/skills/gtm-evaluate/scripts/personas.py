"""Seeded persona draws from the brief, and the brief text the brief-aware judge reads.

Blindness is enforced here by an allow-list: prompts are built ONLY from the segment fields below and
customer-voice lexicon phrases. Ad results (priorExperiments, creatives' performance), findings, the
owner's own copy and everything else in intake.json never reach a prompt. Draws are correlated outputs
of one model, not people: nothing here calls them respondents.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from design import rng, shuffled, weighted_choice

CORE_ATTRIBUTES = ("role", "currentSolution", "priceSensitivity", "urgency", "skepticism", "buyingStage")
PER_LIST = 2            # needs, barriers and decision criteria shown per draw
VOICE_MIN, VOICE_MAX = 3, 4


@dataclass
class Persona:
    id: str
    segment_id: str
    description: str
    attributes: dict[str, str] = field(default_factory=dict)
    needs: list[str] = field(default_factory=list)
    barriers: list[str] = field(default_factory=list)
    criteria: list[str] = field(default_factory=list)
    concerns: list[str] = field(default_factory=list)   # "label: definition"
    voice: list[str] = field(default_factory=list)      # real customer phrases (lexicon voice "customer")

    def to_json(self) -> dict:
        return {"id": self.id, "segmentId": self.segment_id, "description": self.description,
                "attributes": self.attributes, "needs": self.needs, "barriers": self.barriers,
                "decisionCriteria": self.criteria, "concerns": self.concerns, "voice": self.voice}


def strings(values: object) -> list[str]:
    return [str(v).strip() for v in values if str(v).strip()] if isinstance(values, list) else []


def customer_phrases(brief: dict, segment_id: str) -> list[str]:
    """Only voice "customer" entries: the owner's own wording must never pose as a customer."""
    return [str(lex["phrase"]) for lex in brief.get("lexicon") or []
            if lex.get("voice") == "customer" and segment_id in (lex.get("segmentIds") or []) and lex.get("phrase")]


def concern_texts(brief: dict, concern_ids: list[str]) -> list[str]:
    by_id = {c.get("id"): c for c in brief.get("concerns") or []}
    return [f"{by_id[c].get('label', c)}: {by_id[c].get('definition', '')}".strip(": ")
            for c in concern_ids if c in by_id]


def pick_segments(brief: dict) -> list[dict]:
    """Every customer group in the brief; each needs a unique id."""
    segments = [s for s in brief.get("segments") or [] if isinstance(s, dict) and s.get("id")]
    ids = [s["id"] for s in segments]
    if len(set(ids)) < len(ids):
        raise ValueError("the brief has two customer groups with the same id")
    if not segments:
        raise ValueError("the brief has no customer groups to draw from")
    return segments


def counts_per_segment(segments: list[dict], n: int, seed: int) -> dict[str, int]:
    """Balanced: equal n per segment; any remainder goes one each to segments in a seeded order."""
    ids = [s["id"] for s in segments]
    counts = {sid: n // len(ids) for sid in ids}
    for sid in shuffled(ids, rng(seed, "segment-remainder"))[: n % len(ids)]:
        counts[sid] += 1
    return counts


def draw_one(brief: dict, segment: dict, pid: str, seed: int) -> Persona:
    r = rng(seed, f"persona:{pid}")
    attributes: dict[str, str] = {}
    by_name = {a.get("name"): a for a in segment.get("attributes") or []}
    for name in CORE_ATTRIBUTES:
        values = [v for v in (by_name.get(name) or {}).get("values") or [] if v.get("value")]
        if values:
            chosen = weighted_choice(values, [float(v.get("weight") or 0) for v in values], r)
            attributes[name] = str(chosen["value"])
    bundles = [b for b in segment.get("concernBundles") or [] if b.get("concernIds")]
    concerns = []
    if bundles:
        bundle = weighted_choice(bundles, [float(b.get("weight") or 0) for b in bundles], r)
        concerns = concern_texts(brief, list(bundle["concernIds"]))
    phrases = customer_phrases(brief, segment["id"])
    return Persona(id=pid, segment_id=segment["id"], description=str(segment.get("description") or ""),
                   attributes=attributes,
                   needs=shuffled(strings(segment.get("needs")), r)[:PER_LIST],
                   barriers=shuffled(strings(segment.get("barriers")), r)[:PER_LIST],
                   criteria=shuffled(strings(segment.get("decisionCriteria")), r)[:PER_LIST],
                   concerns=concerns,
                   voice=shuffled(phrases, r)[:VOICE_MAX])


def draw_personas(brief: dict, n: int, seed: int) -> tuple[list[Persona], list[str]]:
    """N draws, balanced across segments, enumerated segment by segment in brief order."""
    segments = pick_segments(brief)
    counts = counts_per_segment(segments, n, seed)
    warnings: list[str] = []
    personas: list[Persona] = []
    for segment in segments:
        sid = segment["id"]
        missing = [a for a in CORE_ATTRIBUTES if a not in {x.get("name") for x in segment.get("attributes") or []}]
        if missing:
            warnings.append(f"customer group {sid} has no {', '.join(missing)}; draws leave them out")
        if len(customer_phrases(brief, sid)) < VOICE_MIN:
            warnings.append(f"customer group {sid} has fewer than {VOICE_MIN} real customer phrases; "
                            "its simulated draws have little customer voice to go on")
        for _ in range(counts[sid]):
            personas.append(draw_one(brief, segment, f"p_{len(personas) + 1:03d}", seed))
    return personas, warnings


def group_facts(brief: dict) -> list[dict]:
    """What the brief-aware judge reads: the same allow-listed fields the draws come from, per group.
    (prompts.py turns it into words, so the judge's wording is versioned with the other prompts.)"""
    groups = []
    for segment in pick_segments(brief):
        options = {a["name"]: [str(v.get("value")) for v in a.get("values") or [] if v.get("value")]
                   for a in segment.get("attributes") or [] if a.get("name") in CORE_ATTRIBUTES}
        concern_ids = sorted({c for b in segment.get("concernBundles") or [] for c in b.get("concernIds") or []})
        groups.append({"description": str(segment.get("description") or ""),
                       "attributes": {name: options[name] for name in CORE_ATTRIBUTES if options.get(name)},
                       "needs": strings(segment.get("needs")), "barriers": strings(segment.get("barriers")),
                       "criteria": strings(segment.get("decisionCriteria")),
                       "concerns": concern_texts(brief, concern_ids), "voice": customer_phrases(brief, segment["id"])})
    return groups
