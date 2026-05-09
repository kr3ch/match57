"""Password + JWT-cookie session helpers (no Telegram).

The JWT format we use is intentionally minimal — the same compact
``base64(payload).hexdigest`` shape as v1, so the cookie code remained
backwards-friendly. Payload only carries ``user_id``, ``iat``, ``exp``.

Passwords are hashed with bcrypt (12 rounds by default).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

import bcrypt

from app.config import (
    BCRYPT_ROUNDS,
    SESSION_COOKIE_NAME,
    SESSION_SECRET,
    SESSION_TTL_DAYS,
)

SESSION_COOKIE = SESSION_COOKIE_NAME


# ─── Passwords ──────────────────────────────────────────────────────────────


def hash_password(plaintext: str) -> str:
    if not plaintext or len(plaintext) < 6:
        raise ValueError("password_too_short")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(plaintext.encode("utf-8"), salt).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    if not plaintext or not hashed:
        return False
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ─── JWT-ish session tokens ─────────────────────────────────────────────────


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def issue_session(user_id: int) -> str:
    """Sign a session token for the given user."""
    now = int(time.time())
    payload = {
        "user_id": int(user_id),
        "iat": now,
        "exp": now + SESSION_TTL_DAYS * 86400,
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = _b64encode(raw)
    sig = hmac.new(SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64encode(sig)}"


def verify_session(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    try:
        expected = hmac.new(
            SESSION_SECRET.encode("utf-8"),
            body.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_b64decode(sig), expected):
            return None
        payload = json.loads(_b64decode(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


# ─── Email-verification tokens ──────────────────────────────────────────────


def make_email_token() -> str:
    """Random URL-safe verification token."""
    return secrets.token_urlsafe(32)


__all__ = [
    "SESSION_COOKIE",
    "hash_password",
    "issue_session",
    "make_email_token",
    "verify_password",
    "verify_session",
]
