"""User block / unblock endpoints.

Surface:
- ``POST   /api/users/{id}/block``    — block ``id``.
- ``DELETE /api/users/{id}/block``    — unblock ``id``.
- ``GET    /api/users/{id}/block``    — pair status (i_blocked / they_blocked).
- ``GET    /api/users/blocked``       — list of users I'm blocking.

A block is directional (blocker → blocked). For chat gating both sides
of a pair are treated equivalently, so the side that hasn't blocked
still gets blocked from sending. See ``app.services.blocks``.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db.models import User
from app.deps import CurrentUserDep, SessionDep
from app.services import blocks as svc

router = APIRouter(prefix="/api/users", tags=["blocks"])


async def _ensure_target(db, target_id: int) -> User:
    target = await db.get(User, target_id)
    if target is None or target.deleted:
        raise HTTPException(status_code=404, detail="user_not_found")
    return target


@router.post("/{target_id}/block")
async def block(target_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    if target_id == user.id:
        raise HTTPException(status_code=400, detail="cannot_block_self")
    await _ensure_target(db, target_id)
    created = await svc.block_user(db, user.id, target_id)
    status = await svc.block_status(db, user.id, target_id)
    return {"ok": True, "created": created, **status}


@router.delete("/{target_id}/block")
async def unblock(target_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    if target_id == user.id:
        raise HTTPException(status_code=400, detail="cannot_block_self")
    removed = await svc.unblock_user(db, user.id, target_id)
    status = await svc.block_status(db, user.id, target_id)
    return {"ok": True, "removed": removed, **status}


@router.get("/{target_id}/block")
async def status(target_id: int, user: CurrentUserDep, db: SessionDep) -> dict:
    if target_id == user.id:
        return {"i_blocked": False, "they_blocked": False}
    await _ensure_target(db, target_id)
    return await svc.block_status(db, user.id, target_id)


@router.get("/blocked")
async def my_blocks(user: CurrentUserDep, db: SessionDep) -> dict:
    ids = await svc.blocked_user_ids(db, user.id)
    if not ids:
        return {"items": []}
    res = await db.execute(select(User).where(User.id.in_(ids)))
    return {
        "items": [
            {
                "user_id": u.id,
                "name": u.name,
                "username": u.username,
            }
            for u in res.scalars()
        ]
    }
