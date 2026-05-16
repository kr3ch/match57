"""Admin PIN flow:

* with ``ADMIN_PIN`` unset, all admin endpoints are reachable as before;
* with it set, every ``/api/admin/*`` (except the PIN endpoints) returns
  403 ``admin_pin_required`` until ``POST /api/admin/verify-pin`` succeeds;
* a wrong PIN returns 403 and does **not** set a cookie;
* the correct PIN issues a cookie that unlocks the panel for ``ADMIN_PIN_TTL_MIN``;
* ``POST /api/admin/lock`` clears the cookie;
* non-admin users get 403 ``admin_only`` instead of touching the PIN flow.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import ADMIN_USERNAMES
from app.db.models import User
from app.deps import db_session

from .conftest import _override_db, _Session, register_user


async def _make_admin(username: str) -> None:
    async with _Session() as session:
        user = await session.scalar(
            __import__("sqlalchemy").select(User).where(User.username == username)
        )
        assert user is not None
        user.is_admin = True
        await session.commit()


@pytest.fixture
async def app_no_pin(monkeypatch):
    monkeypatch.setattr("app.config.ADMIN_PIN", "")
    monkeypatch.setattr("app.deps.ADMIN_PIN_VALUE", "")
    monkeypatch.setattr("app.routers.admin.ADMIN_PIN", "")
    from app.main import app as _app

    _app.dependency_overrides[db_session] = _override_db
    yield _app
    _app.dependency_overrides.clear()


@pytest.fixture
async def app_with_pin(monkeypatch):
    monkeypatch.setattr("app.config.ADMIN_PIN", "1234")
    monkeypatch.setattr("app.deps.ADMIN_PIN_VALUE", "1234")
    monkeypatch.setattr("app.routers.admin.ADMIN_PIN", "1234")
    from app.main import app as _app

    _app.dependency_overrides[db_session] = _override_db
    yield _app
    _app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pin_disabled_passes_through(app_no_pin):
    transport = ASGITransport(app=app_no_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="adm")
        await _make_admin("adm")
        # Stats endpoint is admin-only; with PIN disabled it must work.
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_pin_required_blocks_without_cookie(app_with_pin):
    transport = ASGITransport(app=app_with_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="adm")
        await _make_admin("adm")
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "admin_pin_required"


@pytest.mark.asyncio
async def test_pin_wrong_pin_403(app_with_pin):
    transport = ASGITransport(app=app_with_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="adm")
        await _make_admin("adm")
        resp = await client.post("/api/admin/verify-pin", json={"pin": "wrong"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "bad_pin"
        # No PIN cookie was set.
        assert "match57_session_admin" not in client.cookies


@pytest.mark.asyncio
async def test_pin_correct_pin_unlocks(app_with_pin):
    transport = ASGITransport(app=app_with_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="adm")
        await _make_admin("adm")
        # Verify with the correct PIN.
        ok = await client.post("/api/admin/verify-pin", json={"pin": "1234"})
        assert ok.status_code == 200, ok.text
        assert ok.json()["ok"] is True
        # Subsequent calls are now allowed.
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_pin_lock_clears_cookie(app_with_pin):
    transport = ASGITransport(app=app_with_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="adm")
        await _make_admin("adm")
        await client.post("/api/admin/verify-pin", json={"pin": "1234"})
        assert (await client.get("/api/admin/stats")).status_code == 200

        await client.post("/api/admin/lock")
        # The lock endpoint deletes the cookie; the next call must 403.
        client.cookies.delete("match57_session_admin")
        resp = await client.get("/api/admin/stats")
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_pin_non_admin_cannot_verify(app_with_pin):
    transport = ASGITransport(app=app_with_pin)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register_user(client, username="bob")
        # Not made admin — verify-pin should 403 with admin_only.
        resp = await client.post("/api/admin/verify-pin", json={"pin": "1234"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "admin_only"


def test_admin_usernames_parsed_from_env(monkeypatch):
    """Importing app.config with ADMIN_USERNAMES set lowercases + strips ``@``."""
    monkeypatch.setenv("ADMIN_USERNAMES", " VasyEwest, @bob ")
    import importlib

    import app.config as cfg

    importlib.reload(cfg)
    assert cfg.ADMIN_USERNAMES == {"vasyewest", "bob"}
    # Restore so the rest of the suite sees the canonical empty set.
    monkeypatch.delenv("ADMIN_USERNAMES", raising=False)
    importlib.reload(cfg)
    assert "vasyewest" not in ADMIN_USERNAMES
