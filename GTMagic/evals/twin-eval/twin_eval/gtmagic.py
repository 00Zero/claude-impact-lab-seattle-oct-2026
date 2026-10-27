"""Twins in GTMagic's own shapes, so the eval tests the customer card the product uses.

The GTMagic simulation skill reads intake.json `segments[]` (sampleShare,
attributes, needs, barriers, decisionCriteria) and `lexicon` (voice), and
builds `SyntheticCustomer`s (docs/CONTRACTS.md): six core attributes,
needs/barriers/criteria, and 3-5 real quotes. It carries no demographics.

Each twin becomes one such customer:
- segment: household income band (three segments), the closest thing Twin has
  to a research-defined customer group.
- role: employment, marital status and household size (a "life role").
- priceSensitivity: from the tightwad-spendthrift scale (1-4 high, 5-7 medium, 8-11 low).
- currentSolution, urgency, skepticism, buyingStage: not in Twin; left out
  (SyntheticCustomer.attributes is Partial).
- voice: up to 5 sentences of 3-25 words, verbatim from the twin's own
  self-description, held as lexicon entries backed by evidence excerpts,
  the same rules intake uses for real quotes.

`export_audience` writes audience-sample.json plus a twin-intake.json with only
the fields the simulation skill reads, so Nick's simulation can run these
exact twins through its own sampler-free path and card renderer.
"""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from .data import SELF_DESCRIPTION_COL, Dataset, Respondent

INCOME_QID, EMPLOYMENT_QID, MARITAL_QID, HOUSEHOLD_QID, SPENDING_QID = "QID21", "QID24", "QID17", "QID23", "QID31"
SAMPLER_VERSION = "twin-eval-gtmagic-1"
SEGMENTS = [
    ("seg_1", "Lower-income households", "US adults with household income under $50,000.",
     {"Less than $30,000", "$30,000-$50,000"}),
    ("seg_2", "Middle-income households", "US adults with household income of $50,000 to $100,000.",
     {"$50,000-$75,000", "$75,000-$100,000"}),
    ("seg_3", "Higher-income households", "US adults with household income of $100,000 or more.",
     {"$100,000 or more"}),
]


def _segment_id(r: Respondent) -> Optional[str]:
    income = r.wave1_3.get(INCOME_QID, "")
    return next((sid for sid, _, _, bands in SEGMENTS if income in bands), None)


def _price_sensitivity(r: Respondent) -> Optional[str]:
    m = re.search(r"(\d+)\s*$", r.wave1_3.get(SPENDING_QID, ""))
    if not m:
        return None
    point = int(m.group(1))
    return "high" if point <= 4 else ("medium" if point <= 7 else "low")


def _role(r: Respondent) -> Optional[str]:
    parts = [r.wave1_3.get(EMPLOYMENT_QID), r.wave1_3.get(MARITAL_QID)]
    household = r.wave1_3.get(HOUSEHOLD_QID)
    if household:
        parts.append("lives alone" if household == "1" else f"household of {household.lower()}")
    parts = [p for p in parts if p]
    return "; ".join(parts) if parts else None


def voice_phrases(r: Respondent, limit: int = 5) -> List[str]:
    text = " ".join((r.wave1_3.get(SELF_DESCRIPTION_COL) or "").split())
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        words = sentence.split()
        if 3 <= len(words) <= 25:
            out.append(sentence)
        if len(out) == limit:
            break
    return out


