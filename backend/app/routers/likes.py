"""Incoming likes ('Узнать кто там' / 'Проверить' in bot.py)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.db import Database
from app.deps import current_user_id, db_dep
from app.services.profiles import build_caption

router = APIRouter(prefix="/api/likes", tags=["likes"])


@router.get("/incoming")
async def incoming(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, Any]:
    profile = db.get_user(user_id) or {}
    likes_received: list[int] = profile.get("likes_received", [])
    items = []
    for lid in likes_received:
        liker = db.get_user(lid)
        if liker:
            items.append(
                {
                    "user_id": liker["user_id"],
                    "name": liker["name"],
                    "age": liker["age"],
                    "gender": liker["gender"],
                    "description": liker.get("description", ""),
                    "photos": liker.get("photos", []),
                    "caption": build_caption(liker),
                }
            )
    return {"items": items, "count": len(items)}


@router.get("/matches")
async def matches(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, Any]:
    profile = db.get_user(user_id) or {}
    out = []
    for mid in profile.get("matches", []):
        m = db.get_user(mid)
        if not m:
            continue
        out.append(
            {
                "user_id": m["user_id"],
                "name": m["name"],
                "age": m["age"],
                "gender": m["gender"],
                "username": m.get("username"),
                "photos": m.get("photos", []),
            }
        )
    return {"items": out, "count": len(out)}
