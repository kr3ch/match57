"""Per-user rate limiting + ban gate, equivalent to ``check_banned_and_rate``.

The bot enforces 0.7s between messages from the same user; the web backend
applies the same limit to mutating API calls (anything but GET) so neither
interface is more permissive than the other.
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app import config as app_config
from app.auth import SESSION_COOKIE, read_session
from app.db import get_db


class BanAndRateLimitMiddleware(BaseHTTPMiddleware):
    """Blocks banned users entirely and throttles the rest at 0.7s/request.

    Read-only requests (``GET``, ``HEAD``, ``OPTIONS``) bypass the rate limit
    so the UI can poll incoming likes / refresh state freely.
    """

    def __init__(self, app):
        super().__init__(app)
        self._last_seen: dict[int, float] = {}

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable]):
        path = request.url.path
        # Always allow health, auth and media endpoints through (media is
        # read-only and may be hot-linked from <img> tags).
        if (
            path.startswith("/api/auth")
            or path.startswith("/api/media")
            or path == "/api/health"
            or path == "/health"
        ):
            return await call_next(request)

        token = request.cookies.get(SESSION_COOKIE)
        session = read_session(token) if token else None
        if session:
            user_id = int(session["user_id"])
            db = get_db()
            if db.is_banned(user_id):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "banned",
                        "message": (
                            "🚫 Твой аккаунт заблокирован. "
                            "Если считаешь это ошибкой — пиши @sneakerdash_manager"
                        ),
                    },
                )
            if request.method.upper() not in ("GET", "HEAD", "OPTIONS"):
                now = time.time()
                last = self._last_seen.get(user_id, 0.0)
                if now - last < app_config.RATE_LIMIT_SECONDS:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": "rate_limited",
                            "message": "🛑 Не спамь, подожди секунду.",
                        },
                    )
                self._last_seen[user_id] = now
        return await call_next(request)
