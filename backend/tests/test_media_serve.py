"""Regression tests for the ``GET /api/media/{user}/{filename}`` access
rules.

Profile photos are public (advertised via /api/browse), so HTML ``<img>``
tags must be able to load them without any credentials — otherwise iOS
Safari (which refuses to send our cross-site cookie under ITP) shows a
broken-image square on the profile / chats / likes / matches lists.

Chat attachments and other non-profile media still require auth, but
must also accept the JWT via ``?token=...`` since HTML media tags can't
attach an ``Authorization`` header.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import UPLOAD_DIR
from app.db.models import Photo, User
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import register_user


async def _register_with_profile_photo(client: AsyncClient, db: AsyncSession) -> tuple[int, str]:
    """Register a user and attach a real profile photo on disk + in DB."""
    data = await register_user(client, email="owner@test.com", username="owner")
    user_id = int(data["user"]["user_id"])
    # Write a tiny on-disk file directly — store_upload would also work
    # but we want to keep this test focused on the serve endpoint.
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = "abc-profile.jpg"
    (user_dir / filename).write_bytes(b"\xff\xd8\xff\xe0fake-jpeg")
    db.add(Photo(user_id=user_id, filename=filename, mime_type="image/jpeg", kind="photo"))
    await db.commit()
    return user_id, filename


@pytest.mark.asyncio
async def test_profile_photo_is_public(client: AsyncClient, db: AsyncSession):
    """No cookie, no Authorization header — profile photo still 200s."""
    user_id, filename = await _register_with_profile_photo(client, db)
    client.cookies.clear()
    resp = await client.get(f"/api/media/{user_id}/{filename}")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("image/jpeg")


@pytest.mark.asyncio
async def test_non_profile_media_requires_auth(client: AsyncClient, db: AsyncSession):
    """A file that's NOT registered as a profile photo (chat attachment,
    say) must reject unauthenticated requests with 401."""
    data = await register_user(client, email="attach@test.com", username="attach")
    user_id = int(data["user"]["user_id"])
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = "chat-only.jpg"
    (user_dir / filename).write_bytes(b"\xff\xd8\xff\xe0fake")
    # Note: NOT inserted into Photo table — so it's a non-profile asset.
    client.cookies.clear()
    resp = await client.get(f"/api/media/{user_id}/{filename}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_non_profile_media_accepts_token_query_param(client: AsyncClient, db: AsyncSession):
    """Owner can load their own non-profile asset via ``?token=...``."""
    data = await register_user(client, email="qs@test.com", username="qs")
    token = data["token"]
    user_id = int(data["user"]["user_id"])
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = "qs-chat.jpg"
    (user_dir / filename).write_bytes(b"\xff\xd8\xff\xe0fake")
    client.cookies.clear()
    # No cookie, no Authorization header, no DB Photo row → access only
    # via ``?token=``.
    resp = await client.get(f"/api/media/{user_id}/{filename}?token={token}")
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_non_profile_media_other_user_forbidden(client: AsyncClient, db: AsyncSession):
    """A logged-in viewer who isn't matched and isn't admin must NOT be
    able to see another user's non-profile asset."""
    owner_data = await register_user(client, email="owner2@test.com", username="owner2")
    owner_id = int(owner_data["user"]["user_id"])
    user_dir = UPLOAD_DIR / str(owner_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = "private.jpg"
    (user_dir / filename).write_bytes(b"\xff\xd8\xff\xe0fake")
    # Now register a second user — they become the authenticated viewer.
    client.cookies.clear()
    viewer = await register_user(client, email="viewer@test.com", username="viewer")
    viewer_token = viewer["token"]
    resp = await client.get(
        f"/api/media/{owner_id}/{filename}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_banned_user_token_does_not_unlock_media(client: AsyncClient, db: AsyncSession):
    """Even with a valid JWT, a banned/deleted user must not be treated
    as logged-in for media access."""
    data = await register_user(client, email="banned@test.com", username="bannedu")
    token = data["token"]
    user_id = int(data["user"]["user_id"])
    # Mark the user as banned directly.
    user = await db.scalar(select(User).where(User.id == user_id))
    assert user is not None
    user.banned = True
    await db.commit()
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = "banned-private.jpg"
    (user_dir / filename).write_bytes(b"\xff\xd8\xff\xe0fake")
    client.cookies.clear()
    resp = await client.get(f"/api/media/{user_id}/{filename}?token={token}")
    # Banned viewer = no viewer = 401 on non-profile media.
    assert resp.status_code == 401
