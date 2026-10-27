"""Cost: the up-front estimate (expected and worst case) and the actual spend from each reply's usage.

Prices for claude-haiku-5-5, prompts up to 100K tokens: $0.10 / $0.50 per million input / output tokens
(Anthropic price table as of 2026-10-25; re-check when the model or prices change). Text tokens are
estimated from characters on the generous side; image tokens use the API's own patch formula.
"""
from __future__ import annotations

import json
import math

from prompts import MAX_TOKENS

INPUT_USD_PER_MTOK = 0.10
OUTPUT_USD_PER_MTOK = 0.50
CACHE_WRITE_FACTOR = 1.25        # only if the API ever reports cache writes; this step doesn't ask for caching
CHARS_PER_TOKEN = 3.0            # roughly break-even for this tokenizer; INPUT_SAFETY covers a low guess
EXPECTED_OUTPUT_TOKENS = 1000    # adaptive thinking at low effort plus a short JSON answer
REQUEST_OVERHEAD_TOKENS = 50
INPUT_SAFETY = 2.0               # the spend cap reserves twice the estimated input, so it holds even if we guess low
ATTEMPTS = 2                     # a call may be sent twice (one retry), and a lost attempt may still be billed


def input_tokens(body: dict, image_tokens: dict[str, int]) -> int:
    """Estimate one request's input tokens. image_tokens maps each image's base64 data to its visual tokens."""
    text_chars = len(body.get("system", "")) + len(json.dumps(body["output_config"]["format"]["schema"]))
    visual = 0
    for message in body.get("messages", []):
        for block in message.get("content", []):
            if block.get("type") == "image":
                visual += image_tokens[block["source"]["data"]]
            else:
                text_chars += len(block.get("text", ""))
    return int(text_chars / CHARS_PER_TOKEN) + visual + REQUEST_OVERHEAD_TOKENS


def usd(input_toks: float, output_toks: float) -> float:
    return (input_toks * INPUT_USD_PER_MTOK + output_toks * OUTPUT_USD_PER_MTOK) / 1_000_000


def worst_usd(body: dict, image_tokens: dict[str, int]) -> float:
    """One call's ceiling: both attempts, each at twice the estimated input and every output token
    max_tokens allows. Every settlement stays within it, so in-flight calls can't push spend past the cap."""
    return ATTEMPTS * usd(INPUT_SAFETY * input_tokens(body, image_tokens), MAX_TOKENS)


def estimate(bodies: list[dict], image_tokens: dict[str, int]) -> dict:
    """Expected: ~1,000 output tokens a call. Worst case: the sum of every call's ceiling."""
    inputs = sum(input_tokens(b, image_tokens) for b in bodies)
    return {"calls": len(bodies), "inputTokens": inputs,
            "expectedUsd": round(usd(inputs, EXPECTED_OUTPUT_TOKENS * len(bodies)), 4),
            "worstCaseUsd": sum(worst_usd(b, image_tokens) for b in bodies)}  # unrounded: caps compare with it


def cents_up(usd_amount: float) -> float:
    """Round a ceiling UP to the cent for display, so a cap typed from it always covers it."""
    return math.ceil(usd_amount * 100) / 100


def actual_usd(usage: dict) -> float:
    """From a reply's usage block. Cache reads are priced as full input (an upper bound)."""
    def count(key: str) -> int:
        value = usage.get(key)
        return value if isinstance(value, int) and value > 0 else 0

    inputs = (count("input_tokens") + count("cache_read_input_tokens")
              + CACHE_WRITE_FACTOR * count("cache_creation_input_tokens"))
    return usd(inputs, count("output_tokens"))
