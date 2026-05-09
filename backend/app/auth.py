"""Telegram Login Widget verification + signed-cookie session.

Verification follows Telegram's documented HMAC algorithm:
  https://core.telegram.org/widgets/login#checking-authorization

Sessions are stateless JSON Web Tokens stored in an HTTP-only cookie. They
contain the same Telegram ``user_id`` the bot uses, so the existing JSON
database doesn't need any migration.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Any

from app.config import (
    BOT_TOKEN,
    SESSION_COOKIE_NAME,
    SESSION_SECRET,
    SESSION_TTL_DAYS,
)


def verify_telegram_login(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Validate a Telegram Login Widget payload.

    Returns a dict of clean fields when the hash matches and the auth_date is
    fresh; otherwise ``None``. ``BOT_TOKEN`` must be configured -- the secret
    used by Telegram is ``sha256(bot_token)``.
    """
    if not BOT_TOKEN:
        return None
    if "hash" not in payload:
        return None
    received_hash = payload["hash"]
    auth_date = int(payload.get("auth_date", 0))
    if auth_date == 0 or time.time() - auth_date > 86400:  # 24 hours
        return None

    fields = {k: v for k, v in payload.items() if k != "hash"}
    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    expected = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        return None

    return {
        "user_id": int(fields["id"]),
        "username": fields.get("username"),
        "first_name": fields.get("first_name"),
        "last_name": fields.get("last_name"),
        "photo_url": fields.get("photo_url"),
        "auth_date": auth_date,
    }


# ---------------------------------------------------------------------
# Tiny JWT-ish stateless session (HMAC-signed JSON, base64url payload).
# We avoid pulling a JWT library to keep the backend lean. The format is
# ``base64(json).base64(sig)`` and the secret is ``SESSION_SECRET``.
# ---------------------------------------------------------------------


def _b64e(b: bytes) -> str:
    return urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return urlsafe_b64decode(s + pad)


def issue_session(user_id: int, username: str | None = None) -> str:
    payload = {
        "user_id": int(user_id),
        "username": username,
        "iat": int(time.time()),
        "exp": int(time.time()) + SESSION_TTL_DAYS * 86400,
    }
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64e(sig)}"


def read_session(token: str) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    body, sig = token.split(".", 1)
    expected = hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    try:
        if not hmac.compare_digest(expected, _b64d(sig)):
            return None
        payload = json.loads(_b64d(body))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


SESSION_COOKIE = SESSION_COOKIE_NAME
