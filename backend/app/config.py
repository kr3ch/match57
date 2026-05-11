"""Process-wide configuration for the MATCH 57 web app.

All knobs come from environment variables (see ``backend/.env.example``). No
secrets are baked into the source.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, cast

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
ALLOWED_VIDEO_MIMES = {"video/webm", "video/mp4"}
ALLOWED_AUDIO_MIMES = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3"}
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
RATE_LIMIT_SECONDS = float(os.environ.get("RATE_LIMIT_SECONDS", "0.7"))

# ─── App-wide ───────────────────────────────────────────────────────────────
# Render sets RENDER=true on every managed service. Use that to pick a
# production-friendly default for FRONTEND_ORIGIN so the app works on Render
# even if the operator forgot to set the env var explicitly.
_ON_RENDER = os.environ.get("RENDER", "").lower() in ("true", "1", "yes")
_DEFAULT_FRONTEND_ORIGIN = "https://match57.vercel.app" if _ON_RENDER else "http://localhost:3000"
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", _DEFAULT_FRONTEND_ORIGIN)
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", FRONTEND_ORIGIN)
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}
DEFAULT_SCHOOL = os.environ.get("DEFAULT_SCHOOL", "57")

# ─── CORS / cookies ─────────────────────────────────────────────────────────
# Comma-separated list of origins allowed by CORS. The default covers the
# canonical Vercel deployment + localhost dev so the app works out of the box
# even if the operator forgets to set CORS_ORIGINS on Render. Set the env var
# to override (e.g. to add a staging origin).
_DEFAULT_PROD_ORIGIN = "https://match57.vercel.app"
_DEFAULT_DEV_ORIGIN = "http://localhost:3000"
_CORS_ENV = os.environ.get("CORS_ORIGINS", "").strip()
if _CORS_ENV:
    CORS_ORIGINS: list[str] = [o.strip() for o in _CORS_ENV.split(",") if o.strip()]
else:
    # Always include FRONTEND_ORIGIN + the canonical prod/dev origins so the
    # standard "Vercel ↔ Render" topology works without extra config.
    CORS_ORIGINS = list(dict.fromkeys([FRONTEND_ORIGIN, _DEFAULT_PROD_ORIGIN, _DEFAULT_DEV_ORIGIN]))
# Optional regex to match dynamic origins. Defaults to matching this project's
# Vercel preview URLs (e.g. https://match57-git-feature-team.vercel.app or
# https://match57-abc123-team.vercel.app). Set CORS_ORIGIN_REGEX to override
# (use "-" to disable previews entirely).
_CORS_REGEX_ENV = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
if _CORS_REGEX_ENV == "-":
    CORS_ORIGIN_REGEX = ""
elif _CORS_REGEX_ENV:
    CORS_ORIGIN_REGEX = _CORS_REGEX_ENV
else:
    CORS_ORIGIN_REGEX = r"^https://match57(-[a-z0-9-]+)?\.vercel\.app$"

# Cookie security. Cross-site auth cookies (frontend on Vercel + backend on
# Render) require SameSite=None + Secure=True, otherwise the browser silently
# drops the Set-Cookie header. We derive sane defaults from the frontend scheme
# and let the deployment override via env vars when needed.
_cross_site_default = FRONTEND_ORIGIN.startswith("https://") and "localhost" not in FRONTEND_ORIGIN
_RAW_SAMESITE = os.environ.get(
    "COOKIE_SAMESITE",
    "none" if _cross_site_default else "lax",
).lower()
# Starlette / FastAPI only accept these three literals; coerce anything else
# to the safe cross-site default so a typo doesn't crash request handling.
COOKIE_SAMESITE: Literal["lax", "strict", "none"] = (
    cast(Literal["lax", "strict", "none"], _RAW_SAMESITE)
    if _RAW_SAMESITE in ("lax", "strict", "none")
    else ("none" if _cross_site_default else "lax")
)
COOKIE_SECURE = (
    os.environ.get(
        "COOKIE_SECURE",
        "1" if _cross_site_default else "0",
    )
    == "1"
)

# ─── App constants ──────────────────────────────────────────────────────────
GENDER_CHOICES = ("Парень", "Девушка")
LOOKING_FOR_CHOICES = ("Парни", "Девушки", "Все равно")
MIN_AGE = 14
MAX_AGE = 100
NAME_MAX = 32
DESCRIPTION_MAX = 500
USERNAME_MAX = 32
