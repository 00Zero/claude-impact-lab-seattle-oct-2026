"""Minimal local Ollama client (loopback only, no cloud fallback)."""

import json
import ipaddress
import os
import platform
import subprocess
import urllib.parse
import urllib.request

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("COACH_MODEL", "gemma4:e4b")
OPTIONS = {"temperature": 0.2, "top_p": 0.9, "seed": 42, "num_ctx": 8192, "num_predict": 700}
PRIVATE_V4 = tuple(ipaddress.ip_network(x) for x in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
PRIVATE_V6 = ipaddress.ip_network("fc00::/7")


class Cancelled(Exception):
    pass


class GenerationError(Exception):
    pass


def _local_only(url):
    host = None
    parsed = None
    try:
        parsed = urllib.parse.urlsplit(url)
        host = parsed.hostname
        if parsed.scheme != "http" or not host or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError()
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            raise ValueError()
        ip = ipaddress.ip_address(host)
        if ip.is_unspecified:
            raise ValueError()
        if getattr(ip, "ipv4_mapped", None) is not None:
            ip = ip.ipv4_mapped
        is_private_address = (ip.version == 4 and any(ip in network for network in PRIVATE_V4)) or (ip.version == 6 and ip in PRIVATE_V6)
        private_ok = os.environ.get("COACH_ALLOW_PRIVATE_OLLAMA") == "1" and is_private_address
        if not ip.is_loopback and not private_ok:
            raise ValueError()
        if parsed.path not in ("", "/"):
            raise ValueError()
    except ValueError:
        if parsed is not None and host == "localhost" and parsed.scheme == "http" and not parsed.username and not parsed.password and parsed.path in ("", "/") and not parsed.query and not parsed.fragment:
            try:
                port = parsed.port
                if port is None or 1 <= port <= 65535:
                    return
            except ValueError:
                pass
        raise GenerationError("OLLAMA_URL must be a loopback HTTP URL. Private IPs require COACH_ALLOW_PRIVATE_OLLAMA=1.")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise GenerationError("Ollama redirects are disabled.")

_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())


def _get(path):
    _local_only(OLLAMA_URL)
    with _OPENER.open(OLLAMA_URL + path, timeout=5) as r:
        return json.loads(r.read())


def _hardware():
    try:
        chip = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True, timeout=2).stdout.strip()
        mem = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=2).stdout.strip())
        return "%s, %d GB RAM, %s" % (chip, round(mem / 2 ** 30), platform.platform(terse=True))
    except Exception:
        return platform.platform(terse=True)


def runtime_info():
    """Pinned model/runtime configuration recorded with every run."""
    parsed = urllib.parse.urlsplit(OLLAMA_URL)
    host = parsed.hostname
    is_loopback = host in ("127.0.0.1", "localhost", "::1")
    info = {"model": MODEL, "options": dict(OPTIONS), "hardware": "Client runtime: " + _hardware(),
            "ollamaPlacement": "loopback" if is_loopback else "configured private endpoint (host hardware unmeasured)", "available": False}
    try:
        info["ollamaVersion"] = _get("/api/version").get("version")
        tags = _get("/api/tags").get("models", [])
        m = next((t for t in tags if t["name"] == MODEL), None)
        if m:
            info.update(available=True, digest=m["digest"], quantization=m["details"].get("quantization_level"),
                        parameterSize=m["details"].get("parameter_size"))
        else:
            info["error"] = "Model %s is not pulled. Run: ollama pull %s" % (MODEL, MODEL)
    except Exception as e:
        info["error"] = "Ollama is not reachable at %s (%s). Start Ollama; there is no cloud fallback." % (OLLAMA_URL, e.__class__.__name__)
    return info


def estimate_tokens(text):
    # Conservative estimate (~3 characters per token) so we fail before Ollama truncates silently.
    return len(text) // 3 + 1


def check_context_budget(system, user):
    need = estimate_tokens(system) + estimate_tokens(user)
    budget = OPTIONS["num_ctx"] - OPTIONS["num_predict"]
    if need > budget:
        raise GenerationError("Input is too long for the pinned context window (~%d tokens needed, %d available). "
                              "Shorten the template or transcript; nothing was truncated." % (need, budget))
    return need


def chat(system, user, cancel_event=None):
    """Stream a chat completion; abort promptly if cancel_event is set."""
    _local_only(OLLAMA_URL)
    check_context_budget(system, user)
    body = json.dumps({"model": MODEL, "stream": True, "think": False, "options": OPTIONS,
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}).encode()
    req = urllib.request.Request(OLLAMA_URL + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    out, stats = [], {}
    try:
        resp = _OPENER.open(req, timeout=300)
    except Exception as e:
        raise GenerationError("Could not reach local Ollama (%s). Start Ollama and retry; there is no cloud fallback." % e)
    with resp:
        for line in resp:
            if cancel_event is not None and cancel_event.is_set():
                raise Cancelled()
            if not line.strip():
                continue
            msg = json.loads(line)
            if msg.get("error"):
                raise GenerationError("Ollama error: %s" % msg["error"])
            out.append(msg.get("message", {}).get("content", ""))
            if msg.get("done"):
                stats = {k: msg.get(k) for k in ("prompt_eval_count", "eval_count", "total_duration", "done_reason")}
    text = "".join(out).strip()
    if not text:
        raise GenerationError("The model returned an empty response.")
    if stats.get("done_reason") == "length":
        raise GenerationError("The note hit the output limit (%d tokens) and was cut off." % OPTIONS["num_predict"])
    return text, stats


def interpret_feedback(system, user, cancel_event=None):
    """Small bounded local response reserved for typed feedback interpretation."""
    body = json.dumps({"model": MODEL, "stream": False, "think": False,
                       "options": dict(OPTIONS, num_predict=256),
                       "messages": [{"role": "system", "content": system},
                                    {"role": "user", "content": user}]}).encode()
    _local_only(OLLAMA_URL)
    check_context_budget(system, user)
    if cancel_event is not None and cancel_event.is_set():
        raise Cancelled()
    req = urllib.request.Request(OLLAMA_URL + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    try:
        with _OPENER.open(req, timeout=120) as r:
            data = json.loads(r.read(256 * 1024))
    except Exception as e:
        if isinstance(e, GenerationError):
            raise
        raise GenerationError("Feedback interpretation failed locally (%s)." % e.__class__.__name__)
    if cancel_event is not None and cancel_event.is_set():
        raise Cancelled()
    if not isinstance(data, dict) or not isinstance(data.get("message"), dict):
        raise GenerationError("Feedback interpreter returned an invalid response object.")
    content = data["message"].get("content", "")
    if data.get("done_reason") == "length":
        raise GenerationError("Feedback interpretation hit the local output limit; no patch was saved.")
    if not content or len(content) > 12000:
        raise GenerationError("Feedback interpreter returned an empty or oversized response.")
    return content, {"done_reason": data.get("done_reason")}
