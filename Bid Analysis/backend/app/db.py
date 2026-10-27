"""Supabase access over its REST API (PostgREST) with httpx. A few plain functions, no abstraction layer.

What works today (verified against the team project with the publishable key): reading `open_bids`.
What needs other people: vector columns on `bids` (migration proposed in backend/sql/), profile storage,
and the server-side key to write anything. Those paths raise StorageUnavailable or return empty."""

import json
import logging
from typing import Optional

import httpx

from . import config
from .models import Bid

log = logging.getLogger("db")

BID_COLUMNS = ",".join([
    "id", "source_id", "agency", "title", "solicitation_number", "bid_type", "status", "summary", "description",
    "categories", "naics_codes", "requirements", "set_asides", "state", "county", "city", "location_text", "lat", "lng",
    "posted_date", "deadline", "prebid_at", "questions_due_at", "contact_name", "contact_email", "contact_phone",
    "estimated_value_text", "source_url", "documents", "extraction_method", "last_checked", "updated_at",
])


class StorageUnavailable(Exception):
    """Supabase is unreachable, misconfigured, or the needed table/column doesn't exist yet."""


def _headers(write: bool = False) -> dict:
    # Writes use the server key only; the publishable key is read-only by design and is never used to write.
    # Least privilege: reads use the publishable key when it is set; the server key is the fallback for reads.
    key = config.SUPABASE_SECRET_KEY if write else (config.SUPABASE_PUBLISHABLE_KEY or config.SUPABASE_SECRET_KEY)
    if not config.SUPABASE_URL or not key:
        raise StorageUnavailable("Supabase isn't configured (set SUPABASE_URL and a key in backend/.env).")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _get(path: str, params: dict, write: bool = False) -> list[dict]:
    """write=True uses the server key; the users and saved_opportunities tables are closed to the public key."""
    try:
        r = httpx.get(f"{config.SUPABASE_URL}/rest/v1/{path}", params=params, headers=_headers(write=write), timeout=20)
    except httpx.HTTPError as e:
        raise StorageUnavailable(f"couldn't reach Supabase: {e.__class__.__name__}") from e
    if r.status_code >= 400:
        raise StorageUnavailable(f"Supabase returned {r.status_code} for {path}")
    return r.json()


def list_open_bids(limit: int = config.MAX_BIDS_PER_REQUEST) -> list[Bid]:
    """Still-open Washington bids, soonest deadline first."""
    if config.BIDS_SOURCE == "mock":
        rows = json.loads((config.REPO_DIR / "data" / "mock" / "bids.json").read_text())
        return [Bid(**r) for r in rows][:limit]
    rows = _get("open_bids", {"select": BID_COLUMNS, "state": "eq.WA", "order": "deadline.asc.nullslast", "limit": limit})
    return [Bid(**r) for r in rows]


def get_bid_vectors(ids: list[str]) -> dict[str, dict]:
    """{bid id: {embedding, embedding_model, embedding_version, updated_at}} for bids that already have one.
    Returns {} if the vector columns don't exist yet, so callers fall back to embedding on the fly."""
    if not ids or config.BIDS_SOURCE == "mock":
        return {}
    try:
        rows = _get("bids", {"select": "id,updated_at,embedding,embedding_model,embedding_version", "id": f"in.({','.join(ids)})"})
    except StorageUnavailable as e:
        log.warning("stored vectors unavailable (%s); embedding bids on the fly", e)
        return {}
    out = {}
    for r in rows:
        if r.get("embedding"):
            emb = r["embedding"]
            out[r["id"]] = {**r, "embedding": json.loads(emb) if isinstance(emb, str) else emb}
    return out


