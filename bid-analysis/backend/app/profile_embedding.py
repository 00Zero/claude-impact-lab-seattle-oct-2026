"""info + embed for a confirmed profile. Whoever saves the profile stores both on the user's row."""

from .embeddings import MODEL_NAME, MODEL_VERSION, embed
from .models import ProfileEmbedding, VendorProfile
from .textbuild import profile_info, vendor_text


def build_profile_embedding(profile: VendorProfile) -> ProfileEmbedding:
    info = profile_info(profile, profile.original_description)
    vec = embed([vendor_text(profile, profile.original_description)])[0]     # same text minus the exclusions line
    return ProfileEmbedding(
        profile_revision=profile.revision, info=info, embed=[float(x) for x in vec],
        embedding_model=MODEL_NAME, embedding_version=MODEL_VERSION,
    )
