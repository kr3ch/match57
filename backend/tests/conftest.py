"""Test fixtures: isolated JSON DB per test, FastAPI client with a mocked
session cookie so we don't hit Telegram during tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure backend/ is on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture()
def db_file(tmp_path, monkeypatch):
    path = tmp_path / "users_db.json"
    path.write_text(
        json.dumps({"users": {}, "profiles": [], "banned": [], "reports": []}),
        encoding="utf-8",
    )
    monkeypatch.setenv("DB_FILE", str(path))
    monkeypatch.setenv("BOT_TOKEN", "")  # disable outbound Telegram calls
    monkeypatch.setenv("STORAGE_CHAT_ID", "0")
    monkeypatch.setenv("ADMIN_IDS", "1")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:3000")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    # Reset module-level singletons so each test gets a fresh Database
    import app.config as config
    import app.db as db_mod

    config.BOT_TOKEN = ""
    config.DB_FILE = str(path)
    config.ADMIN_IDS = [1]
    config.STORAGE_CHAT_ID = 0
    config.SESSION_SECRET = "test-secret"
    config.FRONTEND_ORIGIN = "http://localhost:3000"
    config.RATE_LIMIT_SECONDS = 0.0  # disable throttle inside tests
    db_mod._db_singleton = None
    yield path
    db_mod._db_singleton = None


@pytest.fixture()
def app(db_file):
    from app.main import create_app

    return create_app()


@pytest.fixture()
def client(app):
    from fastapi.testclient import TestClient

    return TestClient(app)


def authed_client(client, user_id: int, username: str | None = "tester"):
    from app.auth import SESSION_COOKIE, issue_session

    client.cookies.set(SESSION_COOKIE, issue_session(user_id, username))
    return client
