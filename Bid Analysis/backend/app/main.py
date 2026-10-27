"""Run from backend/:  uvicorn app.main:app --reload --port 8000"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, errors
from .embeddings import AiUnavailable, embed
from .routes import auth, matches, me, profile

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        embed(["warm up"])          # load the model now; the first load takes ~12 s
        log.info("embedding model ready")
    except AiUnavailable as e:
        log.error("embedding model failed to load: %s", e)
    if config.AUTH_MODE == "disabled":
        log.warning("AUTH_MODE=disabled: every request is accepted as a dev user. Do not deploy like this.")
    yield


app = FastAPI(title="Bid-Analytics matching service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,      # explicit origins: required for cookie sessions (credentials: include)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
errors.install(app)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(me.router)
app.include_router(matches.router)


@app.get("/health")
def health():
    return {"ok": True}
