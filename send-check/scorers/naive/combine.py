"""Merge the three layers into one Scorecard, following rubric.md.

The pipeline works with whichever layers are available: without an API key
or if the judge fails, personalization and recipient_fit fall back to
script-only estimates and the Scorecard says so in notes.
"""
from __future__ import annotations

import os
import re

from scorers.base import DimensionScore, Draft, Recipient, Scorecard, verdict_from_score
from scorers.naive import mechanical, slop, voice

WEIGHTS = {"slop": 0.25, "personalization": 0.30, "recipient_fit": 0.30, "mechanics": 0.15}
STYLE_CHECKS = {"em_dash", "uniform_paragraphs", "three_bullets",
                "uniform_sentences", "no_contractions"}
MAX_IF_CAPPED = 74
MISMATCH_FIT = 30           # recipient_fit below this is the rubric's "mismatched" band
MAX_IF_MISMATCHED = 44
MAX_IF_DISQUALIFIED = 30    # docs/humanization-rubric.md caps at 12 of 28
# Stakes tiers from docs/humanization-rubric.md, Part 1
TIER = {"cold": "cold", "follow_up": "cold"}                 # everything else: client
SEND_LINE = {"cold": 82, "client": 75}                       # 23 of 28, 21 of 28
TEMPLATE_TELL_ALLOWANCE = {"cold": 1, "client": 2}
STRUCTURE_TELLS = {"uniform_paragraphs", "uniform_sentences", "three_bullets"}
# Plain-language names for disqualifying tells, for the one-line reason
DISQUALIFIER_LABEL = {
    "B9": "Unfilled merge field", "P20a": "Leftover AI assistant text",
    "P21": "AI cutoff disclaimer", "B8": "Fake \"Re:\" on a first message",
    "B16": "Markdown symbols will show in the email",
    "B11": "Flattery is the only personal touch",
    "B12": "An \"I noticed\" claim with nothing checkable",
    "B24": "No concrete details at all", "B25": "Nothing a competitor couldn't send",
}


class NaiveBackend:
    name = "naive"

    def score(self, draft: Draft, recipient: Recipient, message_type: str = "cold",
              owner_samples: list[str] | None = None, audience: str = "person",
              sender: dict | None = None) -> Scorecard:
        """audience is "person" (one recipient) or "segment" (a group on a send
        list, see scorers/segments.py). sender is the sender's saved profile:
        name, company, signature, and facts about their business."""
        try:
            return _score(draft, recipient, message_type, owner_samples or [], audience,
                          sender or {})
        except Exception as e:  # contract: never raise from score()
            return Scorecard(verdict="fix", score=0, dimensions=[], backend=self.name,
                             notes=f"scoring failed: {e}")


