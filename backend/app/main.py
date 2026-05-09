"""FastAPI application factory.

Mounts every router under ``/api/...`` and applies the ban + rate-limit
middleware so the web frontend has the same throttling and ban semantics as
the Telegram bot.
"""

from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.config import FRONTEND_ORIGIN  # noqa: E402
from app.middleware import BanAndRateLimitMiddleware  # noqa: E402
from app.routers import (  # noqa: E402
    admin,
    auth,
    browse,
    likes,
    media,
    messages,
    profile,
    referrals,
    registration,
    skipped,
)


def create_app() -> FastAPI:
    app = FastAPI(title="MATCH 57 — Web API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(BanAndRateLimitMiddleware)

    app.include_router(auth.router)
    app.include_router(registration.router)
    app.include_router(profile.router)
    app.include_router(browse.router)
    app.include_router(messages.router)
    app.include_router(skipped.router)
    app.include_router(likes.router)
    app.include_router(referrals.router)
    app.include_router(media.router)
    app.include_router(admin.router)

    @app.get("/api/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
