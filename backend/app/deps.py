"""FastAPI dependencies: DB session + current-user resolution from cookie."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SESSION_COOKIE, verify_session
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


SessionDep = Annotated[AsyncSession, Depends(db_session)]
CurrentUserDep = Annotated[User, Depends(current_user)]
CurrentAdminDep = Annotated[User, Depends(current_admin)]
