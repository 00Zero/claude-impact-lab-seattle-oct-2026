"""Web app hardening: no public API docs, security headers, empty drafts refused."""
from fastapi.testclient import TestClient

from web.app import app

client = TestClient(app)


def test_page_loads_with_security_headers():
    r = client.get("/")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "max-age" in r.headers["strict-transport-security"]


def test_api_docs_are_not_public():
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_icons_are_served_at_the_root():
    for path in ("/favicon.ico", "/favicon-32.png", "/apple-touch-icon.png"):
        assert client.get(path).status_code == 200


def test_empty_draft_is_refused_not_scored():
    r = client.post("/api/score", json={"text": "   "})
    assert r.status_code == 400
    assert "Paste the email" in r.json()["detail"]
    r = client.post("/api/score_list", json={"text": "", "segments": [{"label": "a"}]})
    assert r.status_code == 400
