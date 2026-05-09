"""Admin REST endpoints. Mirrors every admin action from bot.py:

panel: stats / top-active / loners / top-likes / top-refs / new-today
users: list (paginated), search, browse (prev/next/delete/ban/activity/msg)
moderation: ban / unban / delete / direct message
broadcast: bulk message
reports: list, resolve, ban+resolve, delete+resolve

All endpoints are guarded by ``admin_only`` (Telegram user_id in ADMIN_IDS).
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.bot_client import safe_send_message
from app.db import Database
from app.deps import admin_only, db_dep
from app.services import admin as admin_svc

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def stats(_: int = Depends(admin_only), db: Database = Depends(db_dep)) -> dict[str, Any]:
    return admin_svc.stats(db)


@router.get("/top-active")
async def top_active(
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
    limit: int = 10,
) -> dict[str, Any]:
    return {"items": admin_svc.top_active(db, limit)}


@router.get("/top-likes")
async def top_likes(
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
    limit: int = 10,
) -> dict[str, Any]:
    return {"items": admin_svc.top_likes(db, limit)}


@router.get("/top-referrers")
async def top_referrers(
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
    limit: int = 10,
) -> dict[str, Any]:
    return {"items": admin_svc.top_referrers(db, limit)}


@router.get("/loners")
async def loners(_: int = Depends(admin_only), db: Database = Depends(db_dep)) -> dict[str, Any]:
    return {"items": admin_svc.loners(db)}


@router.get("/new-today")
async def new_today(_: int = Depends(admin_only), db: Database = Depends(db_dep)) -> dict[str, Any]:
    return {"items": admin_svc.new_today(db)}


@router.get("/users")
async def users(
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
    page: int = 0,
    page_size: int = 10,
) -> dict[str, Any]:
    items, total = admin_svc.all_users_paginated(db, page, page_size)
    banned = set(db.data.get("banned", []))
    out = []
    for _uid, u in items:
        out.append(
            {
                **u,
                "banned": u.get("user_id") in banned,
            }
        )
    return {
        "items": out,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page + 1) * page_size < total,
    }


@router.get("/users/search")
async def search(
    q: str,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    return {"items": admin_svc.search_users(db, q)}


@router.get("/users/{user_id}")
async def user_detail(
    user_id: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    profile = db.get_user(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="not_found")
    banned = user_id in db.data.get("banned", [])
    return {**profile, "banned": banned}


class BanIn(BaseModel):
    user_id: int


@router.post("/users/{user_id}/ban")
async def ban(
    user_id: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    db.ban_user(user_id)
    await safe_send_message(
        user_id,
        "🚫 Твой аккаунт заблокирован администратором.",
    )
    return {"ok": "banned", "user_id": user_id}


@router.post("/users/{user_id}/unban")
async def unban(
    user_id: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    db.unban_user(user_id)
    await safe_send_message(user_id, "✅ Твой аккаунт разблокирован.")
    return {"ok": "unbanned", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="not_found")
    db.delete_user(user_id)
    return {"ok": "deleted", "user_id": user_id}


class DMIn(BaseModel):
    user_id: int
    text: str


@router.post("/dm")
async def direct_message(
    payload: DMIn,
    _: int = Depends(admin_only),
) -> dict[str, Any]:
    sent = await safe_send_message(
        payload.user_id, f"📩 Сообщение от администратора:\n\n{payload.text}"
    )
    return {"delivered": sent}


class BroadcastIn(BaseModel):
    text: str


@router.post("/broadcast")
async def broadcast(
    payload: BroadcastIn,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    sent = 0
    failed = 0
    text = f"📢 Сообщение от администрации:\n\n{payload.text}"
    for uid in list(db.data["users"].keys()):
        ok = await safe_send_message(int(uid), text)
        if ok:
            sent += 1
        else:
            failed += 1
        await asyncio.sleep(0.05)
    return {"sent": sent, "failed": failed}


@router.get("/reports")
async def reports(_: int = Depends(admin_only), db: Database = Depends(db_dep)) -> dict[str, Any]:
    raw = db.get_reports()
    out: list[dict[str, Any]] = []
    for i, r in enumerate(raw):
        target = db.get_user(r.get("on", 0)) or {}
        sender = db.get_user(r.get("from", 0)) or {}
        out.append(
            {
                "index": i,
                "from": r.get("from"),
                "from_name": sender.get("name"),
                "from_username": sender.get("username"),
                "on": r.get("on"),
                "on_name": target.get("name"),
                "on_username": target.get("username"),
                "reason": r.get("reason"),
                "at": r.get("at"),
                "resolved": r.get("resolved", False),
            }
        )
    return {"items": out}


@router.post("/reports/{index}/resolve")
async def resolve(
    index: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    db.resolve_report(index)
    return {"ok": "resolved", "index": index}


@router.post("/reports/{index}/ban-target")
async def report_ban_target(
    index: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    reports_list = db.get_reports()
    if index < 0 or index >= len(reports_list):
        raise HTTPException(status_code=404, detail="report_not_found")
    target_id = reports_list[index].get("on")
    if target_id:
        db.ban_user(int(target_id))
        await safe_send_message(int(target_id), "🚫 Твой аккаунт заблокирован администратором.")
    db.resolve_report(index)
    return {"ok": "banned_and_resolved"}


@router.post("/reports/{index}/delete-target")
async def report_delete_target(
    index: int,
    _: int = Depends(admin_only),
    db: Database = Depends(db_dep),
) -> dict[str, Any]:
    reports_list = db.get_reports()
    if index < 0 or index >= len(reports_list):
        raise HTTPException(status_code=404, detail="report_not_found")
    target_id = reports_list[index].get("on")
    if target_id and db.get_user(int(target_id)):
        db.delete_user(int(target_id))
    db.resolve_report(index)
    return {"ok": "deleted_and_resolved"}
