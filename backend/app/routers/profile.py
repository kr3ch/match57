"""Self-profile endpoints: read, edit description / photos, hide, refill."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.bot_client import upload_photo_for_storage, upload_video_for_storage
from app.config import STORAGE_CHAT_ID
from app.db import Database
from app.deps import current_profile, current_user_id, db_dep
from app.services.profiles import hide_profile, unhide_profile

router = APIRouter(prefix="/api/me", tags=["profile"])


class DescriptionUpdate(BaseModel):
    description: str = Field(max_length=2000)


class PhotosUpdate(BaseModel):
    photos: list[dict[str, str]] = Field(min_length=1, max_length=3)


@router.get("")
async def get_me(profile: dict[str, Any] = Depends(current_profile)) -> dict[str, Any]:
    return profile


@router.patch("/description")
async def update_description(
    payload: DescriptionUpdate,
    profile: dict[str, Any] = Depends(current_profile),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    profile["description"] = payload.description.strip()
    db.update_user(profile["user_id"], profile)
    return profile


@router.put("/photos")
async def replace_photos(
    payload: PhotosUpdate,
    profile: dict[str, Any] = Depends(current_profile),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    cleaned: list[dict[str, str]] = []
    for p in payload.photos:
        ptype = p.get("type")
        fid = p.get("file_id")
        if ptype not in ("photo", "video") or not fid:
            raise HTTPException(status_code=422, detail="bad_photo")
        cleaned.append({"type": ptype, "file_id": fid})
    profile["photos"] = cleaned
    db.update_user(profile["user_id"], profile)
    return profile


@router.post("/photos/upload")
async def upload_photo(
    kind: Literal["photo", "video"] = Form(...),
    file: UploadFile = File(...),
    user_id: int = Depends(current_user_id),
) -> dict[str, Any]:
    """Re-upload a web file to a Telegram storage chat to obtain a ``file_id``.

    This keeps the persistence layer using Telegram ``file_id``s (identical
    schema to bot.py) without forcing a separate object store.
    """
    if STORAGE_CHAT_ID == 0:
        raise HTTPException(status_code=503, detail="storage_chat_not_configured")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="empty_file")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file_too_large")
    if kind == "photo":
        file_id = await upload_photo_for_storage(content, STORAGE_CHAT_ID)
    else:
        file_id = await upload_video_for_storage(content, STORAGE_CHAT_ID)
    if not file_id:
        raise HTTPException(status_code=502, detail="telegram_upload_failed")
    return {"type": kind, "file_id": file_id}


@router.post("/hide")
async def hide(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, str]:
    """Mirror of '🚪 Я больше не хочу никого искать' (hidden=true)."""
    hide_profile(db, user_id)
    return {"ok": "hidden"}


@router.post("/unhide")
async def unhide(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, str]:
    """Re-show a previously hidden profile (mirror of /start auto-unhide)."""
    unhide_profile(db, user_id)
    return {"ok": "visible"}
