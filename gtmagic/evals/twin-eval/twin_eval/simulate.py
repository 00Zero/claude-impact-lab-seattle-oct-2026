"""Run each simulated person through the survey, one Claude call per person per arm.

Responses are appended to out/<run>/responses-<arm>.jsonl as they land, so an
interrupted run resumes without paying twice. A failed or refused call, or a
response that leaves most pricing questions unanswered, is recorded as skipped,
never patched into a made-up answer. Tokens billed for it still count.
"""
from __future__ import annotations

import json
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set

from .data import Dataset, Respondent
from .personas import (ANSWER_SCHEMA, INVENT_SYSTEM, PROMPT_VERSION, invent_schema,
                       persona_card, questions_for, system_prompt, user_prompt)
from .tasks import PRICING_COLUMNS, encode_model_value, experiment_questions

# $ per million tokens: input, output. Cache reads bill at 0.1x input, writes at 1.25x.
PRICES = {
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
}


Usage = Dict[str, int]
ZERO_USAGE: Usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}


class CallFailed(Exception):
    def __init__(self, reason: str, usage: Optional[Usage] = None):
        super().__init__(reason)
        self.reason = reason
        self.usage = usage   # tokens billed before it failed (refusal, max_tokens, bad JSON)


def _add_usage(a: Usage, b: Usage) -> Usage:
    return {k: a[k] + b.get(k, 0) for k in a}


class ClaudeClient:
    def __init__(self, model: str, effort: str):
        import anthropic  # only needed for live runs
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(max_retries=4)
        self.model = model
        self.effort = effort

    def json_call(self, system: str, user: str, schema: dict, cache_system: bool) -> tuple:
        system_block = {"type": "text", "text": system}
        if cache_system:
            system_block["cache_control"] = {"type": "ephemeral"}
        a = self.anthropic
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=16000,
                system=[system_block],
                messages=[{"role": "user", "content": user}],
                output_config={"effort": self.effort,
                               "format": {"type": "json_schema", "schema": schema}},
            )
        except a.BadRequestError as e:
            raise CallFailed(f"bad-request: {e.message}")
        except a.RateLimitError:
            raise CallFailed("rate-limited")
        except a.APIStatusError as e:
            raise CallFailed(f"api-error-{e.status_code}")
        except a.APIConnectionError:
            raise CallFailed("connection-error")
        u = response.usage   # read first: a refused or cut-off call is still billed
        usage = {
            "input": u.input_tokens,
            "output": u.output_tokens,
            "cache_read": u.cache_read_input_tokens or 0,
            "cache_write": u.cache_creation_input_tokens or 0,
        }
        if response.stop_reason == "refusal":
            raise CallFailed("refusal", usage)
        if response.stop_reason == "max_tokens":
            raise CallFailed("max-tokens", usage)
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            raise CallFailed("invalid-json", usage)
        return data, usage


class MockClient:
    """Uniformly random answers, for testing the pipeline without an API key. FAKE."""
    model = "mock"

    def __init__(self, ds: Dataset, seed: int):
        self.ds = ds
        self.seed = seed
        self._calls = 0
        self._lock = threading.Lock()

    def json_call(self, system: str, user: str, schema: dict, cache_system: bool) -> tuple:
        with self._lock:
            self._calls += 1
            rng = random.Random(f"{self.seed}|{self._calls}|{user}")
        zero = dict(ZERO_USAGE)
        if "answers" not in schema["properties"]:   # inventing a persona
            return {k: rng.choice(v["enum"]) for k, v in schema["properties"].items()}, zero
        answers = []
        for line in (user + "\n" + system).splitlines():
            if line.startswith("[") and "]" in line:
                q = self.ds.questions[line[1:line.index("]")]]
                value = rng.uniform(0, 100) if q.kind == "number" else rng.randint(1, len(q.options))
                answers.append({"id": q.column, "value": value})
        return {"answers": answers}, zero


def cost_usd(model: str, usage: Dict[str, int]) -> Optional[float]:
    if model not in PRICES:
        return None
    price_in, price_out = PRICES[model]
    return (usage["input"] * price_in + usage["cache_read"] * price_in * 0.1
            + usage["cache_write"] * price_in * 1.25 + usage["output"] * price_out) / 1e6


