"""The ways of building a simulated person, and the prompts they see.

- vanilla: no persona. What you get by asking Claude straight.
- invented: Claude invents the person's demographics first (LLM-sampled).
- demographics: the real twin's 14 demographic answers, set by code
  (programmatic, the sampling approach GTMagic chose over LLM-invented people).
- voice: demographics, plus the twin's spending-habit answers and their own
  words describing themselves (GTMagic's "talks like real quotes").
- gtmagic: the twin as a GTMagic SyntheticCustomer (customer group, core
  attributes, real quotes) on GTMagic's customer card; no demographics.
  See gtmagic.py.

All arms answer the same questions; only the "About you" section differs.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .data import SPENDING_QIDS, Dataset, Question, Respondent, self_description
from .tasks import experiment_questions, pricing_questions, render_question

ARMS = ["vanilla", "invented", "demographics", "voice", "gtmagic"]
PROMPT_VERSION = "twin-eval-1"

SYSTEM_INTRO = """You are taking part in an online survey of US adults. Answer every question the way the person described in the user message would actually answer: their honest first reaction, not the correct or ideal answer. There are no right or wrong answers.

For a multiple-choice question, answer with the option number. For a number question, answer with a number.

Return one entry in "answers" for every question, using the ID in square brackets as "id"."""

INVENT_SYSTEM = """Invent one adult living in the United States who is taking an online survey. Choose each attribute the way a real, randomly chosen survey taker might answer it."""

VANILLA_CARD = "A randomly selected adult living in the United States. Nothing else is known about them."

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "string"}, "value": {"type": "number"}},
                "required": ["id", "value"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["answers"],
    "additionalProperties": False,
}


def system_prompt(ds: Dataset) -> str:
    """Identical for every call, so it is cached once and reused."""
    pricing = "\n\n".join(render_question(q) for q in pricing_questions(ds))
    return f"{SYSTEM_INTRO}\n\n## Part 2: shopping (asked of everyone)\n\n{pricing}"


def _attributes(pairs: List[tuple]) -> str:
    return "\n".join(f"- {question} {answer}" for question, answer in pairs)


def persona_card(arm: str, ds: Dataset, r: Respondent, invented: Dict[str, str], cards=None) -> Optional[str]:
    if arm == "gtmagic":
        return cards.card(r.pid) if cards else None
    if arm == "vanilla":
        return VANILLA_CARD
    if arm == "invented":
        pairs = [(q.text, invented[q.column]) for q in ds.demographic_questions if q.column in invented]
        return _attributes(pairs)
    card = _attributes(r.demographics)
    if arm == "demographics":
        return card
    if arm == "voice":
        spending = [(ds.questions[c].text, r.wave1_3[c]) for c in SPENDING_QIDS if r.wave1_3.get(c)]
        parts = [card, _attributes(spending)]
        words = self_description(r)
        if words:
            parts.append(f'In their own words, the kind of person they actually are:\n"{words}"')
        return "\n".join(p for p in parts if p)
    raise ValueError(f"unknown arm {arm}")


def user_prompt(card: str, questions: List[Question]) -> str:
    part1 = "\n\n".join(render_question(q) for q in questions)
    return (
        f"## About you\n\n{card}\n\n"
        f"## Part 1\n\n{part1}\n\n"
        "Answer every question in Part 1 and Part 2."
    )


def questions_for(ds: Dataset, r: Respondent) -> List[Question]:
    """Everything this person is asked: their framing versions, then pricing."""
    return experiment_questions(ds, r) + pricing_questions(ds)


def invent_schema(ds: Dataset) -> dict:
    props = {
        q.column: {"type": "string", "enum": q.options, "description": q.text}
        for q in ds.demographic_questions
    }
    return {
        "type": "object",
        "properties": props,
        "required": list(props),
        "additionalProperties": False,
    }
