"""Conversation + messages REST."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


async def _two_matched_users(client: AsyncClient) -> tuple[str, str, int, int, int]:
    await register_user(
        client, email="a@test.com", name="A", gender="Парень", looking_for="Девушки"
    )
    cookie_a = client.cookies.get("match57_session")
    await client.post("/api/auth/logout")
    await register_user(client, email="b@test.com", name="B", gender="Девушка", looking_for="Парни")
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
async def test_send_text(client: AsyncClient):
    cookie_a, cookie_b, a_id, b_id, conv_id = await _two_matched_users(client)

    resp = await client.post(
        "/api/messages/send",
        json={"conversation_id": conv_id, "body": "Hello!"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["message"]["body"] == "Hello!"

    # B reads.
    client.cookies.set("match57_session", cookie_b)
    resp = await client.get(f"/api/conversations/{conv_id}/messages")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["body"] == "Hello!"
    assert items[0]["is_mine"] is False


@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient):
    cookie_a, cookie_b, a_id, b_id, conv_id = await _two_matched_users(client)

    # A sends 2 messages.
    await client.post("/api/messages/send", json={"conversation_id": conv_id, "body": "1"})
    await client.post("/api/messages/send", json={"conversation_id": conv_id, "body": "2"})

    # B sees 2 unread.
    client.cookies.set("match57_session", cookie_b)
    resp = await client.get("/api/conversations")
    convs = resp.json()["items"]
    assert len(convs) == 1
    assert convs[0]["unread_count"] == 2

    # B marks read.
    resp = await client.post(f"/api/conversations/{conv_id}/read")
    assert resp.status_code == 200
    assert resp.json()["marked"] == 2

    # Unread = 0.
    resp = await client.get("/api/conversations")
    assert resp.json()["items"][0]["unread_count"] == 0


@pytest.mark.asyncio
async def test_react(client: AsyncClient):
    cookie_a, cookie_b, a_id, b_id, conv_id = await _two_matched_users(client)
    msg = (
        await client.post("/api/messages/send", json={"conversation_id": conv_id, "body": "yo"})
    ).json()["message"]
    msg_id = msg["id"]

    client.cookies.set("match57_session", cookie_b)
    resp = await client.post(f"/api/messages/{msg_id}/react", json={"emoji": "❤️"})
    assert resp.status_code == 200
    assert resp.json()["removed"] is False

    history = (await client.get(f"/api/conversations/{conv_id}/messages")).json()
    assert history["items"][0]["reactions"][0]["emoji"] == "❤️"

    # Toggle off.
    resp = await client.post(f"/api/messages/{msg_id}/react", json={"emoji": "❤️"})
    assert resp.json()["removed"] is True


@pytest.mark.asyncio
async def test_non_matched_cannot_message(client: AsyncClient):
    await register_user(client, email="a@test.com", name="A")
    cookie_a = client.cookies.get("match57_session")
    await client.post("/api/auth/logout")
    await register_user(client, email="b@test.com", name="B")
    b_resp = (await client.get("/api/auth/me")).json()
    b_id = b_resp["user"]["user_id"]
    client.cookies.set("match57_session", cookie_a)

    # No match → no convo.
    resp = await client.get(f"/api/messages/with/{b_id}")
    assert resp.status_code == 403
