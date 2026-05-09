"""Telegram media proxy.

Images and videos in user profiles are stored as Telegram ``file_id``s. To
render them in the browser we stream the bytes server-side via
``Bot.get_file`` + ``download_file``.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.bot_client import fetch_file_bytes, fetch_file_path

router = APIRouter(prefix="/api/media", tags=["media"])

_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".m4a": "audio/mp4",
}


def _mime_for(path: str | None) -> str:
    if not path:
        return "application/octet-stream"
    p = path.lower()
    for ext, mime in _MIME_BY_EXT.items():
        if p.endswith(ext):
            return mime
    return "application/octet-stream"


_cache: dict[str, tuple[bytes, str]] = {}
_lock = asyncio.Lock()
_MAX_CACHED = 200


@router.get("/{file_id}")
async def get_media(file_id: str) -> Response:
    if not file_id or len(file_id) > 200:
        raise HTTPException(status_code=400, detail="bad_file_id")
    async with _lock:
        cached = _cache.get(file_id)
    if cached is not None:
        data, mime = cached
        return Response(content=data, media_type=mime)

    file_path = await fetch_file_path(file_id)
    if file_path is None:
        raise HTTPException(status_code=502, detail="telegram_unavailable")
    raw = await fetch_file_bytes(file_id)
    if raw is None:
        raise HTTPException(status_code=502, detail="telegram_unavailable")
    mime = _mime_for(file_path)
    async with _lock:
        if len(_cache) >= _MAX_CACHED:
            _cache.clear()
        _cache[file_id] = (raw, mime)
    return Response(content=raw, media_type=mime)
