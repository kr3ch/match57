"""Auth endpoints: register, login, logout, me, email-verify."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


@pytest.mark.asyncio
async def test_register_ok(client: AsyncClient):
    data = await register_user(client)
    assert data["ok"] is True
    assert data["user"]["name"] == "Test"
    assert data["user"]["age"] == 17
    assert data["user"]["gender"] == "Парень"


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await register_user(client)
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": "test",
            "password": "Test1234!",
            "name": "Another",
            "age": 18,
            "gender": "Парень",
            "looking_for": "Все равно",
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_ok(client: AsyncClient):
    await register_user(client)
    resp = await client.post(
        "/api/auth/login",
        json={"username": "test", "password": "Test1234!"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_login_bad_password(client: AsyncClient):
    await register_user(client)
    resp = await client.post(
        "/api/auth/login",
        json={"username": "test", "password": "wrong"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_ok(client: AsyncClient):
    await register_user(client)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user"]["name"] == "Test"


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    await register_user(client)
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    resp2 = await client.get("/api/auth/me")
    assert resp2.status_code == 401


@pytest.mark.asyncio
async def test_register_returns_token(client: AsyncClient):
    """register/login responses must surface the JWT so the frontend can
    fall back to ``Authorization: Bearer ...`` on browsers that block our
    cross-site cookie (iOS Safari ITP, embedded WebViews)."""
    data = await register_user(client)
    token = data.get("token")
    assert isinstance(token, str) and token.count(".") == 1


@pytest.mark.asyncio
async def test_bearer_token_authenticates_when_cookie_missing(client: AsyncClient):
    """The Bearer header alone (cookie jar cleared) must authenticate."""
    data = await register_user(client)
    token = data["token"]
    # Wipe any cookies the AsyncClient picked up so we prove the Bearer
    # token is what's authenticating us.
    client.cookies.clear()
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["user"]["name"] == "Test"


@pytest.mark.asyncio
async def test_bearer_with_bogus_token_is_401(client: AsyncClient):
    client.cookies.clear()
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401
