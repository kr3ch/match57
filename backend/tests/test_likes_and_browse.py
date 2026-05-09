"""Likes + browse logic equivalence with bot.py."""

from __future__ import annotations

from app.db import Database
from app.services.likes import add_dislike, do_like
from app.services.profiles import filter_candidates


def make_profile(uid, gender="Парень", looking_for="Все равно"):
    return {
        "user_id": uid,
        "username": f"u{uid}",
        "age": 18,
        "gender": gender,
        "looking_for": looking_for,
        "name": f"User{uid}",
        "description": "",
        "photos": [],
        "phone": "",
        "created_at": "2024-01-01T00:00:00",
        "likes_sent": [],
        "likes_received": [],
        "matches": [],
        "dislikes": [],
        "hidden": False,
    }


def test_do_like_creates_match(tmp_path):
    db = Database(str(tmp_path / "db.json"))
    db.add_user(1, make_profile(1))
    db.add_user(2, make_profile(2))
    assert do_like(db, 1, 2) is False
    assert do_like(db, 2, 1) is True
    assert 2 in db.get_user(1)["matches"]
    assert 1 in db.get_user(2)["matches"]


def test_filter_excludes_seen_and_self(tmp_path):
    db = Database(str(tmp_path / "db.json"))
    db.add_user(1, make_profile(1, looking_for="Все равно"))
    db.add_user(2, make_profile(2))
    db.add_user(3, make_profile(3))
    add_dislike(db, 1, 2)
    do_like(db, 1, 3)
    assert filter_candidates(db, 1) == []


def test_filter_by_gender(tmp_path):
    db = Database(str(tmp_path / "db.json"))
    db.add_user(1, make_profile(1, looking_for="Девушки"))
    db.add_user(2, make_profile(2, gender="Парень"))
    db.add_user(3, make_profile(3, gender="Девушка"))
    candidates = filter_candidates(db, 1)
    assert {p["user_id"] for p in candidates} == {3}
