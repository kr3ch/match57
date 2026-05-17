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
from PIL import Image, ImageOps, UnidentifiedImageError

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
    "video/quicktime": ".mov",
    "video/x-quicktime": ".mov",
    "video/x-m4v": ".m4v",
    "video/3gpp": ".3gp",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/x-wav": ".wav",
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
    """Resize a user-uploaded image with EXIF-correct orientation.

    iPhone (and most modern cameras) shoot in the sensor's native
    orientation and store the intended display rotation in an EXIF
    ``Orientation`` tag (values 1..8, covering 90/180/270 rotations and
    horizontal/vertical mirrors). Without ``exif_transpose`` the raw
    pixel data ends up rotated 90° or mirrored when displayed, because
    we then save the result without preserving EXIF (so browsers have
    nothing to undo the rotation with). Apply the transpose so the
    pixels themselves match the photographer's intent before we save.
    """
    try:
        with Image.open(io.BytesIO(data)) as im:
            # Bakes EXIF orientation into the pixel data (and returns a
            # copy whose EXIF tag has been reset to ``1``/no rotation).
            im = ImageOps.exif_transpose(im) or im
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


def _normalize_mime(raw: str | None) -> str:
    """Strip codec / charset parameters and lowercase.

    The browser MediaRecorder emits blobs whose ``type`` includes codec
    hints (e.g. ``video/webm;codecs=vp9,opus``). FastAPI surfaces this
    verbatim as ``UploadFile.content_type``, which then fails the
    membership check against ``ALLOWED_MEDIA_MIMES``. Strip everything
    after the first ``;`` so we compare apples to apples.
    """
    if not raw:
        return ""
    return raw.split(";", 1)[0].strip().lower()


# Filename-extension fallback for when the browser tells us either nothing
# (some iOS/Safari versions hand us files with no ``type``) or a too-generic
# ``application/octet-stream`` — common for ``.mov`` uploads from iPhone.
_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".3gp": "video/3gpp",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".zip": "application/zip",
}


def _mime_from_filename(name: str | None) -> str:
    if not name:
        return ""
    lower = name.lower()
    for ext, mime in _MIME_BY_EXT.items():
        if lower.endswith(ext):
            return mime
    return ""


async def store_upload(file: UploadFile, user_id: int) -> dict[str, Any]:
    """Validate the upload + write it to disk under the user's folder."""
    mime = _normalize_mime(file.content_type)
    # iPhone Safari + many desktop browsers hand us .mov files as
    # ``application/octet-stream`` or no MIME at all. Fall back to a
    # filename-extension lookup so the user-facing UX is "pick file → it
    # uploads" instead of a confusing 415.
    if mime not in ALLOWED_MEDIA_MIMES:
        fallback = _mime_from_filename(file.filename)
        if fallback in ALLOWED_MEDIA_MIMES:
            mime = fallback
    if mime not in ALLOWED_MEDIA_MIMES:
        raise HTTPException(status_code=415, detail=f"unsupported_mime:{file.content_type}")
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    if not raw:
        raise HTTPException(status_code=400, detail="empty_file")

    # Use the normalized MIME going forward so all downstream lookups
    # (extension, kind, response payload) see a canonical value.
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
