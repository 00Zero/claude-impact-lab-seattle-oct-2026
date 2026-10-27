"""Embed open Washington bids and store the vectors on the `bids` rows. Run from backend/: python scripts/embed_bids.py [--all]

Needs (not available yet): the vector columns from sql/0001_embeddings.sql applied by whoever owns migrations, and
SUPABASE_SECRET_KEY in backend/.env. Skips bids whose stored vector already matches the current model unless --all."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402
from app.embeddings import MODEL_NAME, MODEL_VERSION, embed  # noqa: E402
from app.textbuild import bid_text  # noqa: E402


def main(force: bool) -> int:
    bids = db.list_open_bids(limit=2000)
    stored = {} if force else db.get_bid_vectors([str(b.id) for b in bids])
    todo = [b for b in bids if not (stored.get(str(b.id)) and stored[str(b.id)].get("embedding_model") == MODEL_NAME
                                    and stored[str(b.id)].get("embedding_version") == MODEL_VERSION)]
    print(f"{len(bids)} open WA bids, {len(todo)} need a vector")
    for start in range(0, len(todo), 32):
        chunk = todo[start:start + 32]
        for b, v in zip(chunk, embed([bid_text(b) for b in chunk])):
            db.upsert_bid_vector(str(b.id), [float(x) for x in v], MODEL_NAME, MODEL_VERSION)
        print(f"  embedded {min(start + 32, len(todo))}/{len(todo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main("--all" in sys.argv))
