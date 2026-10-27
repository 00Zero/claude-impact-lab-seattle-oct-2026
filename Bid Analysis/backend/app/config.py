"""Settings and tuning knobs. Thresholds are starting guesses; tune them with scripts/run_eval.py."""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


def _load_env() -> None:
    """Read the repo-root .env (gitignored, shared with the frontend and scripts) into the process environment.
    Real environment variables win. If a name appears twice in the file the last one wins, as in Next.js."""
    f = REPO_DIR / ".env"
    if not f.exists():
        return
    values: dict[str, str] = {}
    for line in f.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    for k, v in values.items():
        os.environ.setdefault(k, v)


_load_env()

RANKING_VERSION = "0.1"

# Fit label thresholds (cosine similarity from all-MiniLM-L6-v2; unrelated text is usually < 0.3)
SEMANTIC_GOOD = 0.35       # below this, a rule-clean match is capped at Possible fit
SEMANTIC_POSSIBLE = 0.40   # when a bid has no usable categories, at least this much to call it Possible fit (vague text scored 0.31)
MIN_COMPLETENESS = 0.6     # below this share of scored weight, the result is Needs review

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")  # server only; needed to write vectors

BIDS_SOURCE = os.environ.get("BIDS_SOURCE", "supabase")          # "supabase" or "mock" (data/mock/bids.json)
AUTH_MODE = os.environ.get("AUTH_MODE", "enforce")                # "enforce" (signed session cookie) or "disabled" (dev only)
SESSION_SECRET = os.environ.get("SESSION_SECRET", "")             # signs the session cookie; if unset, a random one is used per start
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "7"))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"   # true once served over HTTPS
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
MAX_BIDS_PER_REQUEST = 300
