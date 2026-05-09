"""Like / dislike + matches list."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.db.models import Conversation, Like, Match, User
from app.deps import CurrentUserDep, SessionDep
from app.realtime.events import like_event, match_event
from app.realtime.manager import manager
from app.services.likes import record_dislike, record_like
from app.services.profiles import serialize_user

router = APIRouter(prefix="/api", tags=["likes"])


class LikeIn(BaseModel):
    target_id: int


@router.post("/likes")
async def post_like(payload: LikeIn, user: CurrentUserDep, db: SessionDep) -> dict:
    if payload.target_id == user.id:
        raise HTTPException(status_code=400, detail="cannot_like_self")
    target = await db.get(User, payload.target_id)
    if target is None or target.banned or target.hidden:
        raise HTTPException(status_code=404, detail="user_not_found")
    res = await record_like(db, user.id, payload.target_id)

    self_dict = await serialize_user(db, user)
    target_dict = await serialize_user(db, target)
    if res["matched"]:
        await manager.send_to_user(
            target.id, match_event(self_dict, conversation_id=res["conversation_id"])
        )
        await manager.send_to_user(
            user.id, match_event(target_dict, conversation_id=res["conversation_id"])
        )
    else:
        await manager.send_to_user(target.id, like_event(self_dict))

    return res


@router.post("/dislikes")
async def post_dislike(payload: LikeIn, user: CurrentUserDep, db: SessionDep) -> dict:
    if payload.target_id == user.id:
        raise HTTPException(status_code=400, detail="cannot_dislike_self")
    await record_dislike(db, user.id, payload.target_id)
    return {"ok": True}


@router.get("/matches")
async def my_matches(user: CurrentUserDep, db: SessionDep) -> dict:
    stmt = select(Match).where(or_(Match.user_a_id == user.id, Match.user_b_id == user.id))
    rows = (await db.execute(stmt)).scalars().all()
    items = []
    for m in rows:
        other_id = m.user_b_id if m.user_a_id == user.id else m.user_a_id
        other = await db.scalar(
            select(User).where(User.id == other_id).options(selectinload(User.photos))
        )
        if other is None:
            continue
        conv = await db.scalar(
            select(Conversation).where(
                Conversation.user_a_id == m.user_a_id,
                Conversation.user_b_id == m.user_b_id,
            )
        )
        items.append(
            {
                "match_id": m.id,
                "user": await serialize_user(db, other),
                "conversation_id": conv.id if conv else None,
                "online": manager.is_online(other_id),
            }
        )
    return {"items": items}


@router.get("/likes/incoming")
async def incoming_likes(user: CurrentUserDep, db: SessionDep) -> dict:
    """People who liked me but haven't been swiped on yet (no reciprocal entry)."""
    incoming_stmt = (
        select(Like)
        .where(Like.to_user_id == user.id, Like.kind == "like")
        .order_by(Like.created_at.desc())
    )
    incoming = (await db.execute(incoming_stmt)).scalars().all()
    items = []
    for like in incoming:
        # Skip if I already swiped on them.
        already = await db.scalar(
            select(Like).where(Like.from_user_id == user.id, Like.to_user_id == like.from_user_id)
        )
        if already:
            continue
        liker = await db.scalar(
            select(User).where(User.id == like.from_user_id).options(selectinload(User.photos))
        )
        if liker is None or liker.banned or liker.hidden:
            continue
        items.append({"user": await serialize_user(db, liker), "at": like.created_at.isoformat()})
    return {"items": items}


@router.get("/skipped")
async def skipped(user: CurrentUserDep, db: SessionDep) -> dict:
    """People I disliked — show with option to undo."""
    stmt = (
        select(Like)
        .where(Like.from_user_id == user.id, Like.kind == "dislike")
        .order_by(Like.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = []
    for like in rows:
        target = await db.scalar(
            select(User).where(User.id == like.to_user_id).options(selectinload(User.photos))
        )
        if target is None or target.banned:
            continue
        items.append({"user": await serialize_user(db, target), "at": like.created_at.isoformat()})
    return {"items": items}


class UndoIn(BaseModel):
    target_id: int


@router.post("/skipped/undo")
async def undo_skip(payload: UndoIn, user: CurrentUserDep, db: SessionDep) -> dict:
    from app.services.likes import reset_dislike

    await reset_dislike(db, user.id, payload.target_id)
    return {"ok": True}
