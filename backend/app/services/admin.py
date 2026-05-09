"""Aggregations used by the admin panel."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Like, Match, Photo, Report, User


async def stats(db: AsyncSession) -> dict:
    total_users = await db.scalar(select(func.count(User.id))) or 0
    banned = await db.scalar(select(func.count(User.id)).where(User.banned.is_(True))) or 0
    hidden = await db.scalar(select(func.count(User.id)).where(User.hidden.is_(True))) or 0
    total_likes = await db.scalar(select(func.count(Like.id)).where(Like.kind == "like")) or 0
    total_dislikes = await db.scalar(select(func.count(Like.id)).where(Like.kind == "dislike")) or 0
    total_matches = await db.scalar(select(func.count(Match.id))) or 0
    open_reports = (
        await db.scalar(select(func.count(Report.id)).where(Report.status == "open")) or 0
    )
    photo_count = await db.scalar(select(func.count(Photo.id))) or 0
    return {
        "total_users": int(total_users),
        "banned": int(banned),
        "hidden": int(hidden),
        "total_likes": int(total_likes),
        "total_dislikes": int(total_dislikes),
        "total_matches": int(total_matches),
        "open_reports": int(open_reports),
        "photo_count": int(photo_count),
    }


async def top_received(db: AsyncSession, limit: int = 10) -> list[dict]:
    stmt = (
        select(Like.to_user_id, func.count(Like.id).label("n"))
        .where(Like.kind == "like")
        .group_by(Like.to_user_id)
        .order_by(func.count(Like.id).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{"user_id": uid, "count": int(n)} for uid, n in rows]


async def top_matches(db: AsyncSession, limit: int = 10) -> list[dict]:
    stmt = select(Match.user_a_id, Match.user_b_id)
    rows = (await db.execute(stmt)).all()
    counts: dict[int, int] = {}
    for a, b in rows:
        counts[a] = counts.get(a, 0) + 1
        counts[b] = counts.get(b, 0) + 1
    pairs = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"user_id": uid, "count": n} for uid, n in pairs]


async def top_referrers(db: AsyncSession, limit: int = 10) -> list[dict]:
    stmt = (
        select(User.ref_user_id, func.count(User.id))
        .where(User.ref_user_id.is_not(None))
        .group_by(User.ref_user_id)
        .order_by(func.count(User.id).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{"user_id": uid, "count": int(n)} for uid, n in rows]


__all__ = ["stats", "top_matches", "top_received", "top_referrers"]
