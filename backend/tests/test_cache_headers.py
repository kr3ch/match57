"""Regression tests for the NoSharedCacheMiddleware.

The middleware exists because Vercel's edge auto-injects
``Cache-Control: public, max-age=0, must-revalidate`` on rewritten API
responses that don't set their own ``Cache-Control``. With ``public`` and
no ``Cookie`` in ``Vary``, intermediate caches can store + replay
per-user responses across users — i.e. one user's ``/api/auth/me`` body
served to a different user on refresh. We stamp ``private, no-store``
ourselves to make sure that can never happen.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


@pytest.mark.asyncio
async def test_auth_me_is_private_no_store(client: AsyncClient):
    await register_user(client, email="cache@test.com", username="cacheme")
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    cc = resp.headers.get("cache-control", "")
    assert "private" in cc and "no-store" in cc, cc
    vary = resp.headers.get("vary", "")
    assert "cookie" in vary.lower(), vary


@pytest.mark.asyncio
async def test_register_is_private_no_store(client: AsyncClient):
    """Register sets a session cookie — that response must NEVER be cached
    by any shared cache, or another user's browser could be handed our
    Set-Cookie + JSON body."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": "regnocache",
            "password": "Test1234!",
            "name": "T",
            "age": 17,
            "gender": "Парень",
            "looking_for": "Все равно",
        },
    )
    assert resp.status_code == 200
    cc = resp.headers.get("cache-control", "")
    assert "private" in cc and "no-store" in cc, cc


@pytest.mark.asyncio
async def test_unauthenticated_401_is_private_no_store(client: AsyncClient):
    """Even error responses must not be shared-cached, since a cached 401
    served to an authenticated user would log them out."""
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    cc = resp.headers.get("cache-control", "")
    assert "private" in cc and "no-store" in cc, cc


@pytest.mark.asyncio
async def test_media_routes_keep_default_caching(client: AsyncClient):
    """``/api/media/*`` is exempt — the middleware leaves FileResponse's own
    caching headers alone. We can't easily exercise a real media file here,
    but we can assert that a 401 from the upload endpoint doesn't get
    stamped (the middleware skips ``/api/media/*`` entirely)."""
    resp = await client.post("/api/media/upload")
    # Without auth this is 401; without a multipart body it could be 422.
    # Either way, the path was skipped so our header should NOT be present.
    assert resp.headers.get("cache-control", "") != "private, no-store"
