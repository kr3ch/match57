"""Conversations REST: list, detail, message history, mark-read."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.deps import CurrentUserDep, SessionDep
from app.realtime.events import read_event
from app.realtime.manager import manager
from app.services.messaging import (
    conversation_for_user,
    conversation_other_user_id,
    list_conversations_for,
    list_messages,
    mark_conversation_read,
    serialize_conversation,
    serialize_message,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("")
async def list_my_conversations(user: CurrentUserDep, db: SessionDep) -> dict:
    convs = await list_conversations_for(db, user.id)
    items = [
        await serialize_conversation(db, c, current_user_id=user.id, online_check=manager.is_online)
        for c in convs
    ]
    return {"items": items}


@router.get("/{conv_id}")
async def conversation_detail(conv_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    conv = await conversation_for_user(db, conv_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    return {
        "conversation": await serialize_conversation(
            db, conv, current_user_id=user.id, online_check=manager.is_online
        )
    }


@router.get("/{conv_id}/messages")
async def messages_history(
    conv_id: int,
    user: CurrentUserDep,
    db: SessionDep,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict:
    conv = await conversation_for_user(db, conv_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    msgs = await list_messages(db, conv_id, offset=offset, limit=limit)
    items = [await serialize_message(db, m, current_user_id=user.id) for m in reversed(msgs)]
    return {"items": items, "next": offset + len(msgs) if len(msgs) == limit else None}


@router.post("/{conv_id}/read")
async def mark_read(conv_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    conv = await conversation_for_user(db, conv_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    new_ids = await mark_conversation_read(db, conv_id, user.id)
    other_id = conversation_other_user_id(conv, user.id)
    for mid in new_ids:
        await manager.send_to_user(other_id, read_event(mid, user.id, conv_id))
    return {"ok": True, "marked": len(new_ids)}