def build(ds: Dataset, pids: List[str]) -> dict:
    """GTMagic-shaped files for these twins: customers, segments, lexicon, evidence, pid map."""
    customers, lexicon, evidence, twin_map = [], [], [], {}
    counts: Dict[str, int] = {}
    for n, pid in enumerate(pids, start=1):
        r = ds.respondents[pid]
        seg = _segment_id(r)
        if seg is None:
            continue
        cid = f"cust_r1_{n}"
        attrs = {k: v for k, v in (("role", _role(r)), ("priceSensitivity", _price_sensitivity(r))) if v}
        lex_ids = []
        for phrase in voice_phrases(r):
            ev_id, lex_id = f"ev_{len(evidence) + 1}", f"lex_{len(lexicon) + 1}"
            evidence.append({"id": ev_id, "origin": "owner-file", "sourceType": "survey",
                             "title": "Twin-2K-500 self-description", "excerpt": phrase,
                             "segmentIds": [seg], "concernIds": [], "confidence": "high",
                             "limitations": "One survey taker's own words.", "retrievedAt": "2025-05-23"})
            # The twin is the customer, so their own words are customer voice (the only voice the simulation reads).
            lexicon.append({"id": lex_id, "phrase": phrase, "segmentIds": [seg], "evidenceId": ev_id, "voice": "customer"})
            lex_ids.append(lex_id)
        customers.append({"id": cid, "segmentId": seg, "attributes": attrs, "needs": [], "barriers": [],
                          "decisionCriteria": [], "voiceLexiconIds": lex_ids})
        counts[seg] = counts.get(seg, 0) + 1
        twin_map[cid] = pid
    segments = [{"id": sid, "name": name, "description": desc, "isOwnerGuess": False,
                 "sampleShare": counts.get(sid, 0) / max(1, len(customers)),
                 "attributes": [], "needs": [], "barriers": [], "decisionCriteria": [], "channels": [],
                 "concernBundles": []}
                for sid, name, desc, _ in SEGMENTS]
    return {"customers": customers, "segments": segments, "lexicon": lexicon,
            "evidence": evidence, "twinMap": twin_map}


def default_render_card(customer: dict, intake: dict) -> str:
    """Customer card in the layout ARCHITECTURE.md describes: group, attributes, needs, voice."""
    seg = next(s for s in intake["segments"] if s["id"] == customer["segmentId"])
    phrases = {lx["id"]: lx["phrase"] for lx in intake["lexicon"]}
    lines = [f"Customer group: {seg['name']}. {seg['description']}"]
    labels = {"role": "Role", "currentSolution": "Current solution", "priceSensitivity": "Price sensitivity",
              "urgency": "Urgency", "skepticism": "Skepticism", "buyingStage": "Buying stage"}
    lines += [f"{labels.get(k, k)}: {v}" for k, v in customer["attributes"].items()]
    for field, label in (("needs", "Needs"), ("barriers", "Barriers"), ("decisionCriteria", "Decides on")):
        if customer[field]:
            lines.append(f"{label}: " + "; ".join(customer[field]))
    quotes = [phrases[i] for i in customer["voiceLexiconIds"] if i in phrases]
    if quotes:
        lines.append("Talks like this (their own words):")
        lines += [f'- "{q}"' for q in quotes]
    return "\n".join(lines)


def load_card_renderer(path: Optional[Path]) -> Callable[[dict, dict], str]:
    """A teammate's renderer: a .py file defining render_card(customer, intake) -> str."""
    if path is None:
        return default_render_card
    spec = importlib.util.spec_from_file_location("gtmagic_card", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"can't load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fn = getattr(module, "render_card", None)
    if not callable(fn):
        raise SystemExit(f"{path} must define render_card(customer, intake) -> str")
    return fn


class Cards:
    """Built once per run; looks up a twin's GTMagic card by pid."""

    def __init__(self, ds: Dataset, pids: List[str], renderer: Callable[[dict, dict], str]):
        self.files = build(ds, pids)
        self.by_pid = {pid: cid for cid, pid in self.files["twinMap"].items()}
        self.customers = {c["id"]: c for c in self.files["customers"]}
        self.renderer = renderer

    def card(self, pid: str) -> Optional[str]:
        cid = self.by_pid.get(pid)
        return None if cid is None else self.renderer(self.customers[cid], self.files)


def export_audience(ds: Dataset, pids: List[str], seed: int, out: Path) -> Tuple[Path, Path, Path]:
    files = build(ds, pids)
    out.mkdir(parents=True, exist_ok=True)
    note = "Twin-2K-500 survey takers, one customer per real person, for the twin-eval realism check. Not a business's audience."
    audience = {"schemaVersion": 1, "_note": note,
                "config": {"sampleSize": len(files["customers"]), "seed": seed, "strategy": "representative"},
                "samplerVersion": SAMPLER_VERSION, "role": "holdout", "customers": files["customers"]}
    intake = {"schemaVersion": 1, "mode": "demo", "_note": note,
              "segments": files["segments"], "lexicon": files["lexicon"], "evidence": files["evidence"],
              "constraints": []}
    paths = (out / "audience-sample.json", out / "twin-intake.json", out / "twin-map.json")
    paths[0].write_text(json.dumps(audience, indent=2))
    paths[1].write_text(json.dumps(intake, indent=2))
    paths[2].write_text(json.dumps(files["twinMap"], indent=2))
    return paths
