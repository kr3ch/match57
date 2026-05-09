"""Browse + likes + match logic."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


@pytest.mark.asyncio
async def test_browse_empty(client: AsyncClient):
    await register_user(client)
    resp = await client.get("/api/browse")
    assert resp.status_code == 200
    assert resp.json()["items"] == []


@pytest.mark.asyncio
async def test_like_and_match(client: AsyncClient):
    # Register user A.
    await register_user(
        client, email="a@test.com", name="A", gender="Парень", looking_for="Девушки"
    )
    cookie_a = client.cookies.get("match57_session")
    await client.post("/api/auth/logout")

    # Register user B.
    await register_user(client, email="b@test.com", name="B", gender="Девушка", looking_for="Парни")
    cookie_b = client.cookies.get("match57_session")

    # B → browse → sees A.
    resp = await client.get("/api/browse")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(i["name"] == "A" for i in items)

    a_id = [i for i in items if i["name"] == "A"][0]["user_id"]

    # B likes A → no match yet (A hasn't liked B).
    resp = await client.post("/api/likes", json={"target_id": a_id})
    assert resp.status_code == 200
    assert resp.json()["matched"] is False

    # Switch to A.
    client.cookies.set("match57_session", cookie_a)

    # A browses → sees B.
    resp = await client.get("/api/browse")
    items = resp.json()["items"]
    assert any(i["name"] == "B" for i in items)
    b_id = [i for i in items if i["name"] == "B"][0]["user_id"]

    # A likes B → MATCH.
    resp = await client.post("/api/likes", json={"target_id": b_id})
    assert resp.status_code == 200
    assert resp.json()["matched"] is True
    assert resp.json()["conversation_id"] is not None

    # Matches list for A.
    resp = await client.get("/api/matches")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1

    # Switch back to B, also has 1 match.
    client.cookies.set("match57_session", cookie_b)
    resp = await client.get("/api/matches")
    assert len(resp.json()["items"]) == 1


@pytest.mark.asyncio
async def test_dislike_and_skipped(client: AsyncClient):
    await register_user(client, email="a@test.com", name="A", looking_for="Все равно")
    cookie_a = client.cookies.get("match57_session")
    await client.post("/api/auth/logout")
    await register_user(client, email="b@test.com", name="B", looking_for="Все равно")
    client.cookies.set("match57_session", cookie_a)

    items = (await client.get("/api/browse")).json()["items"]
    b_id = items[0]["user_id"]

    resp = await client.post("/api/dislikes", json={"target_id": b_id})
    assert resp.status_code == 200

    # Should not appear in browse anymore.
    items = (await client.get("/api/browse")).json()["items"]
    assert not any(i["user_id"] == b_id for i in items)

    # Should appear in /skipped.
    resp = await client.get("/api/skipped")
    assert any(i["user"]["user_id"] == b_id for i in resp.json()["items"])

    # Undo.
    resp = await client.post("/api/skipped/undo", json={"target_id": b_id})
    assert resp.status_code == 200

    # Back in browse.
    items = (await client.get("/api/browse")).json()["items"]
    assert any(i["user_id"] == b_id for i in items)
