"""Who is calling. AUTH_MODE=enforce (default) requires the signed session cookie; AUTH_MODE=disabled is dev only
and lets the X-Dev-User-Id header (or "dev-user") act as the caller."""

from fastapi import Request, Response

from . import config
from .errors import ApiException
from .session import make_token, read_token

COOKIE = "session"


class SessionUser:
    def __init__(self, id: str, username: str = ""):
        self.id, self.username = id, username


def require_session(request: Request) -> SessionUser:
    if config.AUTH_MODE == "disabled":
        return SessionUser(request.headers.get("X-Dev-User-Id") or "dev-user", "dev")
    token = request.cookies.get(COOKIE)
    data = read_token(token) if token else None
    if not data:
        raise ApiException(401, "unauthenticated", "Please sign in to continue.")
    return SessionUser(data["uid"], data["un"])


def set_session_cookie(response: Response, user_id: str, username: str) -> None:
    response.set_cookie(
        COOKIE, make_token(user_id, username), max_age=config.SESSION_DAYS * 86400,
        httponly=True, samesite="lax", secure=config.COOKIE_SECURE, path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
