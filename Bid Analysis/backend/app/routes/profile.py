from fastapi import APIRouter, Depends

from ..auth import SessionUser, require_session
from ..interpret import interpret_description
from ..models import DataResponse, InterpretRequest, InterpretResponse, ProfileEmbedding, VendorProfile
from ..profile_embedding import build_profile_embedding

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


@router.post("/interpret", response_model=DataResponse[InterpretResponse])
def interpret(body: InterpretRequest, _: SessionUser = Depends(require_session)):
    """Plain-language description -> draft profile (fields marked inferred) and up to three follow-up questions."""
    return DataResponse(data=interpret_description(body.description, body.base_location, body.service_area_text))


@router.post("/embedding", response_model=DataResponse[ProfileEmbedding])
def embedding(profile: VendorProfile, _: SessionUser = Depends(require_session)):
    """Internal: whoever saves a confirmed profile calls this and stores the summary + vector on the user record."""
    return DataResponse(data=build_profile_embedding(profile))
