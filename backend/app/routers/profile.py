"""Profile editing + photo management."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app.config import (
    DESCRIPTION_MAX,
    GENDER_CHOICES,
    LOOKING_FOR_CHOICES,
    MAX_AGE,
    MIN_AGE,
    NAME_MAX,
    PROFILE_PHOTO_MAX,
    USERNAME_MAX,
)
from app.db.models import Photo, User
from app.deps import CurrentUserDep, SessionDep
from app.services.profiles import serialize_user
from app.services.uploads import store_upload, upload_path

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=NAME_MAX)
    age: int | None = Field(default=None, ge=MIN_AGE, le=MAX_AGE)
    gender: str | None = None
    looking_for: str | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    school: str | None = Field(default=None, max_length=64)
    username: str | None = Field(default=None, max_length=USERNAME_MAX)
    phone: str | None = None
    hidden: bool | None = None

    @field_validator("gender")
    @classmethod
    def _g(cls, v):
        if v is not None and v not in GENDER_CHOICES:
            raise ValueError("gender_invalid")
        return v

    @field_validator("looking_for")
    @classmethod
    def _lf(cls, v):
        if v is not None and v not in LOOKING_FOR_CHOICES:
            raise ValueError("looking_for_invalid")
        return v

    @field_validator("username")
    @classmethod
    def _u(cls, v):
        if v is None or v == "":
            return None
        cleaned = v.strip().lstrip("@")
        if not all(ch.isalnum() or ch == "_" for ch in cleaned):
            raise ValueError("username_invalid")
        return cleaned


@router.get("")
async def get_my_profile(user: CurrentUserDep, db: SessionDep) -> dict:
    return {"profile": await serialize_user(db, user, include_phone=True)}


@router.patch("")
async def update_my_profile(payload: ProfileUpdate, user: CurrentUserDep, db: SessionDep) -> dict:
    if payload.username is not None and payload.username != user.username:
        clash = await db.scalar(
            select(User).where(User.username == payload.username, User.id != user.id)
        )
        if clash is not None:
            raise HTTPException(status_code=409, detail="username_taken")

    for field in (
        "name",
        "age",
        "gender",
        "looking_for",
        "description",
        "school",
        "username",
        "phone",
        "hidden",
    ):
        v = getattr(payload, field)
        if v is not None:
            setattr(user, field, v)

    return {"profile": await serialize_user(db, user, include_phone=True)}


@router.post("/photos")
async def add_photo(
    file: UploadFile,
    user: CurrentUserDep,
    db: SessionDep,
) -> dict:
    from sqlalchemy import func

    count_q = await db.scalar(select(func.count(Photo.id)).where(Photo.user_id == user.id))
    count = int(count_q or 0)
    if count >= PROFILE_PHOTO_MAX:
        raise HTTPException(status_code=409, detail="photos_limit_reached")
    info = await store_upload(file, user.id)
    if info["kind"] not in ("photo", "video"):
        upload_path(user.id, info["filename"]).unlink(missing_ok=True)
        raise HTTPException(status_code=415, detail="profile_supports_photo_or_video_only")
    if info["kind"] == "video" and info.get("duration_ms") and info["duration_ms"] > 30_000:
        upload_path(user.id, info["filename"]).unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="video_too_long_30s_max")
    photo = Photo(
        user_id=user.id,
        filename=info["filename"],
        mime_type=info["mime"],
        kind=info["kind"],
        width=info["width"],
        height=info["height"],
        position=count,
    )
    db.add(photo)
    await db.flush()
    return {"profile": await serialize_user(db, user, include_phone=True)}


@router.delete("/photos/{photo_id}")
async def remove_photo(
    photo_id: int,
    user: CurrentUserDep,
    db: SessionDep,
) -> dict:
    photo = await db.get(Photo, photo_id)
    if photo is None or photo.user_id != user.id:
        raise HTTPException(status_code=404, detail="photo_not_found")
    upload_path(user.id, photo.filename).unlink(missing_ok=True)
    await db.delete(photo)
    await db.flush()
    return {"profile": await serialize_user(db, user, include_phone=True)}
