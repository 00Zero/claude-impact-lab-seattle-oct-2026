"""Every word gtm-evaluate sends to the model, the JSON schemas it answers in, and the request builder.

Bump PROMPT_VERSION whenever any text or schema here changes: run.json records it, and a pre-registered
run is only comparable with runs on the same version. Prompts name no business, show no results, and
tell no one which ad is the owner's favorite. Ads are blind labels; the label follows position.
"""
from __future__ import annotations

from design import LABELS, Call
from personas import Persona

PROMPT_VERSION = "evaluate-v1"
MODEL = "claude-haiku-5-5"
EFFORT = "low"       # set explicitly: Haiku 5.5 defaults to medium
MAX_TOKENS = 4000    # room for adaptive thinking plus a short JSON answer
CTA = "Learn More"

_STAY_HONEST = ("You're not a marketer and you don't owe anyone politeness. Most people scroll past most ads, "
                "so low ratings and picking none are normal answers. Judge only what each ad shows.")
SYSTEMS = {
    "persona": "Answer as the person described in the card: react the way they plausibly would, given their "
               "situation, needs, doubts and the way they talk. " + _STAY_HONEST,
    "crowd": "Answer as an ordinary person in the situation described, scrolling their feed. React the way a "
             "typical person plausibly would. " + _STAY_HONEST,
    "judge-brief": "You're an experienced reviewer of small-business ads. You'll see a set of ads that would run "
                   "as promoted posts, the situation people see them in, and the customer groups the business "
                   "wants to reach. Judge only what each ad shows.",
    "judge-plain": "You're an experienced reviewer of ads. You'll see a set of ads that would run as promoted "
                   "posts and the situation people see them in. Judge only what each ad shows.",
}
SYSTEMS["repeat"] = SYSTEMS["persona"]

# Plain words for the schema's attribute names: second person on the card, third person in the judge's brief.
CARD_LABELS = {"role": "Day to day", "currentSolution": "What you use now", "priceSensitivity": "How price-sensitive you are",
               "urgency": "How urgent this feels", "skepticism": "How skeptical you are of ads",
               "buyingStage": "Where you are in deciding"}
BRIEF_LABELS = {"role": "Day to day", "currentSolution": "What they use now", "priceSensitivity": "How price-sensitive they are",
                "urgency": "How urgent it feels", "skepticism": "How skeptical they are of ads",
                "buyingStage": "Where they are in deciding"}

RATING_TASK = (f'For each ad, rate how likely you would be to tap "{CTA}": 1 = I\'d scroll right past it, '
               "2 = probably not, 3 = maybe, 4 = probably, 5 = I'd very likely tap it. Then pick the one ad "
               f'you\'d be most likely to tap, or "none" if you wouldn\'t tap any of them. Add a one-line reason '
               "in your own words.")
RANKING_TASK = (f'Rank the {{k}} ads from most to least likely to get {{who}} to tap "{CTA}". Use every label '
                "exactly once. Add a one-line reason.")


def labels_for(k: int) -> list[str]:
    return list(LABELS[:k])


def rating_schema(labels: list[str]) -> dict:
    """Every label rated (integer; 1–5 is checked in code, since the API rejects minimum/maximum)."""
    return {"type": "object", "additionalProperties": False, "required": ["ratings", "pick", "reason"],
            "properties": {
                "ratings": {"type": "object", "additionalProperties": False, "required": labels,
                            "properties": {lab: {"type": "integer", "description": "1 to 5"} for lab in labels}},
                "pick": {"type": "string", "enum": labels + ["none"]},
                "reason": {"type": "string", "description": "one line"}}}


def ranking_schema(labels: list[str]) -> dict:
    return {"type": "object", "additionalProperties": False, "required": ["ranking", "reason"],
            "properties": {
                "ranking": {"type": "array", "items": {"type": "string", "enum": labels},
                            "description": "every label exactly once, most likely first"},
                "reason": {"type": "string", "description": "one line"}}}


