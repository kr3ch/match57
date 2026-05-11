"""Process-wide configuration for the MATCH 57 web app.

All knobs come from environment variables (see ``backend/.env.example``). No
secrets are baked into the source.
"""

from __future__ import annotations

import os
from pathlib import Path

# ─── Paths ──────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", REPO_ROOT / "data"))
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", DATA_DIR / "uploads"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── Database ───────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DATA_DIR / 'match57.db'}",
)
DATABASE_URL_SYNC = DATABASE_URL.replace("sqlite+aiosqlite", "sqlite").replace(
    "postgresql+asyncpg", "postgresql"
)

# ─── Auth / sessions ────────────────────────────────────────────────────────
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-me")
SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "30"))
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "match57_session")
BCRYPT_ROUNDS = int(os.environ.get("BCRYPT_ROUNDS", "12"))

# ─── Email verification ─────────────────────────────────────────────────────
# In dev mode (no SMTP env vars) we just log the verification link to stdout,
# which is enough to test the flow locally without configuring an SMTP server.
EMAIL_VERIFY_REQUIRED = os.environ.get("EMAIL_VERIFY_REQUIRED", "1") == "1"
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "MATCH 57 <noreply@match57.local>")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "1") == "1"

# ─── Upload limits / MIME whitelist ─────────────────────────────────────────
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "25"))
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_MIMES = {
    "video/webm",
    "video/mp4",
    # iPhone (QuickTime) uses .mov and reports either of these MIME types.
    # Treat them all as video so the chat upload doesn't 415 the user.
    "video/quicktime",
    "video/x-quicktime",
    # Android devices and some encoders use these MP4 aliases.
    "video/x-m4v",
    "video/3gpp",
}
ALLOWED_AUDIO_MIMES = {
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp3",
    # iPhone voice memos / shared audio.
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
}
ALLOWED_FILE_MIMES = {
    "application/pdf",
    "text/plain",
    "application/zip",
}
ALLOWED_MEDIA_MIMES = (
    ALLOWED_IMAGE_MIMES | ALLOWED_VIDEO_MIMES | ALLOWED_AUDIO_MIMES | ALLOWED_FILE_MIMES
)
PROFILE_PHOTO_MAX = 3

# ─── Rate limit ─────────────────────────────────────────────────────────────
# Minimum gap between consecutive *write* POSTs from one user.
# 0.7s was too coarse for the chat: a single user-action like
# "upload video → send message" fires two sequential POSTs from one
# logical click, and that pair must not 429. We use a generous lower
# bound here (~4 ops/sec) which still defangs the bot.py-era spam loops
# the middleware was originally meant to cover. Override via the
# RATE_LIMIT_SECONDS env var if you want to tighten it back up.
RATE_LIMIT_SECONDS = float(os.environ.get("RATE_LIMIT_SECONDS", "0.25"))

# ─── App-wide ───────────────────────────────────────────────────────────────
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", FRONTEND_ORIGIN)
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}
DEFAULT_SCHOOL = os.environ.get("DEFAULT_SCHOOL", "57")

# ─── CORS / cookies ─────────────────────────────────────────────────────────
# Comma-separated list of origins allowed by CORS. Defaults to FRONTEND_ORIGIN
# so a single env var unlocks the standard prod setup. Set CORS_ORIGINS when
# you need to allow multiple origins (e.g. prod + staging + localhost).
_CORS_ENV = os.environ.get("CORS_ORIGINS", "").strip()
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _CORS_ENV.split(",") if o.strip()]
    if _CORS_ENV
    else [FRONTEND_ORIGIN]
)
# Optional regex to match dynamic origins (e.g. Vercel preview URLs like
# https://match57-git-feature-team.vercel.app). Leave empty to disable.
CORS_ORIGIN_REGEX = os.environ.get("CORS_ORIGIN_REGEX", "").strip()

# Cookie security. Cross-site auth cookies (frontend on Vercel + backend on
# Render) require SameSite=None + Secure=True, otherwise the browser silently
# drops the Set-Cookie header. We derive sane defaults from the frontend scheme
# and let the deployment override via env vars when needed.
_cross_site_default = FRONTEND_ORIGIN.startswith("https://") and "localhost" not in FRONTEND_ORIGIN
COOKIE_SAMESITE = os.environ.get(
    "COOKIE_SAMESITE",
    "none" if _cross_site_default else "lax",
).lower()
COOKIE_SECURE = os.environ.get(
    "COOKIE_SECURE",
    "1" if _cross_site_default else "0",
) == "1"

# ─── App constants ──────────────────────────────────────────────────────────
GENDER_CHOICES = ("Парень", "Девушка")
LOOKING_FOR_CHOICES = ("Парни", "Девушки", "Все равно")
MIN_AGE = 14
MAX_AGE = 100
NAME_MAX = 32
DESCRIPTION_MAX = 500
USERNAME_MAX = 32
