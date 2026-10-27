import re

from fastapi import APIRouter, Depends, Response

from .. import db
from ..auth import SessionUser, clear_session_cookie, require_session, set_session_cookie
from ..errors import ApiException
from ..models import AccountUser, DataResponse, LoginRequest, Session, SignupRequest
from ..passwords import hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,31}$")
_DUMMY_HASH = hash_password("not-a-real-password")      # compared against when the username is unknown, so timing doesn't reveal it


def _session(user_id: str, username: str) -> DataResponse[Session]:
    return DataResponse(data=Session(user=AccountUser(id=user_id, username=username), persistence="account"))


@router.post("/signup", response_model=DataResponse[Session])
def signup(body: SignupRequest, response: Response):
    """Create an account (username + hashed password) and sign in. The profile is saved later by PUT /me/profile."""
    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise ApiException(400, "invalid_input", "Usernames are 3 to 32 characters: letters, numbers, dots, dashes and underscores.")
    if len(body.password) < 8:
        raise ApiException(400, "invalid_input", "Passwords need at least 8 characters.")
    try:
        user = db.create_user(username, hash_password(body.password))
    except db.UsernameTaken:
        raise ApiException(409, "invalid_input", "That username is taken.")
    set_session_cookie(response, user["id"], user["username"])
    return _session(user["id"], user["username"])


@router.post("/login", response_model=DataResponse[Session])
def login(body: LoginRequest, response: Response):
    row = db.get_user_by_username(body.username.strip().lower())
    ok = verify_password(body.password, row["password"] if row else _DUMMY_HASH)
    if not row or not ok:                                 # same answer for "no such user" and "wrong password"
        raise ApiException(401, "unauthenticated", "Wrong username or password.")
    set_session_cookie(response, row["id"], row["username"])
    return _session(row["id"], row["username"])


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"data": {"ok": True}}


@router.get("/session", response_model=DataResponse[Session])
def session(user: SessionUser = Depends(require_session)):
    """Used by the frontend on load to restore a session: the session, or 401."""
    return _session(user.id, user.username)
