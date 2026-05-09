"""Browse / recommendation logic, ported from ``show_next_profile`` in bot.py.

Pure functions: take a Database + user_id, return a profile or ``None``. The
state-machine bookkeeping (current_profile_index, viewing_user_id) lives on
the API consumer side -- on the web that's a per-session cursor stored in a
cookie or in memory; in the bot it stays in FSMContext.
"""

from __future__ import annotations

from typing import Any

from app.db import Database


def filter_candidates(db: Database, user_id: int) -> list[dict[str, Any]]:
    """All profiles eligible to be shown to ``user_id`` right now.

    Matches the filtering used in bot.py:show_next_profile:
      * looking_for narrows by gender ("Девушки" / "Парни" / "Все равно"),
      * never show banned, hidden or self profiles,
      * exclude already-liked and already-disliked candidates.
    """
    user_profile = db.get_user(user_id)
    if not user_profile:
        return []

    all_profiles = db.get_all_profiles(user_id)
    looking_for = user_profile.get("looking_for", "Все равно")
    if looking_for == "Девушки":
        profiles = [p for p in all_profiles if p.get("gender") == "Девушка"]
    elif looking_for == "Парни":
        profiles = [p for p in all_profiles if p.get("gender") == "Парень"]
    else:
        profiles = list(all_profiles)

    already_seen = set(user_profile.get("likes_sent", [])) | set(user_profile.get("dislikes", []))
    return [p for p in profiles if p["user_id"] not in already_seen]


def get_profile_at(db: Database, user_id: int, index: int) -> dict[str, Any] | None:
    """Return the profile at position ``index`` in the filtered list.

    Wraps around the way the bot does (resets to 0 when overflowing).
    Returns ``None`` when there are no candidates at all.
    """
    candidates = filter_candidates(db, user_id)
    if not candidates:
        return None
    if index < 0 or index >= len(candidates):
        index = 0
    return candidates[index]


def list_skipped(db: Database, user_id: int) -> list[dict[str, Any]]:
    """Profiles in user.dislikes still worth re-showing.

    Excludes those already liked since (matches bot.py:show_skipped_profile)
    and those whose accounts no longer exist.
    """
    user_profile = db.get_user(user_id)
    if not user_profile:
        return []
    dislikes = user_profile.get("dislikes", [])
    likes_sent = set(user_profile.get("likes_sent", []))
    out: list[dict[str, Any]] = []
    for uid in dislikes:
        p = db.get_user(uid)
        if p and uid not in likes_sent:
            out.append(p)
    return out


def clear_skipped(db: Database, user_id: int) -> int:
    user_profile = db.get_user(user_id)
    if not user_profile:
        return 0
    removed = len(user_profile.get("dislikes", []))
    user_profile["dislikes"] = []
    db.update_user(user_id, user_profile)
    return removed


def hide_profile(db: Database, user_id: int) -> None:
    user_profile = db.get_user(user_id)
    if user_profile:
        user_profile["hidden"] = True
        db.update_user(user_id, user_profile)


def unhide_profile(db: Database, user_id: int) -> None:
    user_profile = db.get_user(user_id)
    if user_profile and user_profile.get("hidden"):
        user_profile["hidden"] = False
        db.update_user(user_id, user_profile)


def build_caption(profile: dict[str, Any]) -> str:
    caption = f"{profile['name']}, {profile['age']}"
    if profile.get("description"):
        caption += f"\n\n{profile['description']}"
    return caption
