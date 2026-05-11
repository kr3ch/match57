"""Regression tests for the upload allow-list.

iPhone Safari (and a number of Android browsers) hand the server .mov
videos and .m4a voice memos either with an unhelpful
``application/octet-stream`` Content-Type or with the
QuickTime-specific ``video/quicktime`` MIME. The original whitelist only
permitted ``video/webm`` and ``video/mp4``, so these uploads 415'd in
production. These tests pin the supported surface so we don't regress.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import register_user


@pytest.mark.asyncio
async def test_upload_mov_with_quicktime_mime(client: AsyncClient):
    await register_user(client, email="movuser@test.com", username="movuser")
    resp = await client.post(
        "/api/media/upload",
        files={"file": ("clip.mov", b"\x00\x00\x00\x14ftypqt  fake bytes", "video/quicktime")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "video"
    assert data["mime"] == "video/quicktime"
    assert data["filename"].endswith(".mov")


@pytest.mark.asyncio
async def test_upload_mov_with_octet_stream_falls_back_to_filename(client: AsyncClient):
    """Some browsers report .mov as application/octet-stream — we should
    sniff the filename extension and accept it anyway."""
    await register_user(client, email="movuser2@test.com", username="movuser2")
    resp = await client.post(
        "/api/media/upload",
        files={
            "file": (
                "trip.MOV",
                b"\x00\x00\x00\x14ftypqt  fake bytes",
                "application/octet-stream",
            )
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "video"
    assert data["filename"].endswith(".mov")


@pytest.mark.asyncio
async def test_upload_m4a_voice_memo(client: AsyncClient):
    await register_user(client, email="voiceuser@test.com", username="voiceuser")
    resp = await client.post(
        "/api/media/upload",
        files={"file": ("voice.m4a", b"\x00" * 64, "audio/mp4")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "voice"
    assert data["filename"].endswith(".m4a")


@pytest.mark.asyncio
async def test_upload_truly_unsupported_still_rejected(client: AsyncClient):
    """Random binary with no known extension still 415s — we don't want to
    accidentally accept arbitrary uploads."""
    await register_user(client, email="bad@test.com", username="baduser")
    resp = await client.post(
        "/api/media/upload",
        files={"file": ("weird.xyz", b"junk", "application/octet-stream")},
    )
    assert resp.status_code == 415
