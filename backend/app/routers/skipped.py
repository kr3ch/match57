"""Endpoints for the '👀 Отвергнутые' flow."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.db import Database
from app.deps import current_user_id, db_dep
from app.services.profiles import build_caption, clear_skipped, list_skipped

router = APIRouter(prefix="/api/skipped", tags=["skipped"])


def _public(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": p["user_id"],
        "name": p["name"],
        "age": p["age"],
        "gender": p["gender"],
        "description": p.get("description", ""),
        "photos": p.get("photos", []),
    }


@router.get("")
async def list_(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, Any]:
    items: list[dict[str, Any]] = list_skipped(db, user_id)
    return {
        "items": [{**_public(p), "caption": build_caption(p)} for p in items],
        "count": len(items),
    }


@router.post("/clear")
async def clear(
    user_id: int = Depends(current_user_id), db: Database = Depends(db_dep)
) -> dict[str, int]:
    removed = clear_skipped(db, user_id)
    return {"removed": removed}
