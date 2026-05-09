"""Registration endpoint -- mirrors the final state of the FSM in bot.py.

The FSM steps (start_agreement → privacy → age → gender → looking_for → name
→ description → photo → phone → confirmation) are enforced client-side by the
9-step React wizard. The backend accepts the final assembled profile in one
POST and writes the same dict shape ``bot.py:process_confirmation`` writes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.db import Database
from app.deps import current_user_id, db_dep, session_payload

router = APIRouter(prefix="/api", tags=["registration"])


class PhotoIn(BaseModel):
    type: Literal["photo", "video"]
    file_id: str


class RegistrationPayload(BaseModel):
    age: int = Field(ge=14, le=100)
    gender: Literal["Девушка", "Парень"]
    looking_for: Literal["Девушки", "Парни", "Все равно"]
    name: str = Field(min_length=1, max_length=64)
    description: str | None = ""
    photos: list[PhotoIn] = Field(min_length=1, max_length=3)
    phone: str = Field(min_length=3, max_length=32)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()

    @field_validator("description")
    @classmethod
    def strip_desc(cls, v: str | None) -> str:
        return (v or "").strip()


@router.post("/register")
async def register(
    payload: RegistrationPayload,
    user_id: int = Depends(current_user_id),
    session: dict = Depends(session_payload),
    db: Database = Depends(db_dep),
) -> dict:
    if db.get_user(user_id):
        raise HTTPException(status_code=409, detail="already_registered")

    profile = {
        "user_id": user_id,
        "username": session.get("username"),
        "age": payload.age,
        "gender": payload.gender,
        "looking_for": payload.looking_for,
        "name": payload.name,
        "description": payload.description or "",
        "photos": [p.model_dump() for p in payload.photos],
        "phone": payload.phone,
        "created_at": datetime.now().isoformat(),
        "likes_sent": [],
        "likes_received": [],
        "matches": [],
        "dislikes": [],
        "hidden": False,
    }
    db.add_user(user_id, profile)
    return {"ok": True, "profile": profile}
