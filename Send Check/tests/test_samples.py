"""The page loads each example's own guest or customer list by name."""
from fastapi.testclient import TestClient

from web.app import app

client = TestClient(app)


def test_default_sample_is_the_cascade_list():
    r = client.get("/api/sample_csv")
    assert r.status_code == 200
    assert r.text.splitlines()[0].startswith("customer_id")


def test_saltwind_guest_list_loads_by_name():
    r = client.get("/api/sample_csv", params={"name": "saltwind"})
    assert r.status_code == 200
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("guest_id")
    assert len(lines) == 521  # header + 520 synthetic guests


def test_sample_names_are_a_fixed_list_not_paths():
    for bad in ("../../.env", "/etc/passwd", "nope"):
        assert client.get("/api/sample_csv", params={"name": bad}).status_code == 404