def _score(draft: Draft, recipient: Recipient, message_type: str,
           owner_samples: list[str], audience: str, sender: dict) -> Scorecard:
    context = " ".join(p for p in (recipient.role, recipient.context) if p)
    mech = mechanical.check(draft.text, message_type=message_type, recipient_context=context,
                            recipient_name=recipient.name, recipient_company=recipient.company)
    if audience == "segment":
        # One draft goes to every segment, so it cannot echo each segment's
        # facts word for word; the judge decides whether it fits the facts.
        mech["findings"] = [f for f in mech["findings"] if f["check"] != "personalization"]
    disqualifying, reminders = mechanical.disqualifiers(
        draft.text, draft.subject, message_type,
        merge_fields_ok=audience == "segment" or message_type == "customer")
    if sender and not _signed(draft.text, sender):
        reminders.append("not signed with your saved signature; add it before sending (suggested fixes include it)")
    sl = slop.check(draft.text)
    vc = voice.compare(draft.text, owner_samples) if owner_samples else None

    caps = [f["detail"] for f in mech["findings"] if f["cap"]]
    if sl["generic_opener"]:
        opener = next(m["phrase"] for m in sl["matches"] if m["in_opener"] and m["words"] >= 3)
        caps.append(f'opens with a generic phrase: "{opener}"')

    notes = []
    judgment = None
    if os.environ.get("SENDCHECK_JUDGE", "on") != "off":
        try:
            from scorers.naive.judge import judge
            judgment = judge({
                "draft": {"subject": draft.subject, "text": draft.text, "channel": draft.channel},
                "message_type": message_type,
                "audience": audience,
                "recipient": {"name": recipient.name, "role": recipient.role,
                              "company": recipient.company, "context": recipient.context},
                "script_results": {"mechanical": mech, "slop": sl, "voice": vc, "caps": caps,
                                   "disqualifying": disqualifying},
                "owner_samples": owner_samples,
                "sender": sender or None,
            })
        except Exception as e:
            reason = ("no Claude API key found; add ANTHROPIC_API_KEY to .env"
                      if "authentication" in str(e).lower() else f"judge unavailable ({e})")
            notes.append(f"{reason}; personalization and fit are script estimates")
    else:
        notes.append("judge turned off; personalization and fit are script estimates")

    # slop: phrase score minus style tells, averaged with voice when measured
    style = [f for f in mech["findings"] if f["check"] in STYLE_CHECKS]
    slop_score = max(0, sl["score"] - sum(f["points"] for f in style))
    slop_evidence = [f'"{m["phrase"]}"' for m in sl["matches"]] + [f["detail"] for f in style]
    if vc:
        v = judgment.voice_adjusted if judgment and judgment.voice_adjusted is not None else vc["score"]
        slop_score = round(0.5 * slop_score + 0.5 * v)
        slop_evidence += vc["differences"]

    other = [f for f in mech["findings"]
             if f["check"] not in STYLE_CHECKS and f["check"] != "personalization"]
    mechanics_score = max(0, 100 - sum(f["points"] for f in other))

    if judgment:
        pers, fit = judgment.personalization, judgment.recipient_fit
        personalization = DimensionScore("personalization", _clamp(pers.score),
                                         pers.evidence, pers.suggestion)
        recipient_fit = DimensionScore("recipient_fit", _clamp(fit.score),
                                       fit.evidence, fit.suggestion)
    else:
        found = mech["recipient_terms_found"]
        if audience == "segment":
            personalization = DimensionScore("personalization", 50,
                                             ["segment fit not measured without the judge"])
        else:
            personalization = DimensionScore(
                "personalization", 60 if found else (30 if context else 50),
                [f"recipient details used: {', '.join(found)}"] if found
                else ["no recipient details found in the draft"])
        recipient_fit = DimensionScore("recipient_fit", 50, ["not measured without the judge"])

    dimensions = [
        DimensionScore("slop", _clamp(slop_score), slop_evidence,
                       "cut the quoted phrases and say it the way you would out loud"
                       if slop_evidence else ""),
        personalization,
        recipient_fit,
        DimensionScore("mechanics", mechanics_score, [f["detail"] for f in other]),
    ]
    overall = round(sum(WEIGHTS[d.name] * d.score for d in dimensions))

    if judgment and judgment.over_personalized:
        caps.append("over-personal: " + "; ".join(judgment.over_personalization_evidence))
    if caps:
        overall = min(overall, MAX_IF_CAPPED)
        notes.append("blocks send: " + "; ".join(caps))
    if judgment and recipient_fit.score < MISMATCH_FIT:
        overall = min(overall, MAX_IF_MISMATCHED)
        notes.append("wrong for this reader: the offer or framing does not fit their facts")

    # Humanization rubric: disqualifying tells, template-tell allowance, pass line
    tier = TIER.get(message_type, "client")
    if judgment and audience == "person":
        disqualifying += [{"id": t.id, "tell": t.reason, "span": t.span}
                          for t in judgment.disqualifying]
    if disqualifying:
        overall = min(overall, MAX_IF_DISQUALIFIED)
        notes.append("disqualified: " + "; ".join(
            f'{d["id"]} {d["tell"]}' + (f' ("{d["span"]}")' if d["span"] else "")
            for d in disqualifying))
    template_tells = (sum(m["words"] >= 2 for m in sl["matches"])
                      + sum(f["check"] in STRUCTURE_TELLS for f in mech["findings"]))
    if template_tells > TEMPLATE_TELL_ALLOWANCE[tier]:
        overall = min(overall, MAX_IF_CAPPED)
        notes.append(f"blocks send: {template_tells} template tells; a {tier} message "
                     f"allows {TEMPLATE_TELL_ALLOWANCE[tier]}")
    if verdict_from_score(overall) == "send" and overall < SEND_LINE[tier]:
        overall = min(overall, MAX_IF_CAPPED)
        notes.append(f"blocks send: cold outreach needs {SEND_LINE[tier]}+ to send")
    notes += reminders

    verdict = verdict_from_score(overall)
    fix = judgment.suggested_fix if judgment and verdict == "fix" else ""
    if fix and sender.get("signature"):
        fix = _with_signature(fix, sender["signature"])
    if judgment and verdict == "scrap" and judgment.missing:
        notes.append(f"what it needs: {judgment.missing}")

    notes.insert(0, "reason: " + _reason(verdict, disqualifying, judgment, recipient_fit,
                                          caps, sl, other))
    return Scorecard(verdict=verdict, score=overall, dimensions=dimensions,
                     suggested_fix=fix, backend="naive", notes=" | ".join(notes))


def _reason(verdict, disqualifying, judgment, recipient_fit, caps, sl, other) -> str:
    """One plain line, shown right under the score: why this verdict."""
    if disqualifying:
        d = disqualifying[0]
        label = DISQUALIFIER_LABEL.get(d["id"], d["tell"])
        return f'{label}: "{d["span"]}"' if d["span"] else label
    if verdict == "send":
        return (judgment.headline_strength if judgment and judgment.headline_strength
                else "Specific, clear, and right for this reader")
    if judgment and recipient_fit.score < MISMATCH_FIT:
        return judgment.headline_problem or "Wrong offer or framing for this reader"
    if judgment and judgment.headline_problem:
        return judgment.headline_problem
    if caps:
        return caps[0][0].upper() + caps[0][1:]
    if sl["matches"]:
        return f'Reads like a template: "{sl["matches"][0]["phrase"]}"'
    return other[0]["detail"].capitalize() if other else "Needs a closer fit to the reader"


def _signed(text: str, sender: dict) -> bool:
    """Whether the draft's closing lines carry the sender's name or signature."""
    tail = " ".join(text.strip().splitlines()[-5:]).lower()
    marks = [sender.get("name", "").split(" ")[0], sender.get("company", "")]
    return any(len(m.strip()) > 1 and m.strip().lower() in tail for m in marks)


def _with_signature(fix: str, signature: str) -> str:
    """Make sure a suggested fix ends with the sender's exact signature."""
    if " ".join(signature.split()) in " ".join(fix.split()):
        return fix
    lines = fix.rstrip().splitlines()
    while lines and re.fullmatch(r"\s*\[[^\]]+\]\s*", lines[-1]):   # e.g. [Your Name]
        lines.pop()
    return "\n".join(lines).rstrip() + "\n\n" + signature.strip()


def _clamp(n: int) -> int:
    return max(0, min(100, int(n)))
