"""Per-user rate limit + ban-block + no-shared-cache middleware."""

from __future__ import annotations

import os
import re
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.auth import SESSION_COOKIE, verify_session
from app.config import RATE_LIMIT_SECONDS

# Last hit per-bucket (user_id when authenticated, IP otherwise).
_last_seen: dict[str, float] = {}

# Idempotent / high-frequency endpoints that must never trip rate-limit.
# The chat reads /read on every visible-message update, /react toggles fire
# fast from the emoji picker, and presence pings from WS handshakes touch
# /api/auth/me. None of these are spam vectors that the 0.7s gate is meant
# to cover — that gate exists to slow down bulk POST writes (sending many
# messages, mass-liking, etc).
_RATE_LIMIT_EXEMPT_RE = re.compile(
    r"^/api/(?:"
    r"conversations/\d+/read"
    r"|messages/\d+/react"
    r"|auth/(?:me|logout)"
    r")$"
)


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


def _rate_bucket(request: Request) -> str:
    """Per-user bucket when we can identify the session, else per-IP.

    Authenticated users behind a shared NAT (school wifi, mobile carrier)
    used to share a single per-IP bucket and 429 each other on the very
    first write. Reading the session cookie here is cheap (just an HMAC
    check, no DB hit) and makes the limit actually per-user.
    """
    token = request.cookies.get(SESSION_COOKIE)
    payload = verify_session(token) if token else None
    if payload and "user_id" in payload:
        return f"u:{payload['user_id']}"
    return f"ip:{client_ip(request)}"


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
        # Skip auth endpoints (login/register can be slow) + idempotent
        # high-frequency endpoints (mark-read, toggle reaction, logout).
        if path.startswith("/api/auth") or _RATE_LIMIT_EXEMPT_RE.match(path):
            return await call_next(request)
        bucket = _rate_bucket(request)
        now = time.time()
        last = _last_seen.get(bucket, 0.0)
        gap = now - last
        if gap < RATE_LIMIT_SECONDS:
            # Hint the client how long until the bucket clears so its
            # retry-with-backoff can wait exactly the right amount.
            wait = max(RATE_LIMIT_SECONDS - gap, 0.05)
            return JSONResponse(
                {"detail": "rate_limited"},
                status_code=429,
                headers={"Retry-After": f"{wait:.2f}"},
            )
        _last_seen[bucket] = now
        return await call_next(request)


class NoSharedCacheMiddleware(BaseHTTPMiddleware):
    """Force-set ``Cache-Control: private, no-store`` on every API response.

    Why this exists
    ---------------
    Vercel's edge auto-injects ``Cache-Control: public, max-age=0,
    must-revalidate`` on any rewritten response that doesn't already set
    its own ``Cache-Control``. With ``public`` and a ``Vary`` header that
    doesn't list ``Cookie``, intermediate caches are allowed to store the
    response keyed only by URL — which has caused real user-visible
    cross-account leaks where one user refreshed and saw another user's
    profile from ``/api/auth/me``. By stamping ``private, no-store``
    ourselves, no shared cache will ever store these responses, and we
    also opt out of Vercel's default header injection.

    We exempt ``/api/media/*`` so chat media (per-conversation
    images/audio/video served via FileResponse) keeps the
    FileResponse-default caching behavior; auth on those is enforced by
    the route handler itself.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/api/") and not path.startswith("/api/media/"):
            response.headers["Cache-Control"] = "private, no-store"
            existing_vary = response.headers.get("Vary", "")
            vary_parts = [p.strip() for p in existing_vary.split(",") if p.strip()]
            if not any(p.lower() == "cookie" for p in vary_parts):
                vary_parts.append("Cookie")
            response.headers["Vary"] = ", ".join(vary_parts)
        return response
