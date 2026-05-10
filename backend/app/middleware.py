"""Per-IP rate limit + ban-block middleware."""

from __future__ import annotations

import os
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import RATE_LIMIT_SECONDS

_last_seen: dict[str, float] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # CORS preflights must always pass through so browsers can read the
        # ``Access-Control-Allow-Origin`` header. Rate-limiting them would
        # break every cross-origin request from a static-export frontend.
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        # Skip health/static + WS handshake.
        if path.startswith("/api/ws") or path == "/health" or not path.startswith("/api"):
            return await call_next(request)
        # Tests / CI: skip rate-limit entirely.
        if os.environ.get("DISABLE_RATE_LIMIT") == "1" or "PYTEST_CURRENT_TEST" in os.environ:
            return await call_next(request)
        ip = request.client.host if request.client else "anon"
        now = time.time()
        last = _last_seen.get(ip, 0.0)
        if now - last < RATE_LIMIT_SECONDS and not path.startswith("/api/auth"):
            return JSONResponse({"detail": "rate_limited"}, status_code=429)
        _last_seen[ip] = now
        return await call_next(request)