def ad_blocks(call: Call, assets: dict) -> list[dict]:
    """Each ad as a promoted feed post. Images: the picture and the button, no headline. Headlines: text only."""
    blocks: list[dict] = []
    for label, asset_id in call.label_map().items():
        asset = assets[asset_id]
        head = f"Ad {label}: a promoted post (advertiser name hidden)."
        if asset.kind == "image":
            blocks.append({"type": "text", "text": f"{head} The image:"})
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": asset.media_type,
                                                       "data": asset.b64}})
            blocks.append({"type": "text", "text": f'Under the image: a "{CTA}" button.'})
        else:
            blocks.append({"type": "text", "text": f'{head}\nTitle: {asset.text}\nUnder the title: a "{CTA}" button.'})
    return blocks


def persona_card(p: Persona) -> str:
    lines = ["Who you are (one simulated customer):", f"- You're one of: {p.description}"]
    lines += [f"- {CARD_LABELS[name]}: {value}" for name, value in p.attributes.items()]
    for title, values in (("What you need", p.needs), ("What holds you back", p.barriers),
                          ("What you'd judge it on", p.criteria), ("On your mind lately", p.concerns)):
        if values:
            lines.append(f"- {title}: {'; '.join(values)}")
    if p.voice:
        lines.append("- Things people like you say: " + "; ".join(f'"{v}"' for v in p.voice))
    return "\n".join(lines)


def judge_brief(groups: list[dict]) -> str:
    """The brief-aware judge's view of who the business wants to reach (from personas.group_facts)."""
    blocks = []
    for i, g in enumerate(groups, 1):
        lines = [f"Customer group {i}: {g['description']}"]
        lines += [f"- {BRIEF_LABELS[name]}: {'; '.join(values)}" for name, values in g["attributes"].items()]
        for title, values in (("Needs", g["needs"]), ("What holds them back", g["barriers"]),
                              ("What they judge on", g["criteria"]), ("On their mind", g["concerns"])):
            if values:
                lines.append(f"- {title}: {'; '.join(values)}")
        if g["voice"]:
            lines.append("- Things real customers in this group say: " + "; ".join(f'"{v}"' for v in g["voice"]))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def build_request(call: Call, assets: dict, scenario: str, persona: Persona | None = None,
                  brief: str = "") -> dict:
    """One Messages API body. Ads (images first) come before the card and the task."""
    k = len(call.order)
    labels = labels_for(k)
    intro = (f"The situation: {scenario.strip()}\n\nYou see these {k} promoted posts in a Reddit-style feed, in "
             'this order. Each has a "Promoted" tag; the advertiser\'s name is hidden.')
    if call.role in ("persona", "repeat"):
        if persona is None:
            raise ValueError(f"{call.id}: a persona call needs its persona")
        tail, schema = f"{persona_card(persona)}\n\n{RATING_TASK}", rating_schema(labels)
    elif call.role == "crowd":
        tail, schema = RATING_TASK, rating_schema(labels)
    elif call.role == "judge-brief":
        tail = (f"The customer groups the business wants to reach:\n\n{brief}\n\n"
                + RANKING_TASK.format(k=k, who="people in these customer groups"))
        schema = ranking_schema(labels)
    elif call.role == "judge-plain":
        tail, schema = RANKING_TASK.format(k=k, who="people in this situation"), ranking_schema(labels)
    else:
        raise ValueError(f"unknown call role '{call.role}'")
    content = [{"type": "text", "text": intro}] + ad_blocks(call, assets) + [{"type": "text", "text": tail}]
    return {"model": MODEL, "max_tokens": MAX_TOKENS, "system": SYSTEMS[call.role],
            "messages": [{"role": "user", "content": content}],
            "output_config": {"effort": EFFORT, "format": {"type": "json_schema", "schema": schema}}}
