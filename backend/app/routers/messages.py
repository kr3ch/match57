"""Messages REST: send, react, delete (soft)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.db.models import Message, MessageReaction
from app.deps import CurrentUserDep, SessionDep
from app.realtime.events import message_event, reaction_event
from app.realtime.manager import manager
from app.services.messaging import (
    conversation_for_user,
    conversation_other_user_id,
    create_message,
    serialize_message,
)
from app.services.uploads import upload_path

router = APIRouter(prefix="/api/messages", tags=["messages"])


class MessageIn(BaseModel):
    conversation_id: int
    body: str | None = Field(default=None, max_length=4000)
    kind: str = "text"
    attachment_filename: str | None = None
    attachment_user_id: int | None = None
    attachment_mime: str | None = None
    attachment_duration_ms: int | None = None
    attachment_width: int | None = None
    attachment_height: int | None = None
    reply_to_id: int | None = None


@router.post("/send")
async def send(payload: MessageIn, user: CurrentUserDep, db: SessionDep) -> dict:
    if payload.kind not in ("text", "voice", "video", "photo", "file"):
        raise HTTPException(status_code=400, detail="bad_kind")
    conv = await conversation_for_user(db, payload.conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    if payload.kind == "text":
        if not payload.body or not payload.body.strip():
            raise HTTPException(status_code=400, detail="empty_body")
    else:
        # Validate attachment exists on disk under owner's folder.
        owner_id = payload.attachment_user_id or user.id
        if not payload.attachment_filename:
            raise HTTPException(status_code=400, detail="attachment_required")
        if owner_id != user.id:
            raise HTTPException(status_code=403, detail="bad_attachment_owner")
        if not upload_path(owner_id, payload.attachment_filename).exists():
            raise HTTPException(status_code=400, detail="attachment_missing")

    attachment = (
        {
            "filename": payload.attachment_filename,
            "mime": payload.attachment_mime,
            "duration_ms": payload.attachment_duration_ms,
            "width": payload.attachment_width,
            "height": payload.attachment_height,
        }
        if payload.kind != "text"
        else None
    )
    if payload.reply_to_id:
        original = await db.get(Message, payload.reply_to_id)
        if original is None or original.conversation_id != conv.id:
            raise HTTPException(status_code=400, detail="bad_reply_target")

    msg = await create_message(
        db,
        conversation=conv,
        from_user_id=user.id,
        body=(payload.body or None),
        kind=payload.kind,
        attachment=attachment,
        reply_to_id=payload.reply_to_id,
    )
    serial = await serialize_message(db, msg, current_user_id=user.id)
    other_id = conversation_other_user_id(conv, user.id)
    await manager.send_to_user(other_id, message_event(serial, sender_name=user.name))
    await manager.send_to_user(user.id, message_event(serial, sender_name=user.name))
    return {"message": serial}


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


@router.post("/{msg_id}/react")
async def react(msg_id: int, payload: ReactionIn, user: CurrentUserDep, db: SessionDep) -> dict:
    msg = await db.get(Message, msg_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="message_not_found")
    conv = await conversation_for_user(db, msg.conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    existing = await db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == msg_id,
            MessageReaction.user_id == user.id,
            MessageReaction.emoji == payload.emoji,
        )
    )
    removed = False
    if existing is not None:
        await db.delete(existing)
        removed = True
    else:
        db.add(MessageReaction(message_id=msg_id, user_id=user.id, emoji=payload.emoji))
    await db.flush()
    other_id = conversation_other_user_id(conv, user.id)
    evt = reaction_event(msg_id, user.id, payload.emoji, removed=removed)
    await manager.send_to_user(other_id, evt)
    await manager.send_to_user(user.id, evt)
    return {"ok": True, "removed": removed}


class ForwardIn(BaseModel):
    conversation_id: int


@router.post("/{msg_id}/forward")
async def forward_message(
    msg_id: int, payload: ForwardIn, user: CurrentUserDep, db: SessionDep
) -> dict:
    msg = await db.get(Message, msg_id)
    if msg is None or msg.deleted_at is not None:
        raise HTTPException(status_code=404, detail="message_not_found")
    orig_conv = await conversation_for_user(db, msg.conversation_id, user.id)
    if orig_conv is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")
    target_conv = await conversation_for_user(db, payload.conversation_id, user.id)
    if target_conv is None:
        raise HTTPException(status_code=404, detail="target_conversation_not_found")
    if target_conv.id == orig_conv.id:
        raise HTTPException(status_code=400, detail="same_conversation")

    attachment = None
    if msg.kind != "text" and msg.attachment_filename:
        attachment = {
            "filename": msg.attachment_filename,
            "mime": msg.attachment_mime,
            "duration_ms": msg.attachment_duration_ms,
            "width": msg.attachment_width,
            "height": msg.attachment_height,
        }
    body = msg.body
    if msg.kind == "text" and body:
        body = f"↪ {body}"
    new_msg = await create_message(
        db,
        conversation=target_conv,
        from_user_id=user.id,
        body=body,
        kind=msg.kind,
        attachment=attachment,
    )
    serial = await serialize_message(db, new_msg, current_user_id=user.id)
    other_id = conversation_other_user_id(target_conv, user.id)
    await manager.send_to_user(other_id, message_event(serial, sender_name=user.name))
    await manager.send_to_user(user.id, message_event(serial, sender_name=user.name))
    return {"message": serial}


@router.delete("/{msg_id}")
async def delete_message(msg_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    msg = await db.get(Message, msg_id)
    if msg is None or msg.from_user_id != user.id:
        raise HTTPException(status_code=404, detail="message_not_found")
    msg.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    msg.body = None
    msg.attachment_filename = None
    serial = await serialize_message(db, msg, current_user_id=user.id)
    conv = await conversation_for_user(db, msg.conversation_id, user.id)
    if conv:
        other_id = conversation_other_user_id(conv, user.id)
        await manager.send_to_user(other_id, message_event(serial))
        await manager.send_to_user(user.id, message_event(serial))
    return {"ok": True}


# Helper used by frontend to discover the conversation linked to a user pair.
@router.get("/with/{user_id}")
async def conversation_with(user_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    from app.db.models import Match
    from app.services.messaging import _canonical, get_or_create_conversation

    a, b = _canonical(user.id, user_id)
    match = await db.scalar(select(Match).where(Match.user_a_id == a, Match.user_b_id == b))
    if match is None:
        raise HTTPException(status_code=403, detail="not_matched")
    conv = await get_or_create_conversation(db, user.id, user_id)
    return {"conversation_id": conv.id}


__all__: list[str] = ["router"]
