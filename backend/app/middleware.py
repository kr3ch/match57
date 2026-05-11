"""Per-IP rate limit + ban-block middleware."""

from __future__ import annotations

import os
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import RATE_LIMIT_SECONDS

_last_seen: dict[str, float] = {}


def client_ip(request: Request) -> str:
    """Best-effort real client IP.

    Behind Render / Vercel / any reverse proxy ``request.client.host`` is the
    proxy edge IP, which means every user shares the same rate-limit bucket.
    We trust the first hop of ``X-Forwarded-For`` instead.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "anon"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method.upper()
        # Skip health/static + WS handshake.
        if path.startswith("/api/ws") or path == "/health" or not path.startswith("/api"):
            return await call_next(request)
        # Tests / CI: skip rate-limit entirely.
        if os.environ.get("DISABLE_RATE_LIMIT") == "1" or "PYTEST_CURRENT_TEST" in os.environ:
            return await call_next(request)
        # Only throttle mutating requests. A SPA mounts several SWR GETs in
        # parallel from one IP, and a per-IP 0.7s throttle would 429 them.
        # Anti-spam still kicks in on POST/PUT/PATCH/DELETE, which is what the
        # original bot.py limit was meant to cover.
        if method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)
        ip = client_ip(request)
        now = time.time()
        last = _last_seen.get(ip, 0.0)
        if now - last < RATE_LIMIT_SECONDS and not path.startswith("/api/auth"):
            return JSONResponse({"detail": "rate_limited"}, status_code=429)
        _last_seen[ip] = now
        return await call_next(request)
