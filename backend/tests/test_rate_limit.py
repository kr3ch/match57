"""Rate-limit middleware: bucket per user, idempotent endpoint exemptions."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.middleware import _last_seen
from tests.conftest import register_user


@pytest_asyncio.fixture
async def live_rl_client(app):
    """Like the shared ``client`` fixture, but with rate-limiting *enabled*.

    The shared fixture disables the middleware via ``PYTEST_CURRENT_TEST``.
    We need it on here to exercise the bucket / exempt-path logic.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # Flip the kill-switch off for this test, restore after.
        prev = os.environ.pop("PYTEST_CURRENT_TEST", None)
        _last_seen.clear()
        try:
            yield c
        finally:
            if prev is not None:
                os.environ["PYTEST_CURRENT_TEST"] = prev


async def _matched_pair(client: AsyncClient) -> int:
    """Register two users that match each other, return conversation_id."""
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
    a_id = next(i for i in items if i["name"] == "A")["user_id"]
    await client.post("/api/likes", json={"target_id": a_id})

    client.cookies.set("match57_session", cookie_a)
    items = (await client.get("/api/browse")).json()["items"]
    b_id = next(i for i in items if i["name"] == "B")["user_id"]
    res = (await client.post("/api/likes", json={"target_id": b_id})).json()
    # Switch to B and keep the conv_id for caller convenience.
    client.cookies.set("match57_session", cookie_b)
    return int(res["conversation_id"])


@pytest.mark.asyncio
async def test_mark_read_is_exempt_from_rate_limit(live_rl_client: AsyncClient):
    """Hammering /read in a tight loop must never 429.

    This is the regression that was producing the 429 wall in production —
    the chat page coalesces mark-read but visibility/focus/typing events can
    still fire it rapidly.
    """
    conv_id = await _matched_pair(live_rl_client)
    # Burst of 10 mark-read POSTs back-to-back. Pre-fix this would 429 after
    # the first one.
    for _ in range(10):
        resp = await live_rl_client.post(f"/api/conversations/{conv_id}/read")
        assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_react_is_exempt_from_rate_limit(live_rl_client: AsyncClient):
    """Reaction toggle is also high-frequency (emoji picker) and idempotent."""
    conv_id = await _matched_pair(live_rl_client)
    # B sends so A can react — switch to A first.
    msg = (
        await live_rl_client.post(
            "/api/messages/send",
            json={"conversation_id": conv_id, "body": "hi"},
        )
    ).json()["message"]
    # Reaction burst (toggle on/off rapidly).
    for _ in range(6):
        resp = await live_rl_client.post(
            f"/api/messages/{msg['id']}/react", json={"emoji": "❤️"}
        )
        assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_two_users_share_no_bucket(live_rl_client: AsyncClient):
    """Two authenticated users behind the same IP must not 429 each other.

    Pre-fix the bucket was per-IP, so a school NAT meant every classmate
    competed for the same 0.7s slot. New behaviour is per-user.
    """
    conv_id = await _matched_pair(live_rl_client)
    # Currently logged in as B. Send a message → 200.
    resp = await live_rl_client.post(
        "/api/messages/send",
        json={"conversation_id": conv_id, "body": "from b"},
    )
    assert resp.status_code == 200, resp.text

    # Switch session cookie to A and send immediately. Different user → no
    # shared bucket → 200 even though < 0.7s elapsed.
    live_rl_client.cookies.clear()
    resp = await live_rl_client.post(
        "/api/auth/login",
        json={"username": "a", "password": "Test1234!"},
    )
    assert resp.status_code == 200, resp.text
    resp = await live_rl_client.post(
        "/api/messages/send",
        json={"conversation_id": conv_id, "body": "from a"},
    )
    assert resp.status_code == 200, resp.text
