"""FastAPI dependencies: current user, admin guard, db handle."""

from __future__ import annotations

from typing import Any

from fastapi import Cookie, Depends, HTTPException, status

from app.auth import SESSION_COOKIE, read_session
from app.config import ADMIN_IDS
from app.db import Database, get_db


def db_dep() -> Database:
    return get_db()


def session_payload(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated")
    payload = read_session(session)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_session")
    return payload


def current_user_id(payload: dict[str, Any] = Depends(session_payload)) -> int:
    return int(payload["user_id"])


def current_profile(
    user_id: int = Depends(current_user_id),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    profile = db.get_user(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="profile_not_found")
    return profile


def admin_only(user_id: int = Depends(current_user_id)) -> int:
    if user_id not in ADMIN_IDS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    return user_id