def upsert_bid_vector(bid_id: str, vector: list[float], model: str, version: str) -> None:
    """Needs SUPABASE_SECRET_KEY and the vector columns (backend/sql/0001_embeddings.sql)."""
    try:
        r = httpx.patch(
            f"{config.SUPABASE_URL}/rest/v1/bids", params={"id": f"eq.{bid_id}"},
            headers={**_headers(write=True), "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"embedding": "[" + ",".join(f"{x:.6f}" for x in vector) + "]", "embedding_model": model, "embedding_version": version},
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise StorageUnavailable(f"couldn't reach Supabase: {e.__class__.__name__}") from e
    if r.status_code >= 400:
        raise StorageUnavailable(f"couldn't write the vector ({r.status_code}); has the migration been applied?")


# ---------------------------------------------------------------- users table: username, password, info, embed

class UsernameTaken(Exception):
    pass


class UserNotFound(Exception):
    pass


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in vector) + "]"


def create_user(username: str, password_hash: str) -> dict:
    """Insert a new user with no profile yet (`info` and `embed` stay empty). Needs the server key; never writes
    a plaintext password. Returns {id, username}."""
    try:
        r = httpx.post(
            f"{config.SUPABASE_URL}/rest/v1/users",
            headers={**_headers(write=True), "Content-Type": "application/json", "Prefer": "return=representation"},
            json={"username": username, "password": password_hash}, timeout=20,
        )
    except httpx.HTTPError as e:
        raise StorageUnavailable(f"couldn't reach Supabase: {e.__class__.__name__}") from e
    if r.status_code == 409:                                  # unique violation on username
        raise UsernameTaken(username)
    if r.status_code >= 400:
        raise StorageUnavailable(f"couldn't create the user ({r.status_code})")
    row = r.json()[0]
    return {"id": str(row["id"]), "username": row["username"]}


class RevisionConflict(Exception):
    pass


class BidNotFound(Exception):
    pass


def _write(method: str, path: str, params: dict, body, prefer: str = "return=representation") -> httpx.Response:
    try:
        return httpx.request(
            method, f"{config.SUPABASE_URL}/rest/v1/{path}", params=params, json=body,
            headers={**_headers(write=True), "Content-Type": "application/json", "Prefer": prefer}, timeout=20,
        )
    except httpx.HTTPError as e:
        raise StorageUnavailable(f"couldn't reach Supabase: {e.__class__.__name__}") from e


def _parse_vector(v):
    if v is None:
        return None
    return json.loads(v) if isinstance(v, str) else v


def get_user_by_username(username: str) -> Optional[dict]:
    """{id, username, password} for login, or None."""
    rows = _get("users", {"select": "id,username,password", "username": f"eq.{username}", "limit": 1}, write=True)
    return {**rows[0], "id": str(rows[0]["id"])} if rows else None


def get_user(user_id: str) -> Optional[dict]:
    """{id, username, profile, profile_revision, embed, embedding_model, embedding_version} or None. Never returns the password."""
    rows = _get("users", {"select": "id,username,profile,profile_revision,embed,embedding_model,embedding_version", "id": f"eq.{user_id}", "limit": 1}, write=True)
    if not rows:
        return None
    r = rows[0]
    return {**r, "id": str(r["id"]), "embed": _parse_vector(r.get("embed"))}


def save_user_profile(user_id: str, expected_revision: int, profile: dict, info: str, embed: list[float], model: str, version: str) -> int:
    """Write the structured profile, `info` text and `embed` vector, and bump the revision, only if the stored revision
    still equals `expected_revision` (compare-and-set). Raises RevisionConflict or UserNotFound. Returns the new revision."""
    new_revision = expected_revision + 1
    r = _write("PATCH", "users", {"id": f"eq.{user_id}", "profile_revision": f"eq.{expected_revision}"}, {
        "profile": profile, "profile_revision": new_revision, "info": info, "embed": _vector_literal(embed),
        "embedding_model": model, "embedding_version": version,
    })
    if r.status_code >= 400:
        raise StorageUnavailable(f"couldn't save the profile ({r.status_code})")
    if not r.json():
        if get_user(user_id) is None:
            raise UserNotFound(user_id)
        raise RevisionConflict(user_id)
    return new_revision


# ---------------------------------------------------------------- saved opportunities

def list_saved(user_id: str) -> list[str]:
    rows = _get("saved_opportunities", {"select": "bid_id", "user_id": f"eq.{user_id}", "order": "created_at.desc"}, write=True)
    return [r["bid_id"] for r in rows]


def save_opportunity(user_id: str, bid_id: str) -> None:
    """Idempotent: saving twice is fine. Raises BidNotFound if the bid doesn't exist."""
    r = _write("POST", "saved_opportunities", {"on_conflict": "user_id,bid_id"}, {"user_id": int(user_id), "bid_id": bid_id},
               prefer="resolution=ignore-duplicates,return=minimal")
    if r.status_code == 409:
        raise BidNotFound(bid_id)               # foreign key violation
    if r.status_code >= 400:
        raise StorageUnavailable(f"couldn't save the opportunity ({r.status_code})")


def remove_saved(user_id: str, bid_id: str) -> None:
    r = _write("DELETE", "saved_opportunities", {"user_id": f"eq.{user_id}", "bid_id": f"eq.{bid_id}"}, None, prefer="return=minimal")
    if r.status_code >= 400:
        raise StorageUnavailable(f"couldn't remove the saved opportunity ({r.status_code})")
