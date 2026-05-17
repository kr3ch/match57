"""Block/unblock + send-gating between matched users."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


async def _two_matched_users(client: AsyncClient) -> tuple[str, str, int, int, int]:
    """Mirror tests/test_messaging.py::_two_matched_users."""
    await register_user(
        client, email="a@test.com", name="A", gender="Парень", looking_for="Девушки"
    )
    cookie_a = client.cookies.get("match57_session")
    await client.post("/api/auth/logout")
    await register_user(
        client, email="b@test.com", name="B", gender="Девушка", looking_for="Парни"
    )
    cookie_b = client.cookies.get("match57_session")

    items = (await client.get("/api/browse")).json()["items"]
    a_id = [i for i in items if i["name"] == "A"][0]["user_id"]
    await client.post("/api/likes", json={"target_id": a_id})

    client.cookies.set("match57_session", cookie_a)
    items = (await client.get("/api/browse")).json()["items"]
    b_id = [i for i in items if i["name"] == "B"][0]["user_id"]
    res = (await client.post("/api/likes", json={"target_id": b_id})).json()
    conv_id = res["conversation_id"]
    return cookie_a, cookie_b, a_id, b_id, conv_id


@pytest.mark.asyncio
async def test_block_unblock_roundtrip(client: AsyncClient):
    cookie_a, cookie_b, a_id, b_id, _conv_id = await _two_matched_users(client)

    # A blocks B.
    r = await client.post(f"/api/users/{b_id}/block")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["i_blocked"] is True
    assert data["they_blocked"] is False

    # Idempotent: re-blocking returns ok+created=False.
    r = await client.post(f"/api/users/{b_id}/block")
    assert r.status_code == 200
    assert r.json()["created"] is False

    # GET status from A's side.
    r = await client.get(f"/api/users/{b_id}/block")
    assert r.json() == {"i_blocked": True, "they_blocked": False}

    # B sees they_blocked=True from B's perspective.
    client.cookies.set("match57_session", cookie_b)
    r = await client.get(f"/api/users/{a_id}/block")
    assert r.json() == {"i_blocked": False, "they_blocked": True}

    # Unblock from A's side.
    client.cookies.set("match57_session", cookie_a)
    r = await client.delete(f"/api/users/{b_id}/block")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "removed": True, "i_blocked": False, "they_blocked": False}


@pytest.mark.asyncio
async def test_blocked_pair_cannot_send(client: AsyncClient):
    cookie_a, cookie_b, _a_id, b_id, conv_id = await _two_matched_users(client)

    # Verify send works pre-block.
    r = await client.post(
        "/api/messages/send", json={"conversation_id": conv_id, "body": "hi"}
    )
    assert r.status_code == 200

    # A blocks B.
    r = await client.post(f"/api/users/{b_id}/block")
    assert r.status_code == 200

    # A cannot send to B.
    r = await client.post(
        "/api/messages/send", json={"conversation_id": conv_id, "body": "still there?"}
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "chat_blocked"

    # B cannot send to A either — block is symmetric for gating.
    client.cookies.set("match57_session", cookie_b)
    r = await client.post(
        "/api/messages/send", json={"conversation_id": conv_id, "body": "let me back in"}
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "chat_blocked"


@pytest.mark.asyncio
async def test_block_status_exposed_in_conversation(client: AsyncClient):
    cookie_a, cookie_b, _a_id, b_id, conv_id = await _two_matched_users(client)

    r = await client.post(f"/api/users/{b_id}/block")
    assert r.status_code == 200

    r = await client.get(f"/api/conversations/{conv_id}")
    assert r.status_code == 200
    conv = r.json()["conversation"]
    assert conv["i_blocked"] is True
    assert conv["they_blocked"] is False

    # B sees the mirror.
    client.cookies.set("match57_session", cookie_b)
    r = await client.get(f"/api/conversations/{conv_id}")
    conv = r.json()["conversation"]
    assert conv["i_blocked"] is False
    assert conv["they_blocked"] is True


@pytest.mark.asyncio
async def test_cannot_block_self(client: AsyncClient):
    data = await register_user(
        client, email="solo@test.com", name="S", gender="Парень", looking_for="Девушки"
    )
    my_id = int(data["user"]["user_id"])
    r = await client.post(f"/api/users/{my_id}/block")
    assert r.status_code == 400
