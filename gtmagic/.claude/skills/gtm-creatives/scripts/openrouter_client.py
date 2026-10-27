"""The only place gtm-creatives talks to OpenRouter (which forwards the writer's prompt to GPT Sol).

Standard library only (urllib), like the other skills' scripts. The key comes from the environment or the
macOS Keychain, is read through a pipe, and is never printed, logged, cached or put on a command line.
Every error message passes a redactor. A call either returns a Reply or raises CallFailed with a plain
reason.
"""
from __future__ import annotations

import getpass
import http.client
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

API_URL = "https://openrouter.ai/api/v1"
KEY_ENV = "GTMAGIC_OPENROUTER_API_KEY"  # deliberately not OPENROUTER_API_KEY: never bill a stray shell key
KEYCHAIN_SERVICE = "gtmagic-openrouter"  # where the onboarding key-setup script stores it
# Sampling knobs reasoning models reject, and tools this step must never use (web search, code).
FORBIDDEN_KEYS = {"temperature", "top_p", "top_k", "tools", "tool_choice", "plugins", "web_search_options"}
RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504, 529}
MAX_RETRY_WAIT_S = 30.0
TIMEOUT_S = 180.0
KEY_PATTERN = re.compile(r"sk-or-[A-Za-z0-9_\-]+")
PER_MILLION = 1_000_000


class CallFailed(Exception):
    """One call failed for good (after its retry). maybe_billed: an attempt got no readable answer, so
    OpenRouter may still have charged for it, and the run's total cost is unknown."""

    def __init__(self, detail: str, maybe_billed: bool = False) -> None:
        super().__init__(redact(detail))
        self.maybe_billed = maybe_billed


class SetupError(Exception):
    """The run can't start (no key, model missing or unable to return structured output). Shown as-is."""


@dataclass
class Reply:
    text: str                      # message content; structured output arrives here as a JSON string
    finish_reason: str
    generation_id: str             # OpenRouter's id: lets a human audit the run against their activity log
    model: str
    usage: dict = field(default_factory=dict)   # prompt_tokens, completion_tokens, cost (USD)
    latency_ms: int = 0
    earlier_attempt_unknown: bool = False   # a first attempt got no readable answer; it may have been billed


@dataclass
class ModelPrice:
    model: str
    prompt_per_million: float      # USD
    completion_per_million: float  # USD


def redact(text: str) -> str:
    return KEY_PATTERN.sub("[key removed]", str(text))


def checked_key(key: str, where: str) -> str:
    """Only a well-formed key goes on to an HTTP header: a stray newline would make http.client raise an
    error that prints the header, key and all."""
    if not KEY_PATTERN.fullmatch(key):
        raise SetupError(f"The OpenRouter key in {where} doesn't look like one (sk-or-…, one line); store it again.")
    return key


def load_key() -> str:
    """Env var first, then the Keychain. Read through a pipe: the key is never on argv or in output."""
    key = os.environ.get(KEY_ENV, "").strip()
    if key:
        return checked_key(key, KEY_ENV)
    try:
        found = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE,
                                "-a", getpass.getuser(), "-w"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        found = None
    if found is not None and found.returncode == 0 and found.stdout.strip():
        return checked_key(found.stdout.strip(), f"the Keychain item '{KEYCHAIN_SERVICE}'")
    raise SetupError(f"No OpenRouter key found. Run the GTMagic key setup script from the README, or set {KEY_ENV}. "
                     f"On macOS it can live in the Keychain as service '{KEYCHAIN_SERVICE}' for your user "
                     f"(`security add-generic-password -s {KEYCHAIN_SERVICE} -a \"$USER\" -w`, then paste the key "
                     "at the prompt, so it never lands in shell history).")


