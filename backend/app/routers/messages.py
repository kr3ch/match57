"""'Message before like' endpoint -- text/photo/video/voice/video_note.

Forwards the payload to the recipient via the Telegram bot (so the recipient
gets the message exactly the way they would have if the sender had used the
bot directly), and then registers a like (mirroring
``bot.py:process_send_message``).
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.bot_client import (
    safe_send_message,
    safe_send_photo,
    safe_send_video,
    safe_send_video_note,
    safe_send_voice,
)
from app.db import Database
from app.deps import current_user_id, db_dep
from app.services.likes import do_like, format_contact

router = APIRouter(prefix="/api/browse", tags=["messages"])


@router.post("/message")
async def send_message(
    target_user_id: int = Form(...),
    kind: Literal["text", "photo", "video", "voice", "video_note"] = Form(...),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    if user_id == target_user_id:
        raise HTTPException(status_code=400, detail="cannot_message_self")
    sender_profile = db.get_user(user_id)
    target_profile = db.get_user(target_user_id)
    if not sender_profile or not target_profile:
        raise HTTPException(status_code=404, detail="profile_not_found")

    sender_name = sender_profile.get("name", "Кто-то")
    sender_contact = format_contact(sender_profile)
    intro = f"💌 {sender_name} написал(а) тебе:\n\n"

    delivered = False
    try:
        if kind == "text":
            if not text:
                raise HTTPException(status_code=422, detail="text_required")
            delivered = await safe_send_message(
                target_user_id, f"{intro}{text}\n\n— {sender_contact}"
            )
        elif kind == "photo":
            if file is None:
                raise HTTPException(status_code=422, detail="file_required")
            from aiogram.types import BufferedInputFile  # type: ignore

            content = await file.read()
            buf = BufferedInputFile(content, filename=file.filename or "photo.jpg")
            delivered = await safe_send_photo(
                target_user_id, buf, caption=f"{intro}— {sender_contact}"
            )
        elif kind == "video":
            if file is None:
                raise HTTPException(status_code=422, detail="file_required")
            from aiogram.types import BufferedInputFile  # type: ignore

            content = await file.read()
            buf = BufferedInputFile(content, filename=file.filename or "video.mp4")
            delivered = await safe_send_video(
                target_user_id, buf, caption=f"{intro}— {sender_contact}"
            )
        elif kind == "voice":
            if file is None:
                raise HTTPException(status_code=422, detail="file_required")
            from aiogram.types import BufferedInputFile  # type: ignore

            content = await file.read()
            buf = BufferedInputFile(content, filename=file.filename or "voice.ogg")
            await safe_send_message(target_user_id, f"{intro}— {sender_contact}")
            delivered = await safe_send_voice(target_user_id, buf)
        elif kind == "video_note":
            if file is None:
                raise HTTPException(status_code=422, detail="file_required")
            from aiogram.types import BufferedInputFile  # type: ignore

            content = await file.read()
            buf = BufferedInputFile(content, filename=file.filename or "note.mp4")
            await safe_send_message(target_user_id, f"{intro}— {sender_contact}")
            delivered = await safe_send_video_note(target_user_id, buf)
    except HTTPException:
        raise
    except Exception:  # pragma: no cover -- resilience matches bot.py behaviour
        delivered = False

    is_match = do_like(db, user_id, target_user_id)
    sender_profile = db.get_user(user_id)
    target_profile = db.get_user(target_user_id)
    if is_match:
        await safe_send_message(
            target_user_id,
            f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(sender_profile)}",
        )
    elif delivered:
        await safe_send_message(
            target_user_id,
            "Заканчивай с просмотром анкет, ты кому-то понравился",
        )

    return {
        "delivered": delivered,
        "match": is_match,
        "contact": format_contact(target_profile) if is_match else None,
    }
