"""Telegram Login Widget callback + session cookie issuance."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth import SESSION_COOKIE, issue_session, verify_telegram_login
from app.config import ADMIN_IDS, FRONTEND_ORIGIN, SESSION_TTL_DAYS
from app.db import Database
from app.deps import db_dep, session_payload
from app.services.referrals import record_referral

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TelegramLoginPayload(BaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str
    ref: int | None = None


@router.post("/telegram")
async def telegram_login(
    payload: TelegramLoginPayload, response: Response, db: Database = Depends(db_dep)
) -> dict[str, Any]:
    """Verify a Telegram Login Widget payload and start a session."""
    raw = payload.model_dump(exclude_none=True)
    ref_value = raw.pop("ref", None)
    # Telegram sends string fields; coerce ints back to strings for the
    # signature check.
    raw["id"] = str(payload.id)
    raw["auth_date"] = str(payload.auth_date)
    user_info = verify_telegram_login(raw)
    if user_info is None:
        raise HTTPException(status_code=401, detail="invalid_telegram_signature")

    user_id = user_info["user_id"]
    if db.is_banned(user_id):
        raise HTTPException(status_code=403, detail="banned")

    # Track referral for brand-new users (does nothing if user already exists)
    if ref_value is not None:
        try:
            record_referral(db, int(ref_value), user_id)
        except Exception:
            pass

    token = issue_session(user_id, username=user_info.get("username"))
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=not FRONTEND_ORIGIN.startswith("http://localhost"),
        path="/",
    )
    return {
        "user_id": user_id,
        "username": user_info.get("username"),
        "first_name": user_info.get("first_name"),
        "is_admin": user_id in ADMIN_IDS,
        "registered": db.get_user(user_id) is not None,
    }


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": "logged_out"}


@router.get("/me")
async def me(
    payload: dict[str, Any] = Depends(session_payload),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    user_id = int(payload["user_id"])
    profile = db.get_user(user_id)
    return {
        "user_id": user_id,
        "username": payload.get("username"),
        "is_admin": user_id in ADMIN_IDS,
        "registered": profile is not None,
        "hidden": bool(profile and profile.get("hidden", False)),
    }
