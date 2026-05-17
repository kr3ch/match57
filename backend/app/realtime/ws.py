"""``/api/ws`` WebSocket endpoint.

Auth: same JWT cookie as REST. Rejects with 1008 if missing/invalid/banned.

Inbound (client → server):
    {"type":"ping"}
    {"type":"typing", "conversation_id": int, "is_typing": bool}
    {"type":"read",   "message_id": int}

Outbound (server → client) shapes are documented in ``realtime.events``.
On connect/disconnect we broadcast presence to all active users.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SESSION_COOKIE, verify_session
from app.db import SessionLocal
from app.db.models import Conversation, Message, MessageRead, User
from app.realtime.events import presence_event, read_event, typing_event
from app.realtime.manager import manager

router = APIRouter()


def _conversation_other_user_id(conv: Conversation, self_id: int) -> int:
    return conv.user_b_id if conv.user_a_id == self_id else conv.user_a_id


async def _touch_last_seen(db: AsyncSession, user: User) -> None:
    from datetime import datetime, timezone

    user.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()


async def _handle_typing(
    payload: dict[str, Any],
    self_id: int,
    db: AsyncSession,
) -> None:
    conv_id = int(payload.get("conversation_id", 0))
    is_typing = bool(payload.get("is_typing", False))
    if not conv_id:
        return
    conv = await db.get(Conversation, conv_id)
    if not conv or self_id not in (conv.user_a_id, conv.user_b_id):
        return
    other_id = _conversation_other_user_id(conv, self_id)
    await manager.send_to_user(other_id, typing_event(conv_id, self_id, is_typing))


async def _handle_read(
    payload: dict[str, Any],
    self_id: int,
    db: AsyncSession,
) -> None:
    msg_id = int(payload.get("message_id", 0))
    if not msg_id:
        return
    msg = await db.get(Message, msg_id)
    if not msg:
        return
    conv = await db.get(Conversation, msg.conversation_id)
    if not conv or self_id not in (conv.user_a_id, conv.user_b_id):
        return
    if msg.from_user_id == self_id:
        return
    existing = await db.scalar(
        select(MessageRead).where(MessageRead.message_id == msg_id, MessageRead.user_id == self_id)
    )
    if existing is None:
        db.add(MessageRead(message_id=msg_id, user_id=self_id))
        await db.commit()
    await manager.send_to_user(msg.from_user_id, read_event(msg_id, self_id, msg.conversation_id))


@router.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    # iOS Safari (ITP) won't include cross-site cookies on the WS upgrade
    # request. Accept the same JWT via ``?token=...`` query param as a
    # fallback (see deps.session_payload for the parallel REST flow).
    token = ws.cookies.get(SESSION_COOKIE) or ws.query_params.get("token")
    payload = verify_session(token)
    if payload is None:
        await ws.close(code=1008)
        return

    user_id = int(payload["user_id"])

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None or user.banned:
            await ws.close(code=1008)
            return

    await ws.accept()
    await manager.connect(user_id, ws)

    # Broadcast presence to peers (matched users) so chat list lights up.
    async with SessionLocal() as db:
        from datetime import datetime, timezone

        user = await db.get(User, user_id)
        if user is not None:
            user.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
        evt = presence_event(user_id, True, user.last_seen_at if user else None)
        # Notify everyone the user has a conversation with.
        result = await db.execute(
            select(Conversation).where(
                (Conversation.user_a_id == user_id) | (Conversation.user_b_id == user_id)
            )
        )
        peers = {_conversation_other_user_id(c, user_id) for c in result.scalars().all()}
        for peer in peers:
            await manager.send_to_user(peer, evt)

    last_pong_touch = time.time()

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = data.get("type")
            if kind == "ping":
                await ws.send_json({"type": "pong"})
                # Touch last_seen at most every 60s to avoid hammering the DB.
                if time.time() - last_pong_touch > 60:
                    last_pong_touch = time.time()
                    async with SessionLocal() as db:
                        u = await db.get(User, user_id)
                        if u is not None:
                            await _touch_last_seen(db, u)
                continue
            if kind == "typing":
                async with SessionLocal() as db:
                    await _handle_typing(data, user_id, db)
                continue
            if kind == "read":
                async with SessionLocal() as db:
                    await _handle_read(data, user_id, db)
                continue
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.disconnect(user_id, ws)
        # Final presence broadcast (offline + last_seen_at update).
        async with SessionLocal() as db:
            from datetime import datetime, timezone

            u = await db.get(User, user_id)
            if u is not None:
                u.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await db.commit()
                # Wait a beat so reconnect storms don't blast offline events.
                await asyncio.sleep(0.5)
                if not manager.is_online(user_id):
                    evt = presence_event(user_id, False, u.last_seen_at)
                    result = await db.execute(
                        select(Conversation).where(
                            (Conversation.user_a_id == user_id)
                            | (Conversation.user_b_id == user_id)
                        )
                    )
                    peers = {
                        _conversation_other_user_id(c, user_id) for c in result.scalars().all()
                    }
                    for peer in peers:
                        await manager.send_to_user(peer, evt)
