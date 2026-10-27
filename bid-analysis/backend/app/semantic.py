import numpy as np


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Embeddings are normalized, so cosine similarity is a dot product, clipped to 0..1."""
    return float(np.clip(np.dot(a, b), 0.0, 1.0))
