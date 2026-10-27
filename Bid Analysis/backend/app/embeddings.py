"""Local sentence embeddings. Vectors are L2-normalized, so cosine similarity is a dot product."""

from functools import lru_cache

import numpy as np

MODEL_NAME = "all-MiniLM-L6-v2"
MODEL_VERSION = "1"  # bump if the model or text preprocessing changes; stored with every vector
EMBEDDING_DIM = 384


class AiUnavailable(Exception):
    """The embedding model could not be loaded or run (maps to the `ai_unavailable` API error)."""


@lru_cache(maxsize=1)
def _model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME)
    except Exception as e:
        raise AiUnavailable(f"could not load {MODEL_NAME}: {e}") from e


def embed(texts: list[str]) -> np.ndarray:
    """Return an (n, 384) float32 array of normalized embeddings, one row per input text."""
    if not texts:
        return np.empty((0, EMBEDDING_DIM), dtype=np.float32)
    model = _model()
    try:
        return model.encode(texts, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False).astype(np.float32)
    except Exception as e:
        raise AiUnavailable(f"embedding failed: {e}") from e
