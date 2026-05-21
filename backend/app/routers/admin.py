"""Admin panel endpoints.

Guarded by:
  * ``CurrentAdminDep`` — user must be ``is_admin=True``.
  * ``CurrentAdminPinDep`` — in addition to admin, requires a fresh PIN cookie
    issued by ``POST /api/admin/verify-pin``. Skipped when ``ADMIN_PIN`` env
    is unset (so local dev still works).

The only endpoints that do **not** require the PIN are the PIN-management ones
themselves (``/verify-pin``, ``/pin-status``, ``/lock``) — otherwise the admin
could never unlock the panel.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.auth import ADMIN_PIN_COOKIE, issue_admin_pin, verify_admin_pin
from app.config import (
    ADMIN_PIN,
    ADMIN_PIN_TTL_MIN,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
)
from app.db.models import (
    Conversation,
    Like,
    Match,
    Report,
    User,
)
from app.deps import CurrentAdminDep, CurrentAdminPinDep, SessionDep
from app.realtime.manager import manager
from app.services import admin as svc
from app.services.profiles import serialize_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── PIN flow ───────────────────────────────────────────────────────────────
class PinIn(BaseModel):
    pin: str = Field(min_length=1, max_length=32)


@router.get("/pin-status")
async def pin_status(
    admin: CurrentAdminDep,
    admin_cookie: Annotated[str | None, Cookie(alias=ADMIN_PIN_COOKIE)] = None,
) -> dict:
    """Lightweight check used by the frontend to decide whether to show the
    PIN modal. ``required: false`` means the server has no PIN configured.
    """
    if not ADMIN_PIN:
        return {"ok": True, "required": False, "ttl_minutes": ADMIN_PIN_TTL_MIN}
    payload = verify_admin_pin(admin_cookie)
    ok = payload is not None and int(payload.get("user_id", 0)) == admin.id
    return {"ok": ok, "required": True, "ttl_minutes": ADMIN_PIN_TTL_MIN}


@router.post("/verify-pin")
async def verify_pin(payload: PinIn, admin: CurrentAdminDep, response: Response) -> dict:
    if not ADMIN_PIN:
        return {"ok": True, "required": False}
    if payload.pin != ADMIN_PIN:
        raise HTTPException(status_code=403, detail="bad_pin")
    token = issue_admin_pin(admin.id)
    response.set_cookie(
        ADMIN_PIN_COOKIE,
        token,
        max_age=ADMIN_PIN_TTL_MIN * 60,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        path="/",
    )
    return {"ok": True, "required": True, "ttl_minutes": ADMIN_PIN_TTL_MIN}


@router.post("/lock")
async def lock_admin(_: CurrentAdminDep, response: Response) -> dict:
    response.delete_cookie(
        ADMIN_PIN_COOKIE,
        path="/",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return {"ok": True}


@router.get("/stats")
async def stats_endpoint(_: CurrentAdminPinDep, db: SessionDep) -> dict:
    return await svc.stats(db)


@router.get("/users")
async def list_users(
    _: CurrentAdminPinDep,
    db: SessionDep,
    q: str = Query(default="", max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int = Query(default=0, ge=0),
) -> dict:
    stmt = select(User).options(selectinload(User.photos)).order_by(User.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(User.email.ilike(like), User.name.ilike(like), User.username.ilike(like))
        )
    rows = (await db.execute(stmt.offset(cursor).limit(limit))).scalars().all()
    return {
        "items": [await serialize_user(db, u, include_phone=True) for u in rows],
        "next": cursor + limit if len(rows) == limit else None,
    }


@router.get("/users/{user_id}")
async def get_user(user_id: int, _: CurrentAdminPinDep, db: SessionDep) -> dict:
    stmt = select(User).where(User.id == user_id).options(selectinload(User.photos))
    user = await db.scalar(stmt)
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    return {"user": await serialize_user(db, user, include_phone=True)}


@router.get("/top/received")
async def top_received(_: CurrentAdminPinDep, db: SessionDep) -> dict:
    return {"items": await svc.top_received(db)}


@router.get("/top/matches")
async def top_matches(_: CurrentAdminPinDep, db: SessionDep) -> dict:
    return {"items": await svc.top_matches(db)}


class BanIn(BaseModel):
    user_id: int


@router.post("/ban")
async def ban_user(payload: BanIn, admin: CurrentAdminPinDep, db: SessionDep) -> dict:
    user = await db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    if user.is_admin and user.id != admin.id:
        raise HTTPException(status_code=403, detail="cannot_ban_admin")
    user.banned = True
    await manager.send_to_user(payload.user_id, {"type": "banned"})
    return {"ok": True}


@router.post("/unban")
async def unban_user(payload: BanIn, _: CurrentAdminPinDep, db: SessionDep) -> dict:
    user = await db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.banned = False
    await manager.send_to_user(payload.user_id, {"type": "unbanned"})
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, _: CurrentAdminPinDep, db: SessionDep) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.deleted = True
    user.hidden = True
    await manager.send_to_user(user_id, {"type": "deleted"})
    return {"ok": True}


@router.post("/users/{user_id}/restore")
async def restore_user(user_id: int, _: CurrentAdminPinDep, db: SessionDep) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.deleted = False
    user.hidden = False
    await manager.send_to_user(user_id, {"type": "unbanned"})
    return {"ok": True}


@router.get("/reports")
async def list_reports(
    _: CurrentAdminPinDep,
    db: SessionDep,
    status: str = Query(default="open"),
) -> dict:
    stmt = select(Report).order_by(Report.created_at.desc())
    if status != "all":
        stmt = stmt.where(Report.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "from_user_id": r.from_user_id,
                "target_user_id": r.target_user_id,
                "reason": r.reason,
                "status": r.status,
                "at": r.created_at.isoformat() + "Z",
            }
            for r in rows
        ]
    }


class ReportActionIn(BaseModel):
    report_id: int
    action: str = Field(pattern="^(resolve|ban)$")


@router.post("/reports/action")
async def report_action(payload: ReportActionIn, _: CurrentAdminPinDep, db: SessionDep) -> dict:
    report = await db.get(Report, payload.report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="report_not_found")
    if payload.action == "resolve":
        report.status = "resolved"
    elif payload.action == "ban":
        target = await db.get(User, report.target_user_id)
        if target is not None and not target.is_admin:
            target.banned = True
        report.status = "banned"
    return {"ok": True}


class BroadcastIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/broadcast")
async def broadcast(payload: BroadcastIn, admin: CurrentAdminPinDep, db: SessionDep) -> dict:
    """Send a system message in every conversation the admin is a part of, plus
    in newly-created conversations to every other user.

    Implementation: insert a ``Message`` row authored by the admin in every
    user's conversation. (Lightweight — no separate "system message" type yet.)
    """
    from app.realtime.events import message_event
    from app.realtime.manager import manager
    from app.services.messaging import (
        conversation_other_user_id,
        create_message,
        get_or_create_conversation,
        serialize_message,
    )

    users = (
        (await db.execute(select(User).where(User.banned.is_(False), User.id != admin.id)))
        .scalars()
        .all()
    )
    sent = 0
    for u in users:
        conv = await get_or_create_conversation(db, admin.id, u.id)
        msg = await create_message(
            db,
            conversation=conv,
            from_user_id=admin.id,
            body=payload.text,
            kind="text",
        )
        serial = await serialize_message(db, msg, current_user_id=admin.id)
        other_id = conversation_other_user_id(conv, admin.id)
        await manager.send_to_user(other_id, message_event(serial))
        sent += 1
    return {"ok": True, "sent": sent}


@router.get("/conversations")
async def list_conversations(
    _: CurrentAdminPinDep,
    db: SessionDep,
    limit: int = Query(default=50, ge=1, le=500),
) -> dict:
    rows = (
        (
            await db.execute(
                select(Conversation)
                .order_by(Conversation.last_message_at.desc().nulls_last())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    items = []
    for c in rows:
        items.append(
            {
                "id": c.id,
                "user_a_id": c.user_a_id,
                "user_b_id": c.user_b_id,
                "last_message_at": c.last_message_at.isoformat() + "Z" if c.last_message_at else None,
            }
        )
    return {"items": items}


@router.get("/likes/recent")
async def recent_likes(_: CurrentAdminPinDep, db: SessionDep) -> dict:
    rows = (
        (await db.execute(select(Like).order_by(Like.created_at.desc()).limit(50))).scalars().all()
    )
    return {
        "items": [
            {
                "from": r.from_user_id,
                "to": r.to_user_id,
                "kind": r.kind,
                "at": r.created_at.isoformat() + "Z",
            }
            for r in rows
        ]
    }


@router.get("/matches/recent")
async def recent_matches(_: CurrentAdminPinDep, db: SessionDep) -> dict:
    rows = (
        (await db.execute(select(Match).order_by(Match.created_at.desc()).limit(50)))
        .scalars()
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "user_a": r.user_a_id,
                "user_b": r.user_b_id,
                "at": r.created_at.isoformat() + "Z",
            }
            for r in rows
        ]
    }
