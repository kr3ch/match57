"""Auth endpoints: register / login / logout / me.

Login is rate-limited to 10 attempts / 15 min / IP.
"""

from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import (
    SESSION_COOKIE,
    hash_password,
    issue_session,
    validate_password,
    verify_password,
)
from app.config import (
    ADMIN_EMAILS,
    ADMIN_USERNAMES,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    DEFAULT_SCHOOL,
    GENDER_CHOICES,
    LOOKING_FOR_CHOICES,
    MAX_AGE,
    MIN_AGE,
    SESSION_TTL_DAYS,
)
from app.db.models import User
from app.deps import CurrentUserDep, SessionDep
from app.middleware import client_ip
from app.services.profiles import serialize_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── Rate limiting ──────────────────────────────────────────────────────────
_LOGIN_WINDOW_SEC = 15 * 60
_LOGIN_MAX_ATTEMPTS = 10
_login_buckets: dict[str, deque[float]] = {}


def _check_rate(ip: str) -> None:
    now = time.time()
    bucket = _login_buckets.setdefault(ip, deque(maxlen=_LOGIN_MAX_ATTEMPTS))
    while bucket and bucket[0] < now - _LOGIN_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="too_many_login_attempts")
    bucket.append(now)


def _set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 86400,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        path="/",
    )


# ─── Schemas ────────────────────────────────────────────────────────────────


class RegisterIn(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    age: int = Field(ge=MIN_AGE, le=MAX_AGE)
    gender: str
    looking_for: str
    description: str | None = Field(default=None, max_length=500)
    school: str | None = None
    phone: str | None = None

    @field_validator("gender")
    @classmethod
    def _g(cls, v: str) -> str:
        if v not in GENDER_CHOICES:
            raise ValueError("gender_invalid")
        return v

    @field_validator("looking_for")
    @classmethod
    def _lf(cls, v: str) -> str:
        if v not in LOOKING_FOR_CHOICES:
            raise ValueError("looking_for_invalid")
        return v

    @field_validator("username")
    @classmethod
    def _u(cls, v: str) -> str:
        cleaned = v.strip().lstrip("@")
        if not cleaned:
            raise ValueError("username_required")
        if not all(ch.isalnum() or ch == "_" for ch in cleaned):
            raise ValueError("username_invalid")
        return cleaned


class LoginIn(BaseModel):
    username: str
    password: str


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/register")
async def register(payload: RegisterIn, response: Response, db: SessionDep) -> dict:
    existing_uname = await db.scalar(select(User).where(User.username == payload.username))
    if existing_uname is not None:
        raise HTTPException(status_code=409, detail="username_taken")

    pwd_err = validate_password(payload.password)
    if pwd_err:
        raise HTTPException(status_code=422, detail=pwd_err)

    placeholder_email = f"{payload.username}@match57.local"
    user = User(
        email=placeholder_email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        age=payload.age,
        gender=payload.gender,
        looking_for=payload.looking_for,
        description=(payload.description or "").strip() or None,
        school=(payload.school or DEFAULT_SCHOOL).strip(),
        phone=(payload.phone or "").strip() or None,
        is_admin=(placeholder_email in ADMIN_EMAILS or payload.username.lower() in ADMIN_USERNAMES),
        email_verified=True,
    )

    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="username_taken") from None

    token = issue_session(user.id)
    _set_cookie(response, token)
    return {
        "ok": True,
        "user": await serialize_user(db, user, include_phone=True),
        "token": token,
    }


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response, db: SessionDep) -> dict:
    _check_rate(client_ip(request))

    login = payload.username.strip().lstrip("@")
    user = await db.scalar(select(User).where(User.username == login))
    if user is None:
        user = await db.scalar(select(User).where(User.email == login))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if user.banned:
        raise HTTPException(status_code=403, detail="banned")
    if user.deleted:
        raise HTTPException(status_code=403, detail="deleted")

    user.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
    # Promote an existing account if the configured admin lists changed since
    # registration (e.g. ADMIN_USERNAMES env added later). Otherwise the user
    # would have to re-register to gain admin.
    if not user.is_admin and (
        (user.email and user.email.lower() in ADMIN_EMAILS)
        or (user.username and user.username.lower() in ADMIN_USERNAMES)
    ):
        user.is_admin = True
    token = issue_session(user.id)
    _set_cookie(response, token)
    return {
        "ok": True,
        "user": await serialize_user(db, user, include_phone=True),
        "token": token,
    }


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return {"ok": True}


@router.get("/me")
async def me(user: CurrentUserDep, db: SessionDep) -> dict:
    return {"user": await serialize_user(db, user, include_phone=True)}
