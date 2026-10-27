"""Check that related scopes score higher than unrelated ones. Run from backend/: python scripts/sanity.py"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.embeddings import EMBEDDING_DIM, MODEL_NAME, embed  # noqa: E402

VENDOR = (
    "Asphalt patching, pothole repair and small paving jobs. "
    "Highway, Street, and Bridge Construction."
)
SCOPES = {
    "paving (related)": "Citywide pothole repair and asphalt patching on residential streets.",
    "road resurfacing (related)": "Grind and overlay of arterial roads including pavement markings.",
    "excavation (adjacent)": "Site preparation, grading and excavation for a new fire station.",
    "landscaping (unrelated)": "Mowing, tree trimming and landscaping services for city parks.",
    "office software (unrelated)": "Purchase of a cloud-based human resources information system.",
}

t0 = time.time()
vecs = embed([VENDOR, *SCOPES.values()])
print(f"model={MODEL_NAME} dim={vecs.shape[1]} (expected {EMBEDDING_DIM}) embed time={time.time() - t0:.1f}s")
assert vecs.shape == (len(SCOPES) + 1, EMBEDDING_DIM)
print(f"vector norm={(vecs[0] ** 2).sum() ** 0.5:.3f} (expected 1.000)\n")

scores = vecs[1:] @ vecs[0]
for (name, _), s in sorted(zip(SCOPES.items(), scores), key=lambda x: -x[1]):
    print(f"{s:6.3f}  {name}")
