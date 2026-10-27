"""Signed session tokens: base64url(payload) + "." + base64url(HMAC-SHA256). Stateless, so logout just clears the cookie.
Without SESSION_SECRET a random secret is generated at startup, which logs everyone out on every restart."""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Optional

from . import config

log = logging.getLogger("session")

if config.SESSION_SECRET:
    _SECRET = config.SESSION_SECRET.encode()
else:
    _SECRET = os.urandom(32)
    log.warning("SESSION_SECRET isn't set: using a random secret, so sessions end whenever the server restarts.")


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(body: str) -> str:
    return _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest())


def make_token(user_id: str, username: str, now: Optional[float] = None) -> str:
    exp = int((now if now is not None else time.time()) + config.SESSION_DAYS * 86400)
    body = _b64(json.dumps({"uid": user_id, "un": username, "exp": exp}, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def read_token(token: str, now: Optional[float] = None) -> Optional[dict]:
    """The payload if the signature is valid and the token hasn't expired, else None."""
    try:
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        data = json.loads(_unb64(body))
        if data["exp"] < (now if now is not None else time.time()):
            return None
        return {"uid": str(data["uid"]), "un": str(data["un"])}
    except (ValueError, KeyError, TypeError):
        return None