def assert_request_shape(body: dict) -> None:
    """Fail loudly before sending anything this step must never send."""
    bad = sorted(FORBIDDEN_KEYS & set(body))
    if bad:
        raise ValueError(f"request must not carry {bad}")
    if not (body.get("reasoning") or {}).get("effort"):
        raise ValueError("request must set reasoning.effort explicitly")
    provider = body.get("provider") or {}
    if provider.get("data_collection") != "deny" or not provider.get("require_parameters") or not provider.get("max_price"):
        raise ValueError("request must deny data collection, require its parameters and cap the price")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect: urllib would carry the Authorization header to the new host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001 (urllib's signature)
        return None


class OpenRouterClient:
    """Thin HTTP client. `opener` is injectable so tests never touch the network."""

    def __init__(self, key: str, opener=None, sleep=time.sleep) -> None:
        self._key = key
        self._open = opener or urllib.request.build_opener(_NoRedirect()).open
        self._sleep = sleep

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict, dict | None]:
        """(status, headers, payload); payload is None when the body isn't a JSON object."""
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(f"{API_URL}{path}", data=data, method=method, headers={
            "Authorization": f"Bearer {self._key}", "Content-Type": "application/json",
            "X-Title": "GTMagic gtm-creatives"})
        try:
            with self._open(req, timeout=TIMEOUT_S) as resp:
                return resp.status, dict(resp.headers), _json_object(resp.read())
        except urllib.error.HTTPError as err:
            try:
                payload = _json_object(err.read())
            except OSError:
                payload = None
            finally:
                err.close()
            return err.code, dict(err.headers or {}), payload

    def _with_retry(self, method: str, path: str, body: dict | None = None, valid=None) -> tuple[dict, int, bool]:
        """One retry on rate limits, overload, server errors, network failures and unreadable 2xx replies;
        then CallFailed. A 4xx outside RETRY_STATUSES fails at once. The bool says an earlier attempt got
        no readable answer (so it may have been billed)."""
        last, status, unknown = "", 0, False
        for attempt in (1, 2):
            started = time.monotonic()
            try:
                status, headers, payload = self._request(method, path, body)
            except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as err:
                status, headers, payload, last = 0, {}, None, f"network error: {type(err).__name__}: {err}"
            except ValueError as err:  # e.g. a header http.client won't send; its message may hold the key
                raise CallFailed(f"the request couldn't be sent: {type(err).__name__}: {err}") from None
            latency = int((time.monotonic() - started) * 1000)
            if 200 <= status < 300 and payload is not None and (valid is None or valid(payload)):
                return payload, latency, unknown
            unreadable = 200 <= status < 300
            unknown = unknown or unreadable or status == 0
            if status:
                error = (payload or {}).get("error")
                message = error.get("message", "") if isinstance(error, dict) else ""
                last = "OpenRouter sent an unreadable response" if unreadable else f"HTTP {status}: {message}"
            if attempt == 2 or (status and not unreadable and status not in RETRY_STATUSES):
                break
            self._sleep(min(_retry_after(headers), MAX_RETRY_WAIT_S))
        raise CallFailed(_plain(status, last), maybe_billed=unknown)

    def model_price(self, model: str) -> ModelPrice:
        """The model's list price from OpenRouter's public models list; stops if it can't return structured output."""
        try:
            payload, _, _ = self._with_retry("GET", "/models")
        except CallFailed as err:
            raise SetupError(f"Couldn't read OpenRouter's model list ({err}).") from None
        entry = next((m for m in payload.get("data") or [] if isinstance(m, dict) and m.get("id") == model), None)
        if entry is None:
            raise SetupError(f"OpenRouter doesn't list the model '{model}'. Check the id at openrouter.ai/models.")
        if "structured_outputs" not in (entry.get("supported_parameters") or []):
            raise SetupError(f"OpenRouter doesn't confirm that {model} supports structured outputs; "
                             "this step needs them to read the writer's reply reliably.")
        pricing = entry.get("pricing") or {}
        try:
            prompt, completion = float(pricing["prompt"]), float(pricing["completion"])
        except (KeyError, TypeError, ValueError):
            raise SetupError(f"OpenRouter lists no usable price for {model}, so the cost can't be capped.") from None
        return ModelPrice(model, prompt * PER_MILLION, completion * PER_MILLION)

    def chat(self, body: dict) -> Reply:
        assert_request_shape(body)
        payload, latency, unknown = self._with_retry("POST", "/chat/completions", body, valid=_is_completion)
        choice = payload["choices"][0]
        content, usage = choice["message"].get("content"), payload.get("usage")
        return Reply(text=content if isinstance(content, str) else "", finish_reason=str(choice.get("finish_reason") or ""),
                     generation_id=str(payload.get("id") or ""), model=str(payload.get("model") or body.get("model")),
                     usage=usage if isinstance(usage, dict) else {}, latency_ms=latency, earlier_attempt_unknown=unknown)


def _plain(status: int, detail: str) -> str:
    """The failure in plain words, with OpenRouter's own message after it."""
    meaning = {401: "the OpenRouter key was rejected", 402: "the OpenRouter account is out of credit",
               403: "OpenRouter refused the request", 404: "no OpenRouter provider matches this request's rules "
               "(model, price cap, structured output, no data collection)", 429: "OpenRouter's rate limit was hit"}
    return f"{meaning[status]} ({detail})" if status in meaning else detail


def _is_completion(payload: dict) -> bool:
    """The parts of a chat completion this step reads: one choice with a message."""
    choices = payload.get("choices")
    return (isinstance(choices, list) and bool(choices) and isinstance(choices[0], dict)
            and isinstance(choices[0].get("message"), dict))


def _json_object(raw: bytes) -> dict | None:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def _retry_after(headers: dict) -> float:
    value = next((v for k, v in headers.items() if k.lower() == "retry-after"), None)
    try:
        return max(float(value), 1.0) if value is not None else 2.0
    except ValueError:
        return 2.0
