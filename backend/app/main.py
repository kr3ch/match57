"""FastAPI application entrypoint for MATCH 57 v2."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env BEFORE we import config so env vars are visible.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.config import CORS_ORIGIN_REGEX, CORS_ORIGINS  # noqa: E402
from app.db import engine  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.middleware import RateLimitMiddleware  # noqa: E402
from app.realtime.ws import router as ws_router  # noqa: E402
from app.routers.admin import router as admin_router  # noqa: E402
from app.routers.auth import router as auth_router  # noqa: E402
from app.routers.browse import router as browse_router  # noqa: E402
from app.routers.conversations import router as conversations_router  # noqa: E402
from app.routers.likes import router as likes_router  # noqa: E402
from app.routers.media import router as media_router  # noqa: E402
from app.routers.messages import router as messages_router  # noqa: E402
from app.routers.profile import router as profile_router  # noqa: E402
from app.routers.referrals import router as referrals_router  # noqa: E402
from app.routers.reports import router as reports_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create schema on first startup if not yet migrated. In production
    # use Alembic instead — this is a safety net so the dev server "just works".
    async with engine.begin() as conn:
        # Import models so metadata is populated.
        from app.db import models  # noqa: F401

        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="MATCH 57", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(browse_router)
app.include_router(likes_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(media_router)
app.include_router(reports_router)
app.include_router(referrals_router)
app.include_router(admin_router)
app.include_router(ws_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}
