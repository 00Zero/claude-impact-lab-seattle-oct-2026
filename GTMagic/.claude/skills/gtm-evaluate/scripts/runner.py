"""Make the planned calls, survive the ones that fail, and record one line per call as it lands.

A call ends answered or skipped (refusal, timeout, api-error, invalid-output, budget, aborted); one skipped
call never stops the run. Two things do: a 4xx that will fail every call the same way (a bad request, a bad
key, an image too large), and an unexpected error in this code. Then no further calls are sent, the rest are
recorded as "aborted", and the run still writes and seals its files. Calls are admitted in the given (seeded) order: each reserves its worst-case cost
before it's sent, and when the cap can't cover the next call, the runner waits for calls in flight to
settle and tries again. So the calls a spend cap cuts are always the tail of the seeded order, never a
thread-scheduling accident. Actual spend comes from each reply's usage.
"""
from __future__ import annotations

import threading
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from typing import Callable

import cost
import drafts
from claude_client import CallFailed, Reply, redact
from design import Call
from prompts import PROMPT_VERSION, labels_for

RATING_ROLES = ("persona", "repeat", "crowd")


class Ledger:
    """Spend tracking against the cap. Each admitted call holds its own worst case until it settles, so a
    cap equal to the sum of every call's worst case never cuts a call."""

    def __init__(self, max_usd: float | None, worst_usd: dict[str, float]) -> None:
        self.max_usd = max_usd
        self.worst = worst_usd    # call id → that call's ceiling
        self.spent = 0.0
        self.held = 0.0
        self._lock = threading.Lock()

    def reserve(self, call_id: str) -> bool:
        with self._lock:
            if self.max_usd is not None and self.spent + self.held + self.worst[call_id] > self.max_usd:
                return False
            self.held += self.worst[call_id]
            return True

    def settle(self, call_id: str, usd: float) -> None:
        with self._lock:
            self.held -= self.worst[call_id]
            self.spent += usd



def record_for(call: Call, segment_of: dict[str, str]) -> dict:
    return {"callId": call.id, "role": call.role, "personaId": call.persona_id or None,
            "segmentId": segment_of.get(call.persona_id) if call.persona_id else None,
            "orderingIndex": call.ordering_index, "reversedOrder": call.reversed_order,
            "labelMap": call.label_map(), "promptVersion": PROMPT_VERSION}


def outcome(role: str, label_map: dict[str, str], stop_reason: str, text: str) -> dict:
    """status/skipReason/draft/result from a reply. Pure, so `verify` re-derives every record the same way."""
    labels = labels_for(len(label_map))
    if stop_reason == "refusal":
        return {"status": "skipped", "skipReason": "refusal"}
    if stop_reason == "max_tokens":
        return {"status": "skipped", "skipReason": "invalid-output", "detail": "reply was cut off"}
    try:
        if role in RATING_ROLES:
            draft = drafts.parse_rating(text, labels)
            return {"status": "answered", "draft": draft, "result": drafts.map_rating(draft, label_map)}
        draft = drafts.parse_ranking(text, labels)
        return {"status": "answered", "draft": draft, "result": drafts.map_ranking(draft, label_map)}
    except drafts.InvalidDraft as err:
        return {"status": "skipped", "skipReason": "invalid-output", "detail": str(err)}


def settle(record: dict, call: Call, reply: Reply) -> dict:
    record = {**record, "model": reply.model, "stopReason": reply.stop_reason, "rawText": reply.text,
              "usage": reply.usage, "latencyMs": reply.latency_ms, "costUsd": round(cost.actual_usd(reply.usage), 6)}
    return {**record, **outcome(call.role, call.label_map(), reply.stop_reason, reply.text)}


def run_calls(calls: list[Call], send: Callable[[Call], Reply], segment_of: dict[str, str], ledger: Ledger,
              on_record: Callable[[dict], None], workers: int = 1) -> tuple[list[dict], str | None]:
    """(records, why the run stopped early or None). send(call) returns a Reply or raises CallFailed;
    on_record runs under a lock as each record lands. With one worker, calls run strictly in order."""
    lock = threading.Lock()
    records: list[dict] = []
    stop = threading.Event()
    why: list[str] = []

    def abort(reason: str) -> None:
        with lock:
            if not why:
                why.append(reason)
        stop.set()

    def finish(record: dict) -> None:
        with lock:
            records.append(record)
            try:
                on_record(record)  # crash insurance only: the caller rewrites the file from `records` at the end
            except Exception as err:
                record["stoppedRun"] = True  # the in-memory record (rewritten to the file later) says why
                why.append(f"couldn't record {record['callId']}: {type(err).__name__}: {err}")
                stop.set()

    def work(call: Call, record: dict) -> None:
        spent = 0.0
        if stop.is_set():  # queued before the stop: don't send it
            ledger.settle(call.id, 0.0)
            finish({**record, "status": "skipped", "skipReason": "aborted", "detail": why[0]})
            return
        try:
            reply = send(call)
            lost_attempt = ledger.worst[call.id] / cost.ATTEMPTS if reply.earlier_attempt_unknown else 0.0
            spent = cost.actual_usd(reply.usage) + lost_attempt  # a lost first attempt may have been billed
            record = settle(record, call, reply)
        except CallFailed as err:
            spent = ledger.worst[call.id] if err.maybe_billed else 0.0  # no usage came back: assume the worst
            record = {**record, "status": "skipped", "skipReason": err.reason, "detail": str(err)}
            if err.fatal:
                record["stoppedRun"] = True
                abort(f"{call.id}: {err}")
        except Exception as err:  # a bug here must not lose a paid run: record it, stop, still seal
            record = {**record, "status": "skipped", "skipReason": "client-error", "stoppedRun": True,
                      "detail": redact(f"{type(err).__name__}: {err}")}
            abort(f"{call.id}: {record['detail']}")
        finally:
            ledger.settle(call.id, spent)
        finish(record)

    futures: list[Future] = []
    pending: set = set()
    capped = False
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        for call in calls:
            record = record_for(call, segment_of)
            reserved = False
            while not stop.is_set() and not capped:
                if ledger.reserve(call.id):
                    reserved = True
                    break
                if not pending:
                    capped = True  # nothing in flight and still no room: the cap is reached for good
                    break
                _, pending = wait(pending, return_when=FIRST_COMPLETED)
            if stop.is_set():  # an abort outranks the cap, even one that landed while we waited
                if reserved:
                    ledger.settle(call.id, 0.0)
                finish({**record, "status": "skipped", "skipReason": "aborted", "detail": why[0]})
                continue
            if capped:
                finish({**record, "status": "skipped", "skipReason": "budget", "detail": "spend cap reached"})
                continue
            future = pool.submit(work, call, record)
            futures.append(future)
            pending.add(future)
    for future in futures:
        future.result()
    return records, (why[0] if why else None)
