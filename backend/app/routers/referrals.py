"""Referral count for the current user."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.models import User
from app.deps import CurrentUserDep, SessionDep
from app.services.profiles import serialize_user

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


@router.get("")
async def my_referrals(user: CurrentUserDep, db: SessionDep) -> dict:
    count = await db.scalar(select(func.count(User.id)).where(User.ref_user_id == user.id))
    referees = (
        (
            await db.execute(
                select(User)
                .where(User.ref_user_id == user.id)
                .options(selectinload(User.photos))
                .order_by(User.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "count": int(count or 0),
        "items": [await serialize_user(db, u) for u in referees],
        "ref_link": f"/register?ref={user.id}",
    }
