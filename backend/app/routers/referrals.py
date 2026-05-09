"""Referral link / bonuses for the '🎁 Пригласи друзей' page."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.bot_client import get_bot_username
from app.config import FRONTEND_ORIGIN
from app.db import Database
from app.deps import current_user_id, db_dep
from app.services.referrals import (
    bonuses_text,
    telegram_referral_link,
    web_referral_link,
)

router = APIRouter(prefix="/api/me", tags=["referrals"])


@router.get("/referral")
async def referral(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, Any]:
    profile = db.get_user(user_id) or {}
    referrals = profile.get("referrals", [])
    bot_username = await get_bot_username()
    return {
        "count": len(referrals),
        "bonuses": bonuses_text(len(referrals)),
        "telegram_link": telegram_referral_link(bot_username, user_id),
        "web_link": web_referral_link(FRONTEND_ORIGIN, user_id),
    }
