"""Mutual-like / match logic shared by the bot and the web backend.

The function is a pure rewrite of ``do_like`` from the original bot.py with
identical semantics:

* records the from->to like in ``likes_sent`` / ``likes_received``,
* on a mutual like adds both sides to ``matches``,
* returns ``True`` iff this call produced (or already had) a match,
* returns ``False`` if either user is missing.
"""

from __future__ import annotations

from app.db import Database


def do_like(db: Database, from_user_id: int, to_user_id: int) -> bool:
    user_profile = db.get_user(from_user_id)
    viewed_profile = db.get_user(to_user_id)
    if not user_profile or not viewed_profile:
        return False
    if to_user_id in user_profile.get("likes_sent", []):
        return to_user_id in user_profile.get("matches", [])

    user_profile.setdefault("likes_sent", []).append(to_user_id)
    viewed_profile.setdefault("likes_received", []).append(from_user_id)

    is_match = from_user_id in viewed_profile.get("likes_sent", [])
    if is_match:
        user_profile.setdefault("matches", []).append(to_user_id)
        viewed_profile.setdefault("matches", []).append(from_user_id)

    db.update_user(from_user_id, user_profile)
    db.update_user(to_user_id, viewed_profile)
    return is_match


def add_dislike(db: Database, from_user_id: int, to_user_id: int) -> None:
    user_profile = db.get_user(from_user_id)
    if not user_profile:
        return
    user_profile.setdefault("dislikes", [])
    if to_user_id not in user_profile["dislikes"]:
        user_profile["dislikes"].append(to_user_id)
        db.update_user(from_user_id, user_profile)


def format_contact(profile: dict | None) -> str:
    """Same helper as bot.py: '@username (Name)' or fallback hint."""
    if not profile:
        return "Пользователь (анкета удалена)"
    username = profile.get("username")
    name = profile.get("name", "Пользователь")
    if username:
        return f"@{username} ({name})"
    return f"{name} (попроси написать первым — у него нет username)"
