"""FastAPI dependencies: DB session + current-user resolution from cookie."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    ADMIN_PIN_COOKIE,
    SESSION_COOKIE,
    verify_admin_pin,
    verify_session,
)
from app.config import ADMIN_PIN as ADMIN_PIN_VALUE
from app.db import SessionLocal
from app.db.models import User


async def db_session() -> AsyncIterator[AsyncSession]:
    """One AsyncSession per request, commit on exit."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def session_payload(
    cookie: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> dict:
    """Verified payload from the auth cookie, or 401."""
    payload = verify_session(cookie)
    if payload is None:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return payload


async def current_user(
    payload: Annotated[dict, Depends(session_payload)],
    db: Annotated[AsyncSession, Depends(db_session)],
) -> User:
    user = await db.get(User, int(payload["user_id"]))
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    if user.banned:
        raise HTTPException(status_code=403, detail="banned")
    return user


async def current_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="admin_only")
    return user


async def current_admin_pin(
    user: Annotated[User, Depends(current_admin)],
    admin_cookie: Annotated[str | None, Cookie(alias=ADMIN_PIN_COOKIE)] = None,
) -> User:
    """Admin **plus** a valid PIN cookie issued by ``/api/admin/verify-pin``.

    When ``ADMIN_PIN`` env is unset (e.g. local dev) the gate is open. As soon
    as it is set, every endpoint guarded by this dep requires the second-factor
    cookie or returns ``403 admin_pin_required``.
    """
    if not ADMIN_PIN_VALUE:
        return user
    payload = verify_admin_pin(admin_cookie)
    if payload is None or int(payload.get("user_id", 0)) != user.id:
        raise HTTPException(status_code=403, detail="admin_pin_required")
    return user


SessionDep = Annotated[AsyncSession, Depends(db_session)]
CurrentUserDep = Annotated[User, Depends(current_user)]
CurrentAdminDep = Annotated[User, Depends(current_admin)]
CurrentAdminPinDep = Annotated[User, Depends(current_admin_pin)]
