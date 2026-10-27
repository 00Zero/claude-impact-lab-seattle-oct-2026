"""Send Check web page: fill in the recipient and the draft, get a scorecard.

Run: uv run uvicorn web.app:app --reload   (or: uv run python -m web.app)
"""
from __future__ import annotations

import base64
from dataclasses import asdict
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from pydantic import BaseModel

from scorers.autosegment import autosegment, xlsx_to_csv
from scorers.base import Draft, Recipient
from scorers.env import load_env
from scorers.naive.combine import NaiveBackend
from scorers.segments import Segment, score_segments
from scorers.website import WebsiteError, fetch_text

PAGE = Path(__file__).resolve().parent / "static" / "index.html"
ICON = Path(__file__).resolve().parents[1] / ".claude-plugin" / "icon.png"
DATA = Path(__file__).resolve().parents[1] / "corpus" / "fixtures" / "data"
# Sample guest and customer lists the page can load by name (fixed list, never a path).
SAMPLE_CSVS = {
    "cascade": DATA / "cascade-storage-customers.csv",
    "saltwind": DATA / "saltwind-tours-guests.csv",
}

load_env()
# No public API docs: the page is the only client.
app = FastAPI(title="Send Check", docs_url=None, redoc_url=None, openapi_url=None)
backend = NaiveBackend()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


def require_draft(text: str) -> None:
    if not text.strip():
        raise HTTPException(status_code=400, detail="Paste the email first, then check it.")


class RecipientIn(BaseModel):
    name: str = ""
    role: str = ""
    company: str = ""
    context: str = ""
    website: str = ""          # public company site, read on the server


MessageType = Literal["cold", "follow_up", "warm", "post_meeting", "customer"]


class SenderIn(BaseModel):
    """The sender's saved profile. Kept in the browser; sent with each check."""
    name: str = ""
    title: str = ""
    company: str = ""
    website: str = ""
    phone: str = ""
    email: str = ""
    signature: str = ""
    about: str = ""            # what they sell and results they can honestly cite

    def as_dict(self) -> dict | None:
        d = {k: v.strip() for k, v in self.model_dump().items() if v.strip()}
        return d or None


class ScoreRequest(BaseModel):
    text: str
    subject: str = ""
    channel: Literal["email", "linkedin", "other"] = "email"
    message_type: MessageType = "cold"
    recipient: RecipientIn = RecipientIn()
    owner_samples: list[str] = []
    sender: SenderIn = SenderIn()


class SegmentIn(BaseModel):
    label: str
    facts: str = ""
    size: int = 0


class ListRequest(BaseModel):
    text: str
    subject: str = ""
    channel: Literal["email", "linkedin", "other"] = "email"
    message_type: MessageType = "customer"
    segments: list[SegmentIn]
    owner_samples: list[str] = []
    sender: SenderIn = SenderIn()


class CsvRequest(BaseModel):
    csv_text: str = ""
    xlsx_base64: str = ""      # an Excel file, read on the server
    text: str
    subject: str = ""


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    return PAGE.read_text(encoding="utf-8")


STATIC = Path(__file__).resolve().parent / "static"


@app.get("/logo.png", include_in_schema=False)
@app.get("/favicon.png", include_in_schema=False)
def logo() -> FileResponse:
    return FileResponse(ICON, media_type="image/png")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    return FileResponse(STATIC / "favicon.ico", media_type="image/x-icon")


@app.get("/favicon-32.png", include_in_schema=False)
@app.get("/apple-touch-icon.png", include_in_schema=False)
def favicon_png(request: Request) -> FileResponse:
    return FileResponse(STATIC / request.url.path.lstrip("/"), media_type="image/png")


@app.get("/api/sample_csv", response_class=PlainTextResponse)
def sample_csv(name: str = "cascade") -> str:
    path = SAMPLE_CSVS.get(name)
    if path is None:
        raise HTTPException(status_code=404, detail="no such sample list")
    return path.read_text(encoding="utf-8")


@app.post("/api/segment_csv")
def segment_csv(req: CsvRequest) -> dict:
    if not req.text.strip():
        raise HTTPException(400, "paste the draft first: segments depend on what you are sending")
    try:
        csv_text = req.csv_text
        if req.xlsx_base64:
            try:
                csv_text = xlsx_to_csv(base64.b64decode(req.xlsx_base64))
            except Exception:
                raise ValueError("couldn't read that Excel file; try saving it as CSV")
        if not csv_text.strip():
            raise ValueError("the file is empty")
        return asdict(autosegment(csv_text, req.text, req.subject))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"could not propose segments: {e}")


class SiteRequest(BaseModel):
    url: str


@app.post("/api/fetch_site")
def fetch_site(req: SiteRequest) -> dict:
    try:
        page = fetch_text(req.url)
    except WebsiteError as e:
        raise HTTPException(400, str(e))
    return {"url": page["url"], "title": page["title"], "chars": len(page["text"]),
            "preview": page["text"][:300]}


@app.post("/api/score")
def score(req: ScoreRequest) -> dict:
    require_draft(req.text)
    r = req.recipient
    context, site_note = r.context, ""
    if r.website.strip():
        try:
            page = fetch_text(r.website)
            context = (f"{context}\n\nFrom their company website ({page['url']}, "
                       f"\"{page['title']}\"): {page['text']}").strip()
        except WebsiteError as e:
            site_note = f"company website not used: {e}"
    card = backend.score(
        Draft(text=req.text, channel=req.channel, subject=req.subject),
        Recipient(name=r.name, role=r.role, company=r.company, context=context,
                  source_url=r.website.strip()),
        message_type=req.message_type,
        owner_samples=[s for s in req.owner_samples if s.strip()],
        sender=req.sender.as_dict(),
    )
    if site_note:
        card.notes = " | ".join(n for n in (site_note, card.notes) if n)
    return asdict(card)


@app.post("/api/score_list")
def score_list(req: ListRequest) -> dict:
    require_draft(req.text)
    result = score_segments(
        backend,
        Draft(text=req.text, channel=req.channel, subject=req.subject),
        [Segment(**s.model_dump()) for s in req.segments],
        message_type=req.message_type,
        owner_samples=[s for s in req.owner_samples if s.strip()],
        sender=req.sender.as_dict(),
        audience="segment",
    )
    return asdict(result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
