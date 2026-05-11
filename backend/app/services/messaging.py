"""Message + conversation helpers used by REST handlers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Conversation,
    Message,
    MessageReaction,
    MessageRead,
    User,
)


def _canonical(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


async def get_or_create_conversation(
    db: AsyncSession, user_a_id: int, user_b_id: int
) -> Conversation:
    a, b = _canonical(user_a_id, user_b_id)
    conv = await db.scalar(
        select(Conversation).where(Conversation.user_a_id == a, Conversation.user_b_id == b)
    )
    if conv is None:
        conv = Conversation(user_a_id=a, user_b_id=b)
        db.add(conv)
        await db.flush()
    return conv


async def conversation_for_user(
    db: AsyncSession, conversation_id: int, user_id: int
) -> Conversation | None:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or user_id not in (conv.user_a_id, conv.user_b_id):
        return None
    return conv


def conversation_other_user_id(conv: Conversation, self_id: int) -> int:
    return conv.user_b_id if conv.user_a_id == self_id else conv.user_a_id


async def serialize_message(
    db: AsyncSession, message: Message, *, current_user_id: int
) -> dict[str, Any]:
    reactions: list[dict[str, Any]] = []
    res = await db.execute(select(MessageReaction).where(MessageReaction.message_id == message.id))
    for r in res.scalars():
        reactions.append({"user_id": r.user_id, "emoji": r.emoji, "at": r.created_at.isoformat()})

    reads_res = await db.execute(
        select(MessageRead.user_id).where(MessageRead.message_id == message.id)
    )
    read_by = [row[0] for row in reads_res]

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "from_user_id": message.from_user_id,
        "kind": message.kind,
        "body": message.body,
        "attachment": (
            {
                "filename": message.attachment_filename,
                "mime": message.attachment_mime,
                "duration_ms": message.attachment_duration_ms,
                "width": message.attachment_width,
                "height": message.attachment_height,
                "user_id": message.from_user_id,
            }
            if message.attachment_filename
            else None
        ),
        "reply_to_id": message.reply_to_id,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
        "deleted": message.deleted_at is not None,
        "reactions": reactions,
        "read_by": read_by,
        "is_mine": message.from_user_id == current_user_id,
    }


async def serialize_conversation(
    db: AsyncSession,
    conv: Conversation,
    *,
    current_user_id: int,
    online_check,
) -> dict[str, Any]:
    from app.db.models import Photo

    other_id = conversation_other_user_id(conv, current_user_id)
    other = await db.get(User, other_id)
    avatar = None
    if other is not None:
        first_photo = await db.scalar(
            select(Photo).where(Photo.user_id == other.id).order_by(Photo.position).limit(1)
        )
        if first_photo is not None:
            avatar = {
                "filename": first_photo.filename,
                "kind": first_photo.kind,
                "user_id": other.id,
            }

    last_msg = await db.scalar(
        select(Message)
        .where(Message.conversation_id == conv.id, Message.deleted_at.is_(None))
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    unread_count = await db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conv.id,
            Message.from_user_id != current_user_id,
            Message.deleted_at.is_(None),
            ~Message.id.in_(
                select(MessageRead.message_id).where(MessageRead.user_id == current_user_id)
            ),
        )
    )

    last_serial: dict[str, Any] | None = None
    if last_msg is not None:
        last_serial = await serialize_message(db, last_msg, current_user_id=current_user_id)

    return {
        "id": conv.id,
        "other": {
            "user_id": other.id if other else other_id,
            "name": other.name if other else "(deleted)",
            "username": other.username if other else None,
            "age": other.age if other else None,
            "avatar": avatar,
            "online": online_check(other_id) if other else False,
            "last_seen_at": other.last_seen_at.isoformat()
            if (other and other.last_seen_at)
            else None,
        }
        if other
        else None,
        "last_message": last_serial,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "unread_count": unread_count or 0,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


async def list_conversations_for(db: AsyncSession, user_id: int) -> list[Conversation]:
    stmt = (
        select(Conversation)
        .where(or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id))
        .order_by(
            Conversation.last_message_at.desc().nulls_last(),
            Conversation.created_at.desc(),
        )
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def list_messages(
    db: AsyncSession,
    conversation_id: int,
    *,
    offset: int = 0,
    limit: int = 50,
) -> list[Message]:
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_message(
    db: AsyncSession,
    *,
    conversation: Conversation,
    from_user_id: int,
    body: str | None = None,
    kind: str = "text",
    attachment: dict[str, Any] | None = None,
    reply_to_id: int | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation.id,
        from_user_id=from_user_id,
        body=(body or None),
        kind=kind,
        attachment_filename=(attachment or {}).get("filename"),
        attachment_mime=(attachment or {}).get("mime"),
        attachment_duration_ms=(attachment or {}).get("duration_ms"),
        attachment_width=(attachment or {}).get("width"),
        attachment_height=(attachment or {}).get("height"),
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.flush()
    return msg


async def mark_conversation_read(db: AsyncSession, conversation_id: int, user_id: int) -> list[int]:
    """Mark every unread message in this conversation read by ``user_id``.

    Returns the list of message ids that were just marked, so the caller can
    broadcast read receipts on WS.
    """
    stmt = select(Message.id).where(
        Message.conversation_id == conversation_id,
        Message.from_user_id != user_id,
        Message.deleted_at.is_(None),
        ~Message.id.in_(select(MessageRead.message_id).where(MessageRead.user_id == user_id)),
    )
    rows = (await db.execute(stmt)).all()
    new_ids = [r[0] for r in rows]
    for mid in new_ids:
        db.add(MessageRead(message_id=mid, user_id=user_id))
    await db.flush()
    return new_ids


__all__ = [
    "_canonical",
    "conversation_for_user",
    "conversation_other_user_id",
    "create_message",
    "get_or_create_conversation",
    "list_conversations_for",
    "list_messages",
    "mark_conversation_read",
    "serialize_conversation",
    "serialize_message",
]
