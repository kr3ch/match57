"""Runtime configuration shared by bot.py and the FastAPI backend.

Values are kept identical to the original bot defaults so the database file,
admin list and support handle stay 1:1 with the production bot.
"""

from __future__ import annotations

import os


def _parse_admin_ids(raw: str | None) -> list[int]:
    if not raw:
        return [752355263]
    return [int(x.strip()) for x in raw.split(",") if x.strip()]


BOT_TOKEN: str | None = os.environ.get("BOT_TOKEN")
DB_FILE: str = os.environ.get("DB_FILE", "/data/users_db.json")
ADMIN_IDS: list[int] = _parse_admin_ids(os.environ.get("ADMIN_IDS"))
SUPPORT_USERNAME: str = os.environ.get("SUPPORT_USERNAME", "@sneakerdash_manager")

# Telegram chat used as a media "bucket" when the web frontend uploads new
# photos / videos -- the bot re-uploads them there so we can keep storing
# Telegram file_ids in the JSON database (identical schema to the bot).
STORAGE_CHAT_ID: int = int(os.environ.get("STORAGE_CHAT_ID") or (ADMIN_IDS[0] if ADMIN_IDS else 0))

# Same rate limit as bot.py (RATE_LIMIT_SECONDS = 0.7)
RATE_LIMIT_SECONDS: float = float(os.environ.get("RATE_LIMIT_SECONDS", "0.7"))

# Bot username used for referral links. Filled at runtime via bot.get_me() if
# left blank. Provided here so the frontend can be rendered without an extra
# round-trip when the env var is set.
BOT_USERNAME: str | None = os.environ.get("BOT_USERNAME")

# Web auth -- HMAC verification of Telegram Login Widget payloads requires the
# bot token; sessions are JWT-signed cookies.
SESSION_SECRET: str = os.environ.get("SESSION_SECRET", "dev-only-change-me-in-production")
SESSION_COOKIE_NAME: str = os.environ.get("SESSION_COOKIE_NAME", "match57_session")
SESSION_TTL_DAYS: int = int(os.environ.get("SESSION_TTL_DAYS", "30"))

# CORS / frontend origin for the web app (set in production).
FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
