"""What the simulated people are asked, and how answers become numbers.

Two task families, both scored against the real person's wave-4 answer:

- Pricing: 40 grocery products at a fixed price, "would you buy it?" Everyone
  answered all 40. Closest thing in the dataset to purchase intent.
- Framing experiments: the same decision worded two or three ways, each
  person saw one version (between-subject). The difference between versions
  is a real human wording effect, which is what a message test relies on.
  Each simulated person gets exactly the version their real twin saw.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from .data import Dataset, Question, Respondent

PRICING_COLUMNS = [f"QID9_{i}" for i in range(1, 41)]
PRICING_YES = "Yes, I would purchase the product"


@dataclass(frozen=True)
class Condition:
    label: str
    columns: List[str]     # asked in this order
    score_column: str      # the answer that is compared


@dataclass(frozen=True)
class Experiment:
    key: str
    title: str
    conditions: List[Condition]
    stat: str = "mean"     # "mean" or "median"; median for long-tailed number answers
    meaning: str = ""      # what a higher score means, for the report


EXPERIMENTS: List[Experiment] = [
    Experiment("disease_framing", "Lives saved vs. lives lost framing", [
        Condition("saved (gain)", ["QID157"], "QID157"),
        Condition("die (loss)", ["QID158"], "QID158"),
    ], meaning="higher = favors the risky program B"),
    Experiment("savings_framing", "$10 off a $30 calculator vs. a $250 jacket", [
        Condition("$30 calculator", ["QID183"], "QID183"),
        Condition("$250 jacket", ["QID184"], "QID184"),
    ], meaning="higher = share who would NOT drive for the $10"),
    Experiment("anchor_africa", "Anchor of 12 vs. 65 African UN countries", [
        Condition("low anchor 12", ["QID163", "QID164_TEXT"], "QID164_TEXT"),
        Condition("high anchor 65", ["QID165", "QID166_TEXT"], "QID166_TEXT"),
    ], stat="median", meaning="median estimate"),
    Experiment("anchor_redwood", "Anchor of 85 ft vs. 1,000 ft redwood", [
        Condition("low anchor 85", ["QID167", "QID168_TEXT"], "QID168_TEXT"),
        Condition("high anchor 1000", ["QID169", "QID170_TEXT"], "QID170_TEXT"),
    ], stat="median", meaning="median estimate in feet"),
    Experiment("sunk_cost", "Prepaid discount card vs. none", [
        Condition("no card", ["QID181_TEXT"], "QID181_TEXT"),
        Condition("paid $50 card", ["QID182_TEXT"], "QID182_TEXT"),
    ], meaning="purchases from the nearby store, of 20"),
    Experiment("outcome_bias", "Same decision, operation succeeded vs. failed", [
        Condition("succeeded", ["QID161"], "QID161"),
        Condition("failed", ["QID162"], "QID162"),
    ], meaning="higher = rates the decision as better"),
    Experiment("less_is_more", "Gamble with nothing vs. a small loss", [
        Condition("win $9 or nothing", ["QID171"], "QID171"),
        Condition("or lose 5 cents", ["QID172"], "QID172"),
        Condition("or lose 25 cents", ["QID173"], "QID173"),
    ], meaning="higher = finds the gamble more attractive"),
    Experiment("proportion_1", "Fire extinguisher saves 150 people vs. 98% / 95% of 150", [
        Condition("150 people", ["QID174"], "QID174"),
        Condition("98% of 150", ["QID175"], "QID175"),
        Condition("95% of 150", ["QID176"], "QID176"),
    ], meaning="higher = more supportive"),
    Experiment("proportion_2", "Seatbelt saves 500 drivers vs. 98% / 95% of 500", [
        Condition("500 drivers", ["QID177"], "QID177"),
        Condition("98% of 500", ["QID178"], "QID178"),
        Condition("95% of 500", ["QID179"], "QID179"),
    ], meaning="higher = more likely to buy it"),
    Experiment("wtp_wta", "Pay to avoid a risk vs. be paid to accept it", [
        Condition("pay, risk to zero", ["QID189"], "QID189"),
        Condition("be paid to accept", ["QID190"], "QID190"),
        Condition("pay, 4 to 3 in 1,000", ["QID191"], "QID191"),
    ], meaning="higher = larger dollar amount"),
    Experiment("allais", "Allais paradox, form 1 vs. form 2", [
        Condition("form 1", ["QID192"], "QID192"),
        Condition("form 2", ["QID193"], "QID193"),
    ], meaning="higher = share taking the riskier option"),
    Experiment("myside", "Ban a dangerous Ford in Germany vs. a German car in the US", [
        Condition("Ford in Germany", ["QID194"], "QID194"),
        Condition("German car in US", ["QID195"], "QID195"),
    ], meaning="higher = more in favor of a ban"),
    Experiment("base_rate", "30 vs. 70 engineers out of 100", [
        Condition("30 engineers", ["QID154"], "QID154"),
        Condition("70 engineers", ["QID156"], "QID156"),
    ], meaning="mean probability Jack is an engineer"),
]


def experiment_columns() -> List[str]:
    return [c.score_column for e in EXPERIMENTS for c in e.conditions]


def condition_for(r: Respondent, experiment: Experiment) -> Optional[Condition]:
    """The version this person saw in wave 4 (same as in waves 1-3)."""
    for cond in experiment.conditions:
        if r.wave4.get(cond.score_column):
            return cond
    return None


def experiment_questions(ds: Dataset, r: Respondent) -> List[Question]:
    out: List[Question] = []
    for experiment in EXPERIMENTS:
        cond = condition_for(r, experiment)
        if cond:
            out.extend(ds.questions[c] for c in cond.columns)
    return out


def pricing_questions(ds: Dataset) -> List[Question]:
    return [ds.questions[c] for c in PRICING_COLUMNS]


def render_question(q: Question) -> str:
    lines = [f"[{q.column}] {q.text}"]
    if q.kind == "choice":
        lines += [f"  {i}. {opt}" for i, opt in enumerate(q.options, start=1)]
    else:
        lines.append("  (answer with a number)")
    return "\n".join(lines)


def _norm(s: str) -> str:
    return " ".join(s.replace("’", "'").split()).lower()


def encode_label(q: Question, label: str) -> Optional[float]:
    """A human's label answer as a number: option index (0-based) or the number typed."""
    label = (label or "").strip()
    if not label:
        return None
    if q.kind == "number":
        try:
            return float(label.replace(",", ""))
        except ValueError:
            return None
    target = _norm(label)
    for i, opt in enumerate(q.options):
        if _norm(opt) == target:
            return float(i)
    return None


def encode_model_value(q: Question, value: float) -> Optional[float]:
    """The model's answer (1-based option number, or a number) on the same scale."""
    if q.kind == "number":
        return float(value)
    index = int(round(value)) - 1
    if abs(value - round(value)) > 1e-9 or not 0 <= index < len(q.options):
        return None
    return float(index)
