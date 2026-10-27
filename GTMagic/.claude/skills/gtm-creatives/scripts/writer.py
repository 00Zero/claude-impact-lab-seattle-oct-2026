"""The writer calls: the request, the cost ceiling, and at most two calls with the checks between them.

`chat` is any callable that takes a request body and returns a Reply (the OpenRouter client, the mock, or
a test double), so the loop runs the same way live, in the demo and in tests.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from typing import Callable, Optional

import prompts
from checks import Checked, Context, check_option
from openrouter_client import CallFailed, ModelPrice, Reply

MIN_KEPT = 6           # below this (or with a group left empty), call 2 asks for replacements
MAX_CALLS = 2
ATTEMPTS_PER_CALL = 2  # the client retries once; a retried attempt may still be billed, so the ceiling counts it
MAX_COMPLETION_TOKENS = 8000   # reasoning tokens count against this too
EFFORT = "medium"
BYTES_PER_TOKEN = 3    # UTF-8 bytes: English runs nearer 4 per token and CJK about 3, so this errs high
FRAMING_TOKENS = 300   # message roles and framing the byte count doesn't see
FEEDBACK_HEADLINE_CHARS = 120   # call 2 lists each earlier headline cut to this, with its reason cut to:
FEEDBACK_REASON_CHARS = 140

Chat = Callable[[dict], Optional[Reply]]   # None: no more replies (the mock fixture ran out)


@dataclass
class Outcome:
    checked: list[tuple[int, Checked]] = field(default_factory=list)   # (call number, result), in order
    calls: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    first_call_failed: bool = False


def request_body(model: str, system: str, user: str, schema: dict, seed: int, price: ModelPrice) -> dict:
    return {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_schema", "json_schema": {"name": "ad_drafts", "strict": True, "schema": schema}},
        "reasoning": {"effort": EFFORT},
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
        "seed": seed,
        "usage": {"include": True},
        # Only endpoints that honour every parameter, keep no prompts, and charge no more than the list price
        # the estimate used (some GPT Sol endpoints cost 6x more).
        "provider": {"require_parameters": True, "data_collection": "deny",
                     "max_price": {"prompt": price.prompt_per_million, "completion": price.completion_per_million}},
    }


def call2_bound(user: str, count: int) -> int:
    """The most bytes call 2's prompt can add over call 1's: every earlier option listed, each line capped."""
    per_line = 4 * (FEEDBACK_HEADLINE_CHARS + FEEDBACK_REASON_CHARS + 8)   # 4 bytes per character at worst
    return len(user.encode("utf-8")) + 600 + 2 * count * per_line


def worst_case_usd(price: ModelPrice, system: str, user_bytes: int, schema: dict) -> float:
    """Every attempt this run could make (calls x retries), at the capped price, every completion token used,
    rounded up."""
    prompt_bytes = len(system.encode("utf-8")) + user_bytes + len(json.dumps(schema).encode("utf-8"))
    prompt_tokens = prompt_bytes / BYTES_PER_TOKEN + FRAMING_TOKENS
    per_attempt = (prompt_tokens * price.prompt_per_million + MAX_COMPLETION_TOKENS * price.completion_per_million) / 1e6
    return math.ceil(MAX_CALLS * ATTEMPTS_PER_CALL * per_attempt * 10_000) / 10_000


def parse_options(reply: Reply) -> list | None:
    """The writer's options, or None when the reply isn't the JSON the schema asked for."""
    try:
        value = json.loads(reply.text)
    except (TypeError, ValueError):
        return None
    options = value.get("options") if isinstance(value, dict) else None
    return options if isinstance(options, list) else None


def shortfall(per_group: dict[str, int], kept: list[Checked]) -> dict[str, int]:
    """How many more each group needs to reach its share."""
    have = {sid: sum(1 for c in kept if c.option["targetSegmentId"] == sid) for sid in per_group}
    return {sid: max(0, n - have[sid]) for sid, n in per_group.items()}


def feedback(checked: list[tuple[int, Checked]]) -> list[tuple[str, str]]:
    """Dropped headlines and their reasons for call 2, capped in length. A draft that copied a real quote is
    withheld whatever else dropped it, so call 2 never carries evidence text."""
    out = []
    for _, c in checked:
        if c.kept:
            continue
        head = "(withheld: it copied a customer quote)" if c.copies_quote else c.option["headline"] or "(no headline)"
        out.append((head[:FEEDBACK_HEADLINE_CHARS], c.reasons[0][:FEEDBACK_REASON_CHARS]))
    return out


def save_raw(out: str, n: int, content: str) -> None:
    """The writer's reply as it came, for audit (and for re-recording the demo fixture)."""
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    with open(os.path.join(out, "raw", f"call-{n}.json"), "w", encoding="utf-8") as f:
        f.write(content)


