"""Helpers for building outbound WebSocket event dicts.

Keeping the event shapes in one place makes it easy to keep frontend in sync.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def message_event(message: dict[str, Any]) -> dict[str, Any]:
    return {"type": "message", "message": message}


def typing_event(conversation_id: int, user_id: int, is_typing: bool) -> dict[str, Any]:
    return {
        "type": "typing",
        "conversation_id": conversation_id,
        "user_id": user_id,
        "is_typing": is_typing,
    }


def read_event(message_id: int, user_id: int, conversation_id: int) -> dict[str, Any]:
    return {
        "type": "read",
        "message_id": message_id,
        "user_id": user_id,
        "conversation_id": conversation_id,
    }


def presence_event(user_id: int, online: bool, last_seen_at: datetime | None) -> dict[str, Any]:
    return {
        "type": "presence",
        "user_id": user_id,
        "online": online,
        "last_seen_at": _iso(last_seen_at),
    }


def match_event(other: dict[str, Any], conversation_id: int) -> dict[str, Any]:
    return {"type": "match", "user": other, "conversation_id": conversation_id}


def like_event(from_user: dict[str, Any]) -> dict[str, Any]:
    return {"type": "like", "from_user": from_user}


def reaction_event(
    message_id: int, user_id: int, emoji: str, removed: bool = False
) -> dict[str, Any]:
    return {
        "type": "reaction",
        "message_id": message_id,
        "user_id": user_id,
        "emoji": emoji,
        "removed": removed,
    }


__all__ = [
    "like_event",
    "match_event",
    "message_event",
    "presence_event",
    "reaction_event",
    "read_event",
    "typing_event",
]
