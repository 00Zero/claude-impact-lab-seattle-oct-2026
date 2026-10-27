import logging

import numpy as np
from fastapi import APIRouter, Depends

from .. import config, db
from ..auth import SessionUser, require_session
from ..catalog import apply_filter
from ..embeddings import EMBEDDING_DIM, MODEL_NAME, MODEL_VERSION, AiUnavailable, embed
from ..errors import ApiException
from ..matching import assess, sort_key
from ..models import Bid, MatchMeta, MatchRequest, MatchResponse, VendorProfile
from ..semantic import cosine
from ..textbuild import bid_text, vendor_text

log = logging.getLogger("matches")
router = APIRouter(prefix="/api/v1", tags=["matches"])

_bid_cache: dict[tuple[str, str], np.ndarray] = {}      # (bid id, updated_at) -> vector
_vendor_cache: dict[tuple[str, int], np.ndarray] = {}   # (profile id, revision) -> vector


def _bid_vectors(bids: list[Bid]) -> dict[str, np.ndarray]:
    """Stored vector if it matches the current model, else the in-process cache, else embed now."""
    stored = db.get_bid_vectors([str(b.id) for b in bids])
    vecs: dict[str, np.ndarray] = {}
    todo: list[tuple[Bid, tuple[str, str]]] = []
    for b in bids:
        s = stored.get(str(b.id))
        if s and s.get("embedding_model") == MODEL_NAME and s.get("embedding_version") == MODEL_VERSION and len(s["embedding"]) == EMBEDDING_DIM:
            vecs[str(b.id)] = np.asarray(s["embedding"], dtype=np.float32)
            continue
        key = (str(b.id), b.updated_at.isoformat() if b.updated_at else "")
        if key in _bid_cache:
            vecs[str(b.id)] = _bid_cache[key]
        else:
            todo.append((b, key))
    if todo:
        for (b, key), v in zip(todo, embed([bid_text(b) for b, _ in todo])):
            _bid_cache[key] = vecs[str(b.id)] = v
    return vecs


def _vendor_vector(profile: VendorProfile) -> np.ndarray:
    key = (profile.id, profile.revision)
    if key not in _vendor_cache:
        _vendor_cache[key] = embed([vendor_text(profile, profile.original_description)])[0]
    return _vendor_cache[key]


@router.post("/matches", response_model=MatchResponse)
def matches(body: MatchRequest, user: SessionUser = Depends(require_session)):
    stored_vec = None
    if body.profile is not None and config.AUTH_MODE == "disabled":
        profile = body.profile                                   # dev only: exercise matching without a saved profile
    else:
        if body.profile_id != user.id:
            raise ApiException(403, "forbidden", "That profile belongs to another account.")
        row = db.get_user(user.id)
        if row is None or not row["profile"]:
            raise ApiException(404, "not_found", "No saved profile found. Finish onboarding first.")
        profile = VendorProfile(**row["profile"])
        if row["embed"] and row["embedding_model"] == MODEL_NAME and row["embedding_version"] == MODEL_VERSION and len(row["embed"]) == EMBEDDING_DIM:
            stored_vec = np.asarray(row["embed"], dtype=np.float32)   # built when the profile was saved, from the same text
    if profile.revision != body.profile_revision:
        raise ApiException(409, "revision_conflict", "Your profile changed. Refresh and try again.")

    bids = apply_filter(db.list_open_bids(), body.filter)[: config.MAX_BIDS_PER_REQUEST]

    state = "complete"
    sims: dict[str, float | None] = {str(b.id): None for b in bids}
    if bids:
        try:
            vendor_vec, bid_vecs = (stored_vec if stored_vec is not None else _vendor_vector(profile)), _bid_vectors(bids)
            sims = {k: cosine(vendor_vec, v) for k, v in bid_vecs.items()}
        except AiUnavailable as e:
            # Degrade honestly: rules still run, similarity is left out, and the response says so.
            log.warning("matching without similarity: %s", e)
            state = "partial"

    results = sorted((assess(b, profile, sims.get(str(b.id))) for b in bids), key=sort_key)
    return MatchResponse(
        data=results,
        meta=MatchMeta(profile_revision=profile.revision, ranking_version=results[0].ranking_version if results else config.RANKING_VERSION,
                       assessed_count=len(results), unassessed_count=0, assessment_state=state, mode="live"),
    )
