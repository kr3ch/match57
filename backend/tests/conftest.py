"""Shared fixtures: in-memory SQLite + test client + auth helpers."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.deps import db_session

# ─── In-memory async engine shared across a whole module ────────────────────
_engine = create_async_engine("sqlite+aiosqlite://", echo=False, future=True)
_Session = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_db() -> AsyncIterator[AsyncSession]:
    async with _Session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture
async def app():
    from app.main import app as _app

    _app.dependency_overrides[db_session] = _override_db
    yield _app
    _app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    async with _Session() as session:
        yield session
        await session.commit()


# ─── Helper: register + return cookie ──────────────────────────────────────
async def register_user(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "Test1234!",
    name: str = "Test",
    age: int = 17,
    gender: str = "Парень",
    looking_for: str = "Все равно",
    username: str | None = None,
) -> dict:
    if username is None:
        username = email.split("@")[0]
    resp = await client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": password,
            "name": name,
            "age": age,
            "gender": gender,
            "looking_for": looking_for,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()
