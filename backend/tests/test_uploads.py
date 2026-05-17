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
async def test_upload_arbitrary_file_accepted_as_generic_kind(client: AsyncClient):
    """Any non-media file is accepted now and stored as ``kind=file`` so chat
    attachments can be GIFs, .docx, .zip, .pages, etc. without the user
    hitting a confusing 415. Validation is size-only for the generic kind."""
    await register_user(client, email="bad@test.com", username="baduser")
    resp = await client.post(
        "/api/media/upload",
        files={"file": ("weird.xyz", b"junk", "application/octet-stream")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "file"
    assert data["filename"].endswith(".xyz")


@pytest.mark.asyncio
async def test_upload_docx_accepted(client: AsyncClient):
    """Whitelisted office MIMEs are recognised explicitly and still routed
    through the generic ``file`` kind (so they render as download links)."""
    await register_user(client, email="docuser@test.com", username="docuser")
    resp = await client.post(
        "/api/media/upload",
        files={
            "file": (
                "report.docx",
                b"PK\x03\x04fake",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "file"
    assert data["filename"].endswith(".docx")


@pytest.mark.asyncio
async def test_upload_gif_accepted_as_file_not_resized(client: AsyncClient):
    """``image/gif`` is intentionally NOT in ALLOWED_IMAGE_MIMES so PIL never
    touches it (which would kill animation). It ends up as ``kind=file`` and
    the frontend renders it inline based on the MIME."""
    await register_user(client, email="gifuser@test.com", username="gifuser")
    resp = await client.post(
        "/api/media/upload",
        files={"file": ("anim.gif", b"GIF89a fake bytes", "image/gif")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["kind"] == "file"
    assert data["mime"] == "image/gif"
