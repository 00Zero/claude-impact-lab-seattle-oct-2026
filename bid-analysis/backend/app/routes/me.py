import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from .. import db
from ..auth import SessionUser, require_session
from ..errors import ApiException
from ..models import DataResponse, SaveProfileRequest, VendorProfile
from ..profile_embedding import build_profile_embedding

router = APIRouter(prefix="/api/v1/me", tags=["me"])
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


@router.get("/profile", response_model=DataResponse[Optional[VendorProfile]])
def get_profile(user: SessionUser = Depends(require_session)):
    row = db.get_user(user.id)
    if row is None:
        raise ApiException(404, "not_found", "That account no longer exists.")
    return DataResponse(data=VendorProfile(**row["profile"]) if row["profile"] else None)


@router.put("/profile", response_model=DataResponse[VendorProfile])
def save_profile(body: SaveProfileRequest, user: SessionUser = Depends(require_session)):
    """Confirm a profile. Stores the structured profile, `info` (text of everything collected) and `embed` (its embedding,
    minus the exclusions line) on the user's row and bumps the revision. 409 if `expectedRevision` isn't the stored one."""
    row = db.get_user(user.id)
    if row is None:
        raise ApiException(404, "not_found", "That account no longer exists.")
    stored = row["profile_revision"] or 0
    if (body.expected_revision or 0) != stored:
        raise ApiException(409, "revision_conflict", "Your profile changed. Refresh and try again.")
    profile = VendorProfile(
        id=user.id, revision=stored + 1, owner_user_id=user.id, original_description=body.original_description,
        confirmed_at=datetime.now(timezone.utc), **dict(body.fields),
    )
    built = build_profile_embedding(profile)
    db.save_user_profile(user.id, stored, profile.model_dump(mode="json"), built.info, built.embed, built.embedding_model, built.embedding_version)
    return DataResponse(data=profile)


# ---------------------------------------------------------------- saved opportunities

def _bid_id(value: str) -> str:
    if not UUID_RE.match(value):
        raise ApiException(400, "invalid_input", "That isn't a valid opportunity id.")
    return value.lower()


@router.get("/saved-opportunities", response_model=DataResponse[list[str]])
def list_saved(user: SessionUser = Depends(require_session)):
    return DataResponse(data=db.list_saved(user.id))


@router.put("/saved-opportunities/{bid_id}")
def save_opportunity(bid_id: str, user: SessionUser = Depends(require_session)):
    db.save_opportunity(user.id, _bid_id(bid_id))
    return {"data": {"id": bid_id}}


@router.delete("/saved-opportunities/{bid_id}")
def remove_opportunity(bid_id: str, user: SessionUser = Depends(require_session)):
    db.remove_saved(user.id, _bid_id(bid_id))
    return {"data": {"id": bid_id}}
