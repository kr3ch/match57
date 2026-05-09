"""Admin-side aggregations ported from bot.py admin handlers.

All functions are read-only (or trivially mutating via the Database) so they
can be reused by both the Telegram admin panel and the web admin pages.
"""

from __future__ import annotations

from typing import Any

from app.db import Database


def stats(db: Database) -> dict[str, Any]:
    users = db.data["users"]
    total = len(users)
    guys = sum(1 for u in users.values() if u.get("gender") == "Парень")
    girls = sum(1 for u in users.values() if u.get("gender") == "Девушка")
    total_matches = sum(len(u.get("matches", [])) for u in users.values()) // 2
    total_likes = sum(len(u.get("likes_sent", [])) for u in users.values())
    total_referrals = sum(len(u.get("referrals", [])) for u in users.values())
    loners = sum(1 for u in users.values() if len(u.get("matches", [])) == 0)
    matched = sum(1 for u in users.values() if len(u.get("matches", [])) > 0)
    hidden_count = sum(1 for u in users.values() if u.get("hidden", False))
    new_today = db.get_new_today_count()
    banned_count = len(db.data.get("banned", []))
    reports_count = len(db.get_reports())
    unresolved = len(db.get_unresolved_reports())
    return {
        "total": total,
        "guys": guys,
        "girls": girls,
        "total_likes": total_likes,
        "total_matches": total_matches,
        "total_referrals": total_referrals,
        "loners": loners,
        "matched": matched,
        "hidden": hidden_count,
        "new_today": new_today,
        "banned": banned_count,
        "reports": reports_count,
        "unresolved_reports": unresolved,
    }


def top_active(db: Database, limit: int = 10) -> list[dict[str, Any]]:
    return sorted(
        db.data["users"].values(),
        key=lambda u: len(u.get("likes_sent", [])) + len(u.get("matches", [])),
        reverse=True,
    )[:limit]


def top_likes(db: Database, limit: int = 10) -> list[dict[str, Any]]:
    return sorted(
        db.data["users"].values(),
        key=lambda u: len(u.get("likes_received", [])),
        reverse=True,
    )[:limit]


def top_referrers(db: Database, limit: int = 10) -> list[dict[str, Any]]:
    return sorted(
        [u for u in db.data["users"].values() if u.get("referrals")],
        key=lambda u: len(u.get("referrals", [])),
        reverse=True,
    )[:limit]


def loners(db: Database) -> list[dict[str, Any]]:
    return [u for u in db.data["users"].values() if not u.get("matches")]


def new_today(db: Database) -> list[dict[str, Any]]:
    from datetime import datetime

    today = datetime.now().date()
    out: list[dict[str, Any]] = []
    for u in db.data["users"].values():
        try:
            if datetime.fromisoformat(u.get("created_at", "")).date() == today:
                out.append(u)
        except Exception:
            pass
    return out


def search_users(db: Database, query: str) -> list[dict[str, Any]]:
    q = (query or "").strip().lstrip("@").lower()
    if not q:
        return []
    out: list[dict[str, Any]] = []
    for u in db.data["users"].values():
        username = (u.get("username") or "").lower()
        name = (u.get("name") or "").lower()
        if q in username or q in name or q == str(u.get("user_id")):
            out.append(u)
    return out


def all_users_paginated(
    db: Database, page: int, page_size: int = 10
) -> tuple[list[tuple[str, dict[str, Any]]], int]:
    items = list(db.data["users"].items())
    items.sort(key=lambda kv: kv[1].get("created_at", ""))
    total = len(items)
    start = max(page, 0) * page_size
    end = min(start + page_size, total)
    return items[start:end], total
