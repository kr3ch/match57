"""``/api/media/*``: upload + serve.

The serve endpoint streams files from the per-user upload folder. Access
control: a file is readable by the owner, by any of the owner's match
partners, by an admin, or always (profile photos referenced by the public
profile API are always readable since they're already advertised in
``/api/browse``).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.db.models import Match, Photo
from app.deps import CurrentUserDep, SessionDep
from app.services.uploads import store_upload, upload_path

router = APIRouter(prefix="/api/media", tags=["media"])


@router.post("/upload")
async def upload(file: UploadFile, user: CurrentUserDep) -> dict:
    return await store_upload(file, user.id)


def _content_type_for(name: str) -> str:
    name = name.lower()
    if name.endswith(".jpg") or name.endswith(".jpeg"):
        return "image/jpeg"
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".webp"):
        return "image/webp"
    if name.endswith(".webm"):
        return "video/webm"
    if name.endswith(".mp4"):
        return "video/mp4"
    if name.endswith(".ogg"):
        return "audio/ogg"
    if name.endswith(".mp3"):
        return "audio/mpeg"
    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith(".txt"):
        return "text/plain"
    if name.endswith(".zip"):
        return "application/zip"
    return "application/octet-stream"


@router.get("/{user_id}/{filename}")
async def serve(user_id: int, filename: str, user: CurrentUserDep, db: SessionDep):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="bad_filename")
    path = upload_path(user_id, filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="not_found")

    # Owner / admin always allowed.
    if user.is_admin or user_id == user.id:
        return FileResponse(path, media_type=_content_type_for(filename))

    # Profile photos are always readable (advertised by /api/browse).
    is_profile = await db.scalar(
        select(Photo.id).where(Photo.user_id == user_id, Photo.filename == filename)
    )
    if is_profile is not None:
        return FileResponse(path, media_type=_content_type_for(filename))

    # Else: must be matched with the owner.
    a, b = (user.id, user_id) if user.id < user_id else (user_id, user.id)
    matched = await db.scalar(select(Match.id).where(Match.user_a_id == a, Match.user_b_id == b))
    if matched is None:
        raise HTTPException(status_code=403, detail="forbidden")
    return FileResponse(path, media_type=_content_type_for(filename))
