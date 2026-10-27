"""The only place gtm-evaluate talks to the Claude API (the skill-side twin of src/platform/ai).

Standard library only (urllib), like the intake scripts. The key comes from the environment or the
macOS Keychain, is read through a pipe, and is never printed, logged, cached or put on a command line.
Every error message passes a redactor. Each call either returns a Reply or raises CallFailed with a
plain reason, so the runner can skip one simulated draw and keep going.
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

API_URL = "https://api.anthropic.com/v1"
API_VERSION = "2023-06-01"
KEY_ENV = "GTMAGIC_ANTHROPIC_API_KEY"  # deliberately not ANTHROPIC_API_KEY: never bill a stray shell key
KEYCHAIN_SERVICE = "gtmagic-anthropic"
# Request keys the API rejects on this model (sampling) or this step must never send (tools, web access).
FORBIDDEN_KEYS = {"temperature", "top_p", "top_k", "tools", "tool_choice", "mcp_servers", "container"}
RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504, 529}
MAX_RETRY_WAIT_S = 30.0
TIMEOUT_S = 120.0
KEY_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9_\-]+")


class CallFailed(Exception):
    """One call failed for good (after its retry). `reason` is the skip reason the run records.
    fatal: a 4xx that will fail every call the same way (bad request, auth, size), so the run should stop.
    maybe_billed: no readable answer came back, so the server may still have charged for it."""

    def __init__(self, reason: str, detail: str, fatal: bool = False, maybe_billed: bool = False) -> None:
        super().__init__(redact(detail))
        self.reason = reason
        self.fatal = fatal
        self.maybe_billed = maybe_billed


class SetupError(Exception):
    """The run can't start (no key, model can't take the input). Shown to the user as-is."""


@dataclass
class Reply:
    text: str                      # the first text block (structured output arrives here as JSON)
    stop_reason: str
    usage: dict = field(default_factory=dict)
    latency_ms: int = 0
    model: str = ""
    earlier_attempt_unknown: bool = False   # a first attempt got no readable answer; it may have been billed


def redact(text: str) -> str:
    return KEY_PATTERN.sub("[key removed]", str(text))


def load_key() -> str:
    """Env var first, then the Keychain. Read through a pipe: the key is never on argv or in output."""
    key = os.environ.get(KEY_ENV, "").strip()
    if key:
        return key
    try:
        found = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE,
                                "-a", getpass.getuser(), "-w"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        found = None
    if found is not None and found.returncode == 0 and found.stdout.strip():
        return found.stdout.strip()
    raise SetupError(f"No Anthropic API key found. Set {KEY_ENV}, or store it in the macOS Keychain as service "
                     f"'{KEYCHAIN_SERVICE}' for your user (run `security add-generic-password -s {KEYCHAIN_SERVICE} "
                     "-a \"$USER\" -w` and paste the key at the prompt, so it never lands in shell history).")


def assert_request_shape(body: dict) -> None:
    """Fail loudly before sending anything this step must never send."""
    bad = sorted(FORBIDDEN_KEYS & set(body))
    if bad:
        raise ValueError(f"request must not carry {bad}")
    if not (body.get("output_config") or {}).get("effort"):
        raise ValueError("request must set output_config.effort explicitly")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect: urllib would carry the x-api-key header to the new host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001 (urllib's signature)
        return None


class ClaudeClient:
    """Thin HTTP client. `opener` is injectable so tests never touch the network."""

    def __init__(self, key: str, opener=None, sleep=time.sleep) -> None:
        self._key = key
        self._open = opener or urllib.request.build_opener(_NoRedirect()).open
        self._sleep = sleep

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict, dict | None]:
        """(status, headers, payload); payload is None when the body isn't a JSON object."""
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(f"{API_URL}{path}", data=data, method=method, headers={
            "x-api-key": self._key, "anthropic-version": API_VERSION, "content-type": "application/json"})
        try:
            with self._open(req, timeout=TIMEOUT_S) as resp:
                return resp.status, dict(resp.headers), _json_object(resp.read())
        except urllib.error.HTTPError as err:
            try:
                payload = _json_object(err.read())
            except OSError:
                payload = None
            return err.code, dict(err.headers or {}), payload

    def _with_retry(self, method: str, path: str, body: dict | None = None, valid=None) -> tuple[dict, int, bool]:
        """One retry on rate limits, overload, server errors, network failures and unreadable 2xx replies
        (not JSON, or not the shape `valid` expects); then CallFailed. The bool says an earlier attempt got
        no readable answer (so it may have been billed)."""
        last, status, unknown = "", 0, False
        for attempt in (1, 2):
            started = time.monotonic()
            try:
                status, headers, payload = self._request(method, path, body)
            except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as err:
                status, headers, payload, last = 0, {}, None, f"network error: {type(err).__name__}: {err}"
            latency = int((time.monotonic() - started) * 1000)
            if 200 <= status < 300 and payload is not None and (valid is None or valid(payload)):
                return payload, latency, unknown
            unreadable = 200 <= status < 300  # a 2xx we can't read: retry it like an overload
            unknown = unknown or unreadable or status == 0
            if status:
                error = (payload or {}).get("error")
                message = error.get("message", "") if isinstance(error, dict) else ""
                last = "the API sent an unreadable response" if unreadable else f"HTTP {status}: {message}"
            if attempt == 2 or (status and not unreadable and status not in RETRY_STATUSES):
                break
            self._sleep(min(_retry_after(headers), MAX_RETRY_WAIT_S))
        # A redirect (never followed) or a 4xx will fail every call the same way, so the run should stop.
        fatal = 300 <= status < 500 and status not in RETRY_STATUSES
        raise CallFailed("timeout" if status == 0 else "api-error", last, fatal=fatal, maybe_billed=unknown)

    def model_capabilities(self, model: str) -> dict | None:
        """GET /v1/models/{id}; returns the `capabilities` object (None when the API leaves it null)."""
        try:
            payload, _, _ = self._with_retry("GET", f"/models/{model}")
        except CallFailed as err:
            raise SetupError(f"Couldn't read model '{model}' from the Models API ({err}).") from None
        caps = payload.get("capabilities")
        return caps if isinstance(caps, dict) else None

    def message(self, body: dict) -> Reply:
        assert_request_shape(body)
        payload, latency, unknown = self._with_retry("POST", "/messages", body, valid=_is_message)
        text = next((b["text"] for b in payload["content"] if b.get("type") == "text"), "")
        return Reply(text=text, stop_reason=payload["stop_reason"], usage=payload["usage"], latency_ms=latency,
                     model=str(payload.get("model") or body.get("model")), earlier_attempt_unknown=unknown)


