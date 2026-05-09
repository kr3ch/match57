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
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", FRONTEND_ORIGIN)
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}
DEFAULT_SCHOOL = os.environ.get("DEFAULT_SCHOOL", "57")

# ─── App constants ──────────────────────────────────────────────────────────
GENDER_CHOICES = ("Парень", "Девушка")
LOOKING_FOR_CHOICES = ("Парни", "Девушки", "Все равно")
MIN_AGE = 14
MAX_AGE = 100
NAME_MAX = 32
DESCRIPTION_MAX = 500
USERNAME_MAX = 32
