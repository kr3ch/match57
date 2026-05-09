"""User reports (``POST /api/reports``)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select

from app.db.models import Report, User
from app.deps import CurrentUserDep, SessionDep

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportIn(BaseModel):
    target_id: int
    reason: str = Field(min_length=1, max_length=2000)


@router.post("")
async def create_report(payload: ReportIn, user: CurrentUserDep, db: SessionDep) -> dict:
    if payload.target_id == user.id:
        raise HTTPException(status_code=400, detail="cannot_report_self")
    target = await db.get(User, payload.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="user_not_found")

    duplicate = await db.scalar(
        select(Report).where(
            Report.from_user_id == user.id,
            Report.target_user_id == payload.target_id,
            Report.status == "open",
        )
    )
    if duplicate is not None:
        return {"ok": True, "duplicate": True}

    report = Report(
        from_user_id=user.id,
        target_user_id=payload.target_id,
        reason=payload.reason.strip(),
        status="open",
    )
    db.add(report)
    return {"ok": True}


@router.get("/mine")
async def my_reports(user: CurrentUserDep, db: SessionDep) -> dict:
    res = await db.execute(
        select(Report).where(or_(Report.from_user_id == user.id, Report.target_user_id == user.id))
    )
    return {
        "items": [
            {
                "id": r.id,
                "from_user_id": r.from_user_id,
                "target_user_id": r.target_user_id,
                "reason": r.reason,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in res.scalars()
        ]
    }