def _is_message(payload: dict) -> bool:
    """The parts of a Messages reply this step reads: content blocks, a stop reason, and token usage.
    A finished turn (end_turn) must carry a text block; a refusal or a cut-off reply may not."""
    content, usage, stop = payload.get("content"), payload.get("usage"), payload.get("stop_reason")
    if not (isinstance(content, list) and all(isinstance(b, dict) for b in content) and isinstance(stop, str)):
        return False
    texts = [b.get("text") for b in content if b.get("type") == "text"]
    counts = [usage.get(k) for k in ("input_tokens", "output_tokens")] if isinstance(usage, dict) else [None]
    return (all(isinstance(t, str) for t in texts) and (bool(texts) or stop != "end_turn")
            and all(isinstance(c, int) and not isinstance(c, bool) and c >= 0 for c in counts))


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


def require_capabilities(caps: dict | None, model: str, needs_images: bool, effort: str) -> None:
    """Fail closed: a capability that is false, null or missing stops the run before any paid call."""
    def supported(name: str, sub: str = "") -> bool:
        entry = (caps or {}).get(name)
        entry = entry.get(sub) if sub and isinstance(entry, dict) else entry
        return isinstance(entry, dict) and entry.get("supported") is True

    if not supported("effort", effort):
        raise SetupError(f"The Models API doesn't confirm that {model} supports effort '{effort}'.")
    if not supported("structured_outputs"):
        raise SetupError(f"The Models API doesn't confirm that {model} supports structured outputs; "
                         "this step needs them to read answers reliably.")
    if needs_images and not supported("image_input"):
        raise SetupError(f"The Models API doesn't confirm that {model} accepts image input, so the image "
                         "evaluation can't run. Headlines can still be evaluated.")