def take(options: list, ask: dict[str, int], ctx: Context, n: int, result: Outcome) -> None:
    """Check at most what was asked for each group; ignore the rest, so the handoff stays within --count."""
    taken = dict.fromkeys(ask, 0)
    ignored = 0
    for raw in options[:4 * max(1, sum(ask.values()))]:   # a runaway reply is bounded too
        sid = raw.get("targetSegmentId") if isinstance(raw, dict) else None
        if isinstance(sid, str) and sid in taken:
            if taken[sid] >= ask[sid]:
                ignored += 1
                continue
            taken[sid] += 1
        result.checked.append((n, check_option(raw, ctx)))
    ignored += max(0, len(options) - 4 * max(1, sum(ask.values())))
    if ignored:
        result.warnings.append(f"The writer sent {ignored} more option(s) than asked for in call {n}; they were ignored.")


def run_calls(p: dict, ctx: Context, chat: Chat, model: str, seed: int, price: ModelPrice, out: str, now) -> Outcome:  # noqa: ANN001
    result = Outcome()
    ask, user = dict(p["per_group"]), p["user"]
    for n in range(1, MAX_CALLS + 1):
        try:
            reply = chat(request_body(model, p["system"], user, p["schema"], seed, price))
        except CallFailed as err:
            result.calls.append({"call": n, "at": now(), "outcome": "failed", "detail": str(err),
                                 "maybeBilled": err.maybe_billed})
            result.warnings.append(f"Call {n} to the writer failed: {err}")
            result.first_call_failed = n == 1
            break
        if reply is None:
            break
        options = parse_options(reply)
        save_raw(out, n, reply.text)
        usage = reply.usage
        result.calls.append({"call": n, "at": now(), "outcome": "ok" if options is not None else "unparsed",
                             "generationId": reply.generation_id, "servedModel": reply.model,
                             "finishReason": reply.finish_reason, "promptTokens": usage.get("prompt_tokens"),
                             "completionTokens": usage.get("completion_tokens"), "costUsd": usage.get("cost"),
                             "earlierAttemptUnknown": reply.earlier_attempt_unknown, "latencyMs": reply.latency_ms,
                             "options": len(options or [])})
        if reply.finish_reason == "length":
            result.warnings.append(f"The writer ran out of room in call {n} (thinking can use up its budget), "
                                   "so some drafts may be missing.")
        take(options or [], ask, ctx, n, result)
        kept = [c for _, c in result.checked if c.kept]
        ask = shortfall(p["per_group"], kept)
        completion = usage.get("completion_tokens")
        if isinstance(completion, int) and completion > MAX_COMPLETION_TOKENS:
            result.warnings.append("The writer used more output than the cap allows, so the cost ceiling can't be "
                                   "trusted; no second call was made.")
            break
        empty_group = any(ask[sid] == p["per_group"][sid] and p["per_group"][sid] for sid in ask)
        if not sum(ask.values()) or (len(kept) >= MIN_KEPT and not empty_group):
            break
        user = prompts.replacement_call(p["brief"], ask, [c.option["headline"] for c in kept], feedback(result.checked))
    return result
