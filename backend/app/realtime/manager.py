"""In-memory WebSocket connection manager.

Maps ``user_id → set[WebSocket]`` so a single user with multiple tabs receives
events on every tab. ``send_to_user`` is fire-and-forget (drops dead sockets);
``is_online`` returns whether at least one tab is connected.

For multi-process deployment you'd back this with Redis pub/sub, but for the
single-process FastAPI server this is fine.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    # ─── lifecycle ──────────────────────────────────────────────────────────
    async def connect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets[user_id].add(ws)

    async def disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets.get(user_id, set()).discard(ws)
            if not self._sockets.get(user_id):
                self._sockets.pop(user_id, None)

    # ─── presence ───────────────────────────────────────────────────────────
    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    def online_user_ids(self) -> list[int]:
        return list(self._sockets.keys())

    # ─── send ───────────────────────────────────────────────────────────────
    async def send_to_user(self, user_id: int, payload: dict[str, Any]) -> None:
        sockets = list(self._sockets.get(user_id, set()))
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)

    async def send_to_users(self, user_ids: list[int], payload: dict[str, Any]) -> None:
        for uid in user_ids:
            await self.send_to_user(uid, payload)


manager = ConnectionManager()
