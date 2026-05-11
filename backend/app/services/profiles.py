"""Profile-card serialisation and browse-deck filtering."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import LOOKING_FOR_CHOICES
from app.db.models import Like, Photo, User


async def serialize_user(
    db: AsyncSession, user: User, *, include_phone: bool = False
) -> dict[str, Any]:
    """Public profile shape used everywhere on the frontend."""
    res = await db.execute(select(Photo).where(Photo.user_id == user.id).order_by(Photo.position))
    photos = []
    for p in res.scalars():
        photos.append(
            {
                "id": p.id,
                "filename": p.filename,
                "kind": p.kind,
                "mime": p.mime_type,
                "duration_ms": p.duration_ms,
                "width": p.width,
                "height": p.height,
                "user_id": user.id,
            }
        )
    out = {
        "user_id": user.id,
        "name": user.name,
        "age": user.age,
        "gender": user.gender,
        "looking_for": user.looking_for,
        "description": user.description,
        "school": user.school,
        "username": user.username,
        "is_admin": user.is_admin,
        "hidden": user.hidden,
        "banned": user.banned,
        "photos": photos,
        "last_seen_at": (user.last_seen_at.isoformat() + "Z") if user.last_seen_at else None,
    }
    if include_phone:
        out["phone"] = user.phone
        out["email"] = user.email
        out["email_verified"] = user.email_verified
    return out


async def candidates_for(db: AsyncSession, user: User) -> list[User]:
    """Profiles eligible for ``user``'s swipe deck.

    Mirrors the legacy filter:
      * filter by ``looking_for``,
      * exclude banned/hidden/self,
      * exclude already-liked or already-disliked.
    """
    if user.looking_for not in LOOKING_FOR_CHOICES:
        return []

    seen = await db.execute(select(Like.to_user_id).where(Like.from_user_id == user.id))
    seen_ids = {row[0] for row in seen}
    seen_ids.add(user.id)

    stmt = (
        select(User)
        .where(User.banned.is_(False), User.hidden.is_(False), ~User.id.in_(seen_ids))
        .options(selectinload(User.photos))
    )
    if user.looking_for == "Девушки":
        stmt = stmt.where(User.gender == "Девушка")
    elif user.looking_for == "Парни":
        stmt = stmt.where(User.gender == "Парень")
    stmt = stmt.order_by(User.last_seen_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def candidate_at(db: AsyncSession, user: User, index: int) -> User | None:
    cands = await candidates_for(db, user)
    if not cands:
        return None
    if index < 0 or index >= len(cands):
        index = 0
    return cands[index]


__all__ = ["candidate_at", "candidates_for", "serialize_user"]
