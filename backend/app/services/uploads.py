"""Local-disk upload pipeline.

Validates MIME, writes ``<UPLOAD_DIR>/<user_id>/<uuid>.<ext>`` and returns a
metadata dict (filename = ``<uuid>.<ext>``, mime, size, optional duration_ms,
width, height for images).
"""

from __future__ import annotations

import asyncio
import io
import uuid
from pathlib import Path
from typing import Any

import aiofiles
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import (
    ALLOWED_AUDIO_MIMES,
    ALLOWED_FILE_MIMES,
    ALLOWED_IMAGE_MIMES,
    ALLOWED_MEDIA_MIMES,
    ALLOWED_VIDEO_MIMES,
    MAX_UPLOAD_MB,
    UPLOAD_DIR,
)

MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/webm": ".webm",
    "video/mp4": ".mp4",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/zip": ".zip",
}


def _classify(mime: str) -> str:
    if mime in ALLOWED_IMAGE_MIMES:
        return "photo"
    if mime in ALLOWED_VIDEO_MIMES:
        return "video"
    if mime in ALLOWED_AUDIO_MIMES:
        return "voice"
    if mime in ALLOWED_FILE_MIMES:
        return "file"
    return "file"


def _sniff_image_size(data: bytes) -> tuple[int | None, int | None]:
    try:
        with Image.open(io.BytesIO(data)) as im:
            return im.size  # (w, h)
    except (UnidentifiedImageError, OSError):
        return (None, None)


def _resize_image(data: bytes, mime: str, max_side: int = 1600, quality: int = 82) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.thumbnail((max_side, max_side))
            buf = io.BytesIO()
            fmt = "WEBP" if mime == "image/webp" else "JPEG" if mime == "image/jpeg" else "PNG"
            save_kwargs: dict[str, Any] = {}
            if fmt in ("WEBP", "JPEG"):
                save_kwargs["quality"] = quality
                save_kwargs["optimize"] = True
            saving = im if not (fmt == "JPEG" and im.mode != "RGB") else im.convert("RGB")
            saving.save(buf, format=fmt, **save_kwargs)
            return buf.getvalue()
    except (UnidentifiedImageError, OSError):
        return data


async def store_upload(file: UploadFile, user_id: int) -> dict[str, Any]:
    """Validate the upload + write it to disk under the user's folder."""
    if file.content_type not in ALLOWED_MEDIA_MIMES:
        raise HTTPException(status_code=415, detail=f"unsupported_mime:{file.content_type}")
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    if not raw:
        raise HTTPException(status_code=400, detail="empty_file")

    mime = file.content_type
    kind = _classify(mime)

    width: int | None = None
    height: int | None = None

    if kind == "photo":
        # Resize down + sniff dimensions.
        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(None, _resize_image, raw, mime)
        width, height = await loop.run_in_executor(None, _sniff_image_size, raw)

    ext = EXT_BY_MIME.get(mime, "")
    filename = f"{uuid.uuid4().hex}{ext}"
    user_dir: Path = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    target = user_dir / filename

    async with aiofiles.open(target, "wb") as fh:
        await fh.write(raw)

    return {
        "filename": filename,
        "user_id": user_id,
        "mime": mime,
        "kind": kind,
        "size": len(raw),
        "width": width,
        "height": height,
    }


def upload_path(user_id: int, filename: str) -> Path:
    """Path on disk for a previously stored upload."""
    return UPLOAD_DIR / str(user_id) / filename


__all__ = ["store_upload", "upload_path"]
