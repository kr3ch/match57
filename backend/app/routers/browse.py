"""Swipe-deck endpoints: next profile, like, dislike, report."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.bot_client import safe_send_message
from app.config import ADMIN_IDS
from app.db import Database
from app.deps import current_user_id, db_dep
from app.services.likes import add_dislike, do_like, format_contact
from app.services.profiles import build_caption, filter_candidates

router = APIRouter(prefix="/api/browse", tags=["browse"])

REPORT_REASONS = {
    "🔞 Неприемлемый контент",
    "🤡 Фейковая анкета",
    "😡 Оскорбления/угрозы",
}


def _public_profile(p: dict[str, Any]) -> dict[str, Any]:
    """Strip private fields before sending to clients."""
    return {
        "user_id": p["user_id"],
        "name": p["name"],
        "age": p["age"],
        "gender": p["gender"],
        "description": p.get("description", ""),
        "photos": p.get("photos", []),
    }


@router.get("/next")
async def next_profile(
    index: int = Query(0, ge=0),
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    candidates = filter_candidates(db, user_id)
    if not candidates:
        return {"profile": None, "remaining": 0, "index": 0}
    if index >= len(candidates):
        index = 0
    profile = candidates[index]
    return {
        "profile": _public_profile(profile),
        "caption": build_caption(profile),
        "remaining": len(candidates) - index,
        "index": index,
        "next_index": index + 1,
    }


class LikeIn(BaseModel):
    target_user_id: int


@router.post("/like")
async def like(
    payload: LikeIn,
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    if user_id == payload.target_user_id:
        raise HTTPException(status_code=400, detail="cannot_like_self")
    is_match = do_like(db, user_id, payload.target_user_id)

    user_profile = db.get_user(user_id)
    target_profile = db.get_user(payload.target_user_id)
    if not target_profile:
        raise HTTPException(status_code=404, detail="target_not_found")

    # Outbound notifications -- mirror bot.py:process_like
    if is_match:
        await safe_send_message(
            payload.target_user_id,
            f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(user_profile)}",
        )
    else:
        await safe_send_message(
            payload.target_user_id,
            "Заканчивай с просмотром анкет, ты кому-то понравился",
        )
    return {
        "match": is_match,
        "contact": format_contact(target_profile) if is_match else None,
    }


class DislikeIn(BaseModel):
    target_user_id: int


@router.post("/dislike")
async def dislike(
    payload: DislikeIn,
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, str]:
    if user_id == payload.target_user_id:
        raise HTTPException(status_code=400, detail="cannot_dislike_self")
    add_dislike(db, user_id, payload.target_user_id)
    return {"ok": "disliked"}


class ReportIn(BaseModel):
    target_user_id: int
    reason: Literal[
        "🔞 Неприемлемый контент",
        "🤡 Фейковая анкета",
        "😡 Оскорбления/угрозы",
    ]


@router.post("/report")
async def report(
    payload: ReportIn,
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, str]:
    db.add_report(
        from_user_id=user_id,
        on_user_id=payload.target_user_id,
        reason=payload.reason,
    )
    reported = db.get_user(payload.target_user_id)
    reporter = db.get_user(user_id)
    reported_name = reported.get("name", "?") if reported else "?"
    reporter_name = reporter.get("name", "?") if reporter else "?"
    reported_username = (
        f"@{reported['username']}"
        if reported and reported.get("username")
        else f"ID:{payload.target_user_id}"
    )
    text = (
        f"⚠️ Новая жалоба!\n\n"
        f"На кого: {reported_name} ({reported_username}) ID: {payload.target_user_id}\n"
        f"От кого: {reporter_name} (ID: {user_id})\n"
        f"Причина: {payload.reason}\n\n"
        f"Обработать: /admin → ⚠️ Жалобы"
    )
    for admin_id in ADMIN_IDS:
        await safe_send_message(admin_id, text)
    return {"ok": "reported"}
