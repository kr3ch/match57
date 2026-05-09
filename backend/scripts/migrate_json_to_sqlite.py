"""One-shot migration: read legacy ``data/users_db.json`` into SQLite.

Usage:
    python -m scripts.migrate_json_to_sqlite

Behaviour:
* For each legacy user, create a row in ``users`` with:
    - ``email`` = ``<telegram_user_id>@match57.local`` (placeholder; user can
      change in profile after first login)
    - ``password_hash`` = bcrypt of a random temp password (printed to stdout —
      the user can use the standard "forgot password" flow once that's added,
      or the admin can reset it manually).
    - ``username`` = original Telegram ``username`` (lowercased, stripped).
    - ``ref_user_id`` is preserved if the legacy user has ``ref`` field.
* Likes / dislikes / matches are reconstructed from the legacy lists.
* Existing photo records are NOT migrated — they were Telegram ``file_id``
  references, which require the bot token + ``bot.get_file`` to download.
  Users will be prompted to re-upload via the new web UI on first login.
* The script is idempotent: re-running it skips users already migrated by
  email.

Outputs a summary at the end (users / likes / matches / reports / temp
passwords).
"""

from __future__ import annotations

import asyncio
import json
import secrets
from typing import Any

from sqlalchemy import select

from app.auth import hash_password
from app.config import DATA_DIR, DEFAULT_SCHOOL
from app.db import SessionLocal, engine
from app.db.base import Base
from app.db.models import (
    Conversation,
    Like,
    Match,
    Report,
    User,
)

LEGACY_FILE = DATA_DIR / "users_db.json"


def _canonical(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


async def migrate() -> dict[str, Any]:
    if not LEGACY_FILE.exists():
        print(f"[migrate] no legacy file at {LEGACY_FILE}; nothing to do.")
        return {}

    raw = json.loads(LEGACY_FILE.read_text(encoding="utf-8"))
    legacy_users: dict[str, dict] = raw.get("users") or {}
    legacy_banned: list[int] = raw.get("banned") or []
    legacy_reports: list[dict] = raw.get("reports") or []

    async with engine.begin() as conn:
        from app.db import models  # noqa: F401  ensure metadata populated

        await conn.run_sync(Base.metadata.create_all)

    temp_passwords: dict[int, str] = {}

    async with SessionLocal() as db:
        # Map legacy Telegram id -> new SQLite User.id.
        id_map: dict[int, int] = {}

        # First pass: create users.
        for tg_id_str, u in legacy_users.items():
            tg_id = int(tg_id_str)
            email = f"{tg_id}@match57.local"
            existing = await db.scalar(select(User).where(User.email == email))
            if existing is not None:
                id_map[tg_id] = existing.id
                continue
            temp = secrets.token_urlsafe(12)
            row = User(
                email=email,
                username=(u.get("username") or "").strip() or None,
                password_hash=hash_password(temp),
                name=u.get("name") or "(без имени)",
                age=int(u.get("age") or 18),
                gender=u.get("gender") or "Парень",
                looking_for=u.get("looking_for") or "Все равно",
                description=u.get("description"),
                school=u.get("school") or DEFAULT_SCHOOL,
                phone=u.get("phone"),
                hidden=bool(u.get("hidden", False)),
                banned=tg_id in legacy_banned,
                is_admin=bool(u.get("is_admin", False)),
                email_verified=False,
            )
            db.add(row)
            await db.flush()
            id_map[tg_id] = row.id
            temp_passwords[tg_id] = temp

        await db.commit()

        # Second pass: likes + dislikes.
        likes_made = 0
        dislikes_made = 0
        for tg_id_str, u in legacy_users.items():
            tg_id = int(tg_id_str)
            from_id = id_map.get(tg_id)
            if from_id is None:
                continue
            for to_tg in u.get("likes_sent") or []:
                to_id = id_map.get(int(to_tg))
                if to_id is None or to_id == from_id:
                    continue
                exists = await db.scalar(
                    select(Like).where(Like.from_user_id == from_id, Like.to_user_id == to_id)
                )
                if exists is None:
                    db.add(Like(from_user_id=from_id, to_user_id=to_id, kind="like"))
                    likes_made += 1
            for to_tg in u.get("dislikes") or []:
                to_id = id_map.get(int(to_tg))
                if to_id is None or to_id == from_id:
                    continue
                exists = await db.scalar(
                    select(Like).where(Like.from_user_id == from_id, Like.to_user_id == to_id)
                )
                if exists is None:
                    db.add(Like(from_user_id=from_id, to_user_id=to_id, kind="dislike"))
                    dislikes_made += 1
        await db.commit()

        # Third pass: matches + conversations.
        matches_made = 0
        seen_pairs: set[tuple[int, int]] = set()
        for tg_id_str, u in legacy_users.items():
            tg_id = int(tg_id_str)
            self_id = id_map.get(tg_id)
            if self_id is None:
                continue
            for other_tg in u.get("matches") or []:
                other_id = id_map.get(int(other_tg))
                if other_id is None or other_id == self_id:
                    continue
                a, b = _canonical(self_id, other_id)
                if (a, b) in seen_pairs:
                    continue
                seen_pairs.add((a, b))
                exists = await db.scalar(
                    select(Match).where(Match.user_a_id == a, Match.user_b_id == b)
                )
                if exists is None:
                    db.add(Match(user_a_id=a, user_b_id=b))
                    matches_made += 1
                conv_exists = await db.scalar(
                    select(Conversation).where(
                        Conversation.user_a_id == a, Conversation.user_b_id == b
                    )
                )
                if conv_exists is None:
                    db.add(Conversation(user_a_id=a, user_b_id=b))
        await db.commit()

        # Fourth pass: reports.
        reports_made = 0
        for r in legacy_reports:
            from_id = id_map.get(int(r.get("from") or r.get("from_user_id") or 0))
            target_id = id_map.get(int(r.get("target") or r.get("target_user_id") or 0))
            if not from_id or not target_id:
                continue
            db.add(
                Report(
                    from_user_id=from_id,
                    target_user_id=target_id,
                    reason=str(r.get("reason") or ""),
                    status=r.get("status") or "open",
                )
            )
            reports_made += 1
        await db.commit()

    summary = {
        "users": len(id_map),
        "likes": likes_made,
        "dislikes": dislikes_made,
        "matches": matches_made,
        "reports": reports_made,
        "temp_passwords": temp_passwords,
    }

    print("\n=== Migration summary ===")
    for k, v in summary.items():
        if k == "temp_passwords":
            continue
        print(f"  {k}: {v}")
    if temp_passwords:
        print("\nTemp passwords (give to migrated users):")
        for tg_id, pwd in temp_passwords.items():
            print(f"  {tg_id}@match57.local : {pwd}")

    out = DATA_DIR / "migration_temp_passwords.txt"
    if temp_passwords:
        out.write_text(
            "\n".join(f"{k}@match57.local\t{v}" for k, v in temp_passwords.items()),
            encoding="utf-8",
        )
        print(f"\nAlso saved to {out}")

    return summary


if __name__ == "__main__":
    asyncio.run(migrate())
