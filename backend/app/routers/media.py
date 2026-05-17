"""``/api/media/*``: upload + serve.

The serve endpoint streams files from the per-user upload folder. Access
control: a file is readable by the owner, by any of the owner's match
partners, by an admin, or always (profile photos referenced by the public
profile API are always readable since they're already advertised in
``/api/browse``).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.auth import SESSION_COOKIE, verify_session
from app.db.models import Match, Photo, User
from app.deps import CurrentUserDep, SessionDep, _bearer_from_header
from app.services.uploads import store_upload, upload_path

router = APIRouter(prefix="/api/media", tags=["media"])


@router.post("/upload")
async def upload(file: UploadFile, user: CurrentUserDep) -> dict:
    return await store_upload(file, user.id)


_CONTENT_TYPE_BY_EXT = {
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


def _content_type_for(name: str) -> str:
    name = name.lower()
    for ext, ct in _CONTENT_TYPE_BY_EXT.items():
        if name.endswith(ext):
            return ct
    return "application/octet-stream"


async def _resolve_optional_viewer(
    db: SessionDep,
    cookie: str | None,
    authorization: str | None,
    token_qs: str | None,
) -> User | None:
    """Best-effort session lookup that NEVER raises.

    HTML ``<img>`` tags can't send custom headers, so the browser only
    attaches our cookie. iOS Safari with ITP refuses to send our
    cross-site cookie at all. Accept the JWT via three channels in
    order: cookie, ``Authorization: Bearer``, ``?token=`` query string.
    """
    raw = cookie or _bearer_from_header(authorization) or (token_qs or None)
    payload = verify_session(raw)
    if payload is None:
        return None
    user = await db.get(User, int(payload["user_id"]))
    if user is None or user.banned or user.deleted:
        return None
    return user


@router.get("/{user_id}/{filename}")
async def serve(
    user_id: int,
    filename: str,
    db: SessionDep,
    cookie: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    token_qs: Annotated[str | None, Query(alias="token")] = None,
):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="bad_filename")
    path = upload_path(user_id, filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="not_found")

    # Profile photos are public — they're already advertised by
    # ``/api/browse`` and the filename is an unguessable UUID. Letting
    # the browser load them without auth fixes broken-image squares on
    # iOS Safari (ITP drops our cross-site session cookie) and on the
    # public profile pages where there's no logged-in viewer.
    is_profile = await db.scalar(
        select(Photo.id).where(Photo.user_id == user_id, Photo.filename == filename)
    )
    if is_profile is not None:
        return FileResponse(path, media_type=_content_type_for(filename))

    # Non-profile media (chat attachments, etc) still require auth.
    viewer = await _resolve_optional_viewer(db, cookie, authorization, token_qs)
    if viewer is None:
        raise HTTPException(status_code=401, detail="not_authenticated")

    # Owner / admin always allowed.
    if viewer.is_admin or user_id == viewer.id:
        return FileResponse(path, media_type=_content_type_for(filename))

    # Else: must be matched with the owner.
    a, b = (viewer.id, user_id) if viewer.id < user_id else (user_id, viewer.id)
    matched = await db.scalar(select(Match.id).where(Match.user_a_id == a, Match.user_b_id == b))
    if matched is None:
        raise HTTPException(status_code=403, detail="forbidden")
    return FileResponse(path, media_type=_content_type_for(filename))
