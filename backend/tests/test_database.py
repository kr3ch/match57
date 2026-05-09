"""Round-trip checks: every Database method behaves as bot.py expects."""

from __future__ import annotations

import json

from app.db import Database


def make_profile(uid: int, name: str = "X", gender: str = "Парень") -> dict:
    return {
        "user_id": uid,
        "username": f"u{uid}",
        "age": 18,
        "gender": gender,
        "looking_for": "Все равно",
        "name": name,
        "description": "",
        "photos": [],
        "phone": "+7",
        "created_at": "2024-01-01T00:00:00",
        "likes_sent": [],
        "likes_received": [],
        "matches": [],
        "dislikes": [],
        "hidden": False,
    }


def test_add_get_update(tmp_path):
    f = tmp_path / "db.json"
    db = Database(str(f))
    db.add_user(1, make_profile(1))
    assert db.get_user(1)["name"] == "X"
    p = db.get_user(1)
    p["name"] = "Y"
    db.update_user(1, p)
    assert db.get_user(1)["name"] == "Y"
    # Profiles list mirrors users
    assert any(prof.get("user_id") == 1 and prof["name"] == "Y" for prof in db.data["profiles"])


def test_get_all_profiles_excludes(tmp_path):
    f = tmp_path / "db.json"
    db = Database(str(f))
    db.add_user(1, make_profile(1))
    db.add_user(2, make_profile(2))
    p2 = db.get_user(2)
    p2["hidden"] = True
    db.update_user(2, p2)
    db.add_user(3, make_profile(3))
    db.ban_user(3)
    assert {p["user_id"] for p in db.get_all_profiles(1)} == set()


def test_ban_unban(tmp_path):
    f = tmp_path / "db.json"
    db = Database(str(f))
    assert not db.is_banned(7)
    db.ban_user(7)
    assert db.is_banned(7)
    db.unban_user(7)
    assert not db.is_banned(7)


def test_report_lifecycle(tmp_path):
    f = tmp_path / "db.json"
    db = Database(str(f))
    db.add_report(1, 2, "🤡 Фейковая анкета")
    assert len(db.get_unresolved_reports()) == 1
    db.resolve_report(0)
    assert len(db.get_unresolved_reports()) == 0


def test_persist_to_disk(tmp_path):
    f = tmp_path / "db.json"
    db = Database(str(f))
    db.add_user(1, make_profile(1))
    raw = json.loads(f.read_text(encoding="utf-8"))
    assert "1" in raw["users"]
    assert raw["users"]["1"]["name"] == "X"
