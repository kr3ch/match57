"""Like / dislike / match logic.

Records a like/dislike row, detects mutual likes, materialises a ``Match`` and
the corresponding ``Conversation`` in one transaction. Returns:

  ``{"matched": bool, "match_id": int | None, "conversation_id": int | None}``
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Conversation, Like, Match


def _canonical(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


async def record_like(db: AsyncSession, from_user_id: int, to_user_id: int) -> dict:
    if from_user_id == to_user_id:
        return {"matched": False, "match_id": None, "conversation_id": None}

    existing = await db.scalar(
        select(Like).where(Like.from_user_id == from_user_id, Like.to_user_id == to_user_id)
    )
    if existing is None:
        db.add(Like(from_user_id=from_user_id, to_user_id=to_user_id, kind="like"))
    else:
        existing.kind = "like"
        existing.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.flush()

    reciprocal = await db.scalar(
        select(Like).where(
            Like.from_user_id == to_user_id,
            Like.to_user_id == from_user_id,
            Like.kind == "like",
        )
    )
    if reciprocal is None:
        return {"matched": False, "match_id": None, "conversation_id": None}

    a, b = _canonical(from_user_id, to_user_id)
    match = await db.scalar(select(Match).where(Match.user_a_id == a, Match.user_b_id == b))
    if match is None:
        match = Match(user_a_id=a, user_b_id=b)
        db.add(match)
        await db.flush()

    conv = await db.scalar(
        select(Conversation).where(Conversation.user_a_id == a, Conversation.user_b_id == b)
    )
    if conv is None:
        conv = Conversation(user_a_id=a, user_b_id=b)
        db.add(conv)
        await db.flush()

    return {"matched": True, "match_id": match.id, "conversation_id": conv.id}


async def record_dislike(db: AsyncSession, from_user_id: int, to_user_id: int) -> None:
    if from_user_id == to_user_id:
        return
    existing = await db.scalar(
        select(Like).where(Like.from_user_id == from_user_id, Like.to_user_id == to_user_id)
    )
    if existing is None:
        db.add(Like(from_user_id=from_user_id, to_user_id=to_user_id, kind="dislike"))
    else:
        existing.kind = "dislike"
        existing.created_at = datetime.now(timezone.utc).replace(tzinfo=None)


async def reset_dislike(db: AsyncSession, from_user_id: int, to_user_id: int) -> None:
    existing = await db.scalar(
        select(Like).where(
            Like.from_user_id == from_user_id,
            Like.to_user_id == to_user_id,
            Like.kind == "dislike",
        )
    )
    if existing:
        await db.delete(existing)


__all__ = ["record_dislike", "record_like", "reset_dislike"]
