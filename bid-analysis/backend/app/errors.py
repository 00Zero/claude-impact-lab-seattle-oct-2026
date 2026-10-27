"""One error type for routes, plus handlers that turn every failure into the frontend's { error: {...} } envelope."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import BidNotFound, RevisionConflict, StorageUnavailable, UserNotFound
from .embeddings import AiUnavailable
from .models import ApiError, ErrorCode, ErrorResponse

log = logging.getLogger("api")


class ApiException(Exception):
    def __init__(self, status: int, code: ErrorCode, message: str, retryable: bool = False):
        self.status, self.error = status, ApiError(code=code, message=message, retryable=retryable)


def _resp(status: int, code: ErrorCode, message: str, retryable: bool = False) -> JSONResponse:
    return JSONResponse(status_code=status, content=ErrorResponse(error=ApiError(code=code, message=message, retryable=retryable)).model_dump(mode="json"))


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiException)
    async def _api(_: Request, e: ApiException):
        return JSONResponse(status_code=e.status, content=ErrorResponse(error=e.error).model_dump(mode="json"))

    @app.exception_handler(AiUnavailable)
    async def _ai(_: Request, e: AiUnavailable):
        log.warning("ai unavailable: %s", e)
        return _resp(503, "ai_unavailable", "The matching service is temporarily unavailable. Try again shortly.", True)

    @app.exception_handler(StorageUnavailable)
    async def _storage(_: Request, e: StorageUnavailable):
        log.warning("storage unavailable: %s", e)
        return _resp(503, "source_unavailable", "The data service is unavailable right now.", True)

    @app.exception_handler(UserNotFound)
    async def _user_missing(_: Request, e: UserNotFound):
        return _resp(404, "not_found", "That account no longer exists.")

    @app.exception_handler(RevisionConflict)
    async def _conflict(_: Request, e: RevisionConflict):
        return _resp(409, "revision_conflict", "Your profile changed. Refresh and try again.")

    @app.exception_handler(BidNotFound)
    async def _no_bid(_: Request, e: BidNotFound):
        return _resp(404, "not_found", "That opportunity no longer exists.")

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):
        first = e.errors()[0] if e.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        return _resp(400, "invalid_input", f"Invalid request{': ' + where if where else ''}.")

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        code = {401: "unauthenticated", 403: "forbidden", 404: "not_found", 429: "rate_limited"}.get(e.status_code, "internal_error")
        return _resp(e.status_code, code, "Request failed.", e.status_code >= 500)

    @app.exception_handler(Exception)
    async def _any(_: Request, e: Exception):
        log.exception("unhandled error")           # details stay in the server log, never in the response
        return _resp(500, "internal_error", "Something went wrong on our side.", True)