_WARNED: Set[Path] = set()   # files already reported as having unreadable lines


def read_records(path: Path) -> List[dict]:
    """Every saved record. A half-written line (a crash mid-write) is skipped, not fatal."""
    if not path.exists():
        return []
    records: List[dict] = []
    bad = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            rec = None
        if isinstance(rec, dict):
            records.append(rec)
        else:
            bad += 1
    if bad and path not in _WARNED:
        _WARNED.add(path)
        print(f"warning: skipped {bad} unreadable line(s) in {path}, likely half-written by an "
              "interrupted run; those people count as skipped until a resume re-runs them")
    return records


def answered_by_pid(records: List[dict]) -> Dict[str, dict]:
    return {rec["pid"]: rec for rec in records if rec.get("status") == "answered"}


def _read_done(path: Path) -> Dict[str, dict]:
    return answered_by_pid(read_records(path))


def _end_partial_line(path: Path) -> None:
    """Newline-terminate a half-written last line, so the next append doesn't fuse with it."""
    if path.exists() and path.stat().st_size:
        with path.open("rb+") as f:
            f.seek(-1, 2)
            if f.read(1) != b"\n":
                f.write(b"\n")


def _one(ds: Dataset, client, arm: str, r: Respondent, system: str, cards=None) -> dict:
    rec = {"pid": r.pid, "arm": arm, "model": client.model, "promptVersion": PROMPT_VERSION}
    usage_total = dict(ZERO_USAGE)
    try:
        invented: Dict[str, str] = {}
        if arm == "invented":
            invented, usage = client.json_call(INVENT_SYSTEM, "Describe the person.",
                                               invent_schema(ds), cache_system=False)
            usage_total = _add_usage(usage_total, usage)
            rec["invented"] = invented
        questions = questions_for(ds, r)
        card = persona_card(arm, ds, r, invented, cards)
        if card is None:
            raise CallFailed("no-card")
        prompt = user_prompt(card, experiment_questions(ds, r))
        data, usage = client.json_call(system, prompt,
                                       ANSWER_SCHEMA, cache_system=True)
        usage_total = _add_usage(usage_total, usage)
    except CallFailed as e:
        rec.update(status="skipped", skipReason=e.reason, usage=_add_usage(usage_total, e.usage or {}))
        return rec

    asked = {q.column: q for q in questions}
    answers: Dict[str, float] = {}
    invalid: List[str] = []
    for a in data.get("answers", []):
        q = asked.get(a.get("id"))
        if q is None or a.get("value") is None:
            continue
        value = encode_model_value(q, a["value"])
        if value is None:
            invalid.append(q.column)
        else:
            answers[q.column] = value
    rec.update(status="answered", answers=answers, invalid=invalid,
               missing=[c for c in asked if c not in answers and c not in invalid],
               usage=usage_total)
    # Scoring a response that skipped most pricing questions would grade a cherry-picked subset.
    pricing_asked = [c for c in asked if c in PRICING_COLUMNS]
    if 2 * sum(c in answers for c in pricing_asked) < len(pricing_asked):
        rec.update(status="skipped", skipReason="incomplete")   # answers kept for debugging
    return rec


def run_arm(ds: Dataset, client, arm: str, pids: List[str], out_dir: Path,
            concurrency: int, cards=None, progress: Callable[[str], None] = print) -> Dict[str, dict]:
    path = out_dir / f"responses-{arm}.jsonl"
    done = _read_done(path)
    _end_partial_line(path)
    todo = [pid for pid in pids if pid not in done]
    progress(f"[{arm}] {len(done)} already answered, {len(todo)} to run")
    system = system_prompt(ds)
    lock = threading.Lock()
    with ThreadPoolExecutor(max_workers=concurrency) as pool, path.open("a", encoding="utf-8") as f:
        futures = [pool.submit(_one, ds, client, arm, ds.respondents[pid], system, cards) for pid in todo]
        for i, fut in enumerate(as_completed(futures), start=1):
            rec = fut.result()
            with lock:
                f.write(json.dumps(rec) + "\n")
                f.flush()
            if rec["status"] == "answered":
                done[rec["pid"]] = rec
            if i % 25 == 0 or i == len(todo):
                progress(f"[{arm}] {i}/{len(todo)}")
    return {pid: done[pid] for pid in pids if pid in done}
