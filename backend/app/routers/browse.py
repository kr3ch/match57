"""Swipe deck (``/api/browse``)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import selectinload

from app.deps import CurrentUserDep, SessionDep
from app.services.profiles import candidates_for, serialize_user

router = APIRouter(prefix="/api/browse", tags=["browse"])


@router.get("")
async def deck(
    user: CurrentUserDep,
    db: SessionDep,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: int = Query(default=0, ge=0),
) -> dict:
    cands = await candidates_for(db, user)
    page = cands[cursor : cursor + limit]
    return {
        "items": [await serialize_user(db, c) for c in page],
        "total": len(cands),
        "next": cursor + len(page) if cursor + len(page) < len(cands) else None,
    }


@router.get("/{user_id}")
async def view_user(user_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    from sqlalchemy import select

    from app.db.models import User

    stmt = select(User).where(User.id == user_id).options(selectinload(User.photos))
    target = await db.scalar(stmt)
    if target is None or target.banned:
        raise HTTPException(status_code=404, detail="user_not_found")
    return {"profile": await serialize_user(db, target)}
