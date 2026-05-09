"""Shared JSON database used by both bot.py and the FastAPI backend.

The class below is the **same** Database that lived inside bot.py originally:
identical fields, identical method signatures, identical on-disk format. It is
extracted so the web backend and the legacy bot can read/write the same
``/data/users_db.json`` file without diverging behaviour.

NOTE: Do not change semantics here. Any new convenience helpers must be added
as additional methods so the bot's existing call sites keep working byte-for-
byte the same.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any


class Database:
    def __init__(self, filename: str):
        self.filename = filename
        self.data = self.load()

    # ----- persistence --------------------------------------------------
    def load(self) -> dict[str, Any]:
        if os.path.exists(self.filename):
            with open(self.filename, encoding="utf-8") as f:
                return json.load(f)
        return {"users": {}, "profiles": [], "banned": [], "reports": []}

    def save(self) -> None:
        self.data.setdefault("banned", [])
        self.data.setdefault("reports", [])
        os.makedirs(os.path.dirname(self.filename) or ".", exist_ok=True)
        with open(self.filename, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ----- users / profiles --------------------------------------------
    def add_user(self, user_id: int, profile_data: dict[str, Any]) -> None:
        self.data["users"][str(user_id)] = profile_data
        self.data["profiles"].append(profile_data)
        self.save()

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        return self.data["users"].get(str(user_id))

    def update_user(self, user_id: int, profile_data: dict[str, Any]) -> None:
        self.data["users"][str(user_id)] = profile_data
        for i, profile in enumerate(self.data["profiles"]):
            if profile.get("user_id") == user_id:
                self.data["profiles"][i] = profile_data
                break
        self.save()

    def get_all_profiles(self, exclude_user_id: int) -> list[dict[str, Any]]:
        banned = self.data.get("banned", [])
        return [
            p
            for p in self.data["profiles"]
            if p.get("user_id") != exclude_user_id
            and p.get("user_id") not in banned
            and not p.get("hidden", False)
        ]

    def delete_user(self, user_id: int) -> None:
        uid_str = str(user_id)
        if uid_str in self.data["users"]:
            del self.data["users"][uid_str]
        self.data["profiles"] = [p for p in self.data["profiles"] if p.get("user_id") != user_id]
        self.save()

    # ----- moderation --------------------------------------------------
    def is_banned(self, user_id: int) -> bool:
        return user_id in self.data.get("banned", [])

    def ban_user(self, user_id: int) -> None:
        self.data.setdefault("banned", [])
        if user_id not in self.data["banned"]:
            self.data["banned"].append(user_id)
        self.save()

    def unban_user(self, user_id: int) -> None:
        self.data.setdefault("banned", [])
        if user_id in self.data["banned"]:
            self.data["banned"].remove(user_id)
        self.save()

    def add_report(self, from_user_id: int, on_user_id: int, reason: str) -> None:
        self.data.setdefault("reports", [])
        self.data["reports"].append(
            {
                "from": from_user_id,
                "on": on_user_id,
                "reason": reason,
                "at": datetime.now().isoformat(),
                "resolved": False,
            }
        )
        self.save()

    def get_reports(self) -> list[dict[str, Any]]:
        return self.data.get("reports", [])

    def get_unresolved_reports(self) -> list[dict[str, Any]]:
        return [r for r in self.data.get("reports", []) if not r.get("resolved", False)]

    def resolve_report(self, index: int) -> None:
        reports = self.data.get("reports", [])
        if 0 <= index < len(reports):
            reports[index]["resolved"] = True
            self.save()

    # ----- stats helpers -----------------------------------------------
    def get_new_today_count(self) -> int:
        today = datetime.now().date()
        count = 0
        for u in self.data["users"].values():
            try:
                if datetime.fromisoformat(u.get("created_at", "")).date() == today:
                    count += 1
            except Exception:
                pass
        return count


# Singleton -- shared between FastAPI and the polling bot when they run in the
# same process. When the bot runs in its own process they each maintain their
# own Database object pointed at the same JSON file (the file is the source of
# truth and both processes save() after every mutation).
_db_singleton: Database | None = None


def get_db(filename: str | None = None) -> Database:
    """Return the process-local Database singleton.

    If ``filename`` is provided it is honoured on the first call; subsequent
    calls return the same instance regardless of the argument (matching the
    original ``db = Database(DB_FILE)`` module-level pattern in bot.py).
    """
    global _db_singleton
    if _db_singleton is None:
        from app.config import DB_FILE  # local import to avoid cycles

        _db_singleton = Database(filename or DB_FILE)
    return _db_singleton
