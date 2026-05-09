"""Smoke tests for the FastAPI surface."""

from __future__ import annotations

from tests.conftest import authed_client


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_register_and_me(client):
    c = authed_client(client, 100, username="hundred")
    r = c.get("/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["registered"] is False
    payload = {
        "age": 18,
        "gender": "Парень",
        "looking_for": "Все равно",
        "name": "Test",
        "description": "hello",
        "photos": [{"type": "photo", "file_id": "abc"}],
        "phone": "+71234567890",
    }
    r = c.post("/api/register", json=payload)
    assert r.status_code == 200, r.text
    r = c.get("/api/me")
    assert r.status_code == 200
    assert r.json()["name"] == "Test"


def test_browse_and_like(client):
    c = authed_client(client, 100, username="a")
    c.post(
        "/api/register",
        json={
            "age": 18,
            "gender": "Парень",
            "looking_for": "Все равно",
            "name": "A",
            "description": "",
            "photos": [{"type": "photo", "file_id": "f"}],
            "phone": "+71000000001",
        },
    )

    # Switch identity to a second user
    c2 = authed_client(client, 200, username="b")
    r2 = c2.post(
        "/api/register",
        json={
            "age": 18,
            "gender": "Девушка",
            "looking_for": "Все равно",
            "name": "B",
            "description": "",
            "photos": [{"type": "photo", "file_id": "f"}],
            "phone": "+71000000002",
        },
    )
    assert r2.status_code == 200, r2.text

    # Back to user 100
    c = authed_client(client, 100)
    r = c.get("/api/browse/next")
    assert r.status_code == 200
    assert r.json()["profile"]["user_id"] == 200
    r = c.post("/api/browse/like", json={"target_user_id": 200})
    assert r.status_code == 200
    assert r.json()["match"] is False

    # User 200 likes back -> match
    c2 = authed_client(client, 200)
    r = c2.post("/api/browse/like", json={"target_user_id": 100})
    assert r.status_code == 200
    assert r.json()["match"] is True
    assert r.json()["contact"]


def test_admin_guard(client):
    c = authed_client(client, 999)  # not in ADMIN_IDS=[1]
    r = c.get("/api/admin/stats")
    assert r.status_code == 403
    c = authed_client(client, 1)
    r = c.get("/api/admin/stats")
    assert r.status_code == 200
