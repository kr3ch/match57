"""Auth endpoints: register / login / logout / me / verify-email.

Login is rate-limited to 10 attempts / 15 min / IP.
"""

from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import (
    SESSION_COOKIE,
    hash_password,
    issue_session,
    make_email_token,
    verify_password,
)
from app.config import (
    ADMIN_EMAILS,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    DEFAULT_SCHOOL,
    EMAIL_VERIFY_REQUIRED,
    GENDER_CHOICES,
    LOOKING_FOR_CHOICES,
    MAX_AGE,
    MIN_AGE,
    SESSION_TTL_DAYS,
)
from app.db.models import User
from app.deps import CurrentUserDep, SessionDep
from app.middleware import client_ip
from app.services.email import send_verify_email
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
    # SameSite=None + Secure=True is REQUIRED when frontend and backend live on
    # different sites (Vercel ↔ Render). Otherwise the browser silently drops
    # the Set-Cookie header and every subsequent request is 401.
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
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str | None = Field(default=None, max_length=32)
    name: str = Field(min_length=1, max_length=64)
    age: int = Field(ge=MIN_AGE, le=MAX_AGE)
    gender: str
    looking_for: str
    description: str | None = Field(default=None, max_length=500)
    school: str | None = None
    phone: str | None = None
    ref: int | None = None

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
    def _u(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        cleaned = v.strip().lstrip("@")
        if not cleaned:
            return None
        if not all(ch.isalnum() or ch == "_" for ch in cleaned):
            raise ValueError("username_invalid")
        return cleaned


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/register")
async def register(payload: RegisterIn, response: Response, db: SessionDep) -> dict:
    email = str(payload.email).lower().strip()
    existing_email = await db.scalar(select(User).where(User.email == email))
    if existing_email is not None:
        raise HTTPException(status_code=409, detail="user_exists")
    if payload.username:
        existing_uname = await db.scalar(select(User).where(User.username == payload.username))
        if existing_uname is not None:
            raise HTTPException(status_code=409, detail="username_taken")

    user = User(
        email=email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        age=payload.age,
        gender=payload.gender,
        looking_for=payload.looking_for,
        description=(payload.description or "").strip() or None,
        school=(payload.school or DEFAULT_SCHOOL).strip(),
        phone=(payload.phone or "").strip() or None,
        ref_user_id=payload.ref,
        is_admin=email in ADMIN_EMAILS,
        email_verified=False,
    )
    if EMAIL_VERIFY_REQUIRED:
        user.email_verify_token = make_email_token()
        user.email_verify_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
            days=2
        )
    else:
        user.email_verified = True

    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="user_exists") from None

    if EMAIL_VERIFY_REQUIRED and user.email_verify_token:
        await send_verify_email(user.email, user.email_verify_token)

    token = issue_session(user.id)
    _set_cookie(response, token)
    return {"ok": True, "user": await serialize_user(db, user, include_phone=True)}


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response, db: SessionDep) -> dict:
    _check_rate(client_ip(request))

    email = str(payload.email).lower().strip()
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if user.banned:
        raise HTTPException(status_code=403, detail="banned")

    user.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
    token = issue_session(user.id)
    _set_cookie(response, token)
    return {"ok": True, "user": await serialize_user(db, user, include_phone=True)}


@router.post("/logout")
async def logout(response: Response) -> dict:
    # Deletion cookie must carry the same SameSite/Secure attributes as the
    # original, otherwise some browsers refuse to overwrite it.
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


@router.post("/resend-verify")
async def resend_verify(user: CurrentUserDep, db: SessionDep) -> dict:
    if user.email_verified:
        return {"ok": True, "already": True}
    user.email_verify_token = make_email_token()
    user.email_verify_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        days=2
    )
    await db.flush()
    await send_verify_email(user.email, user.email_verify_token)
    return {"ok": True}


@router.post("/verify-email")
async def verify_email(
    token: Annotated[str, Query()],
    db: SessionDep,
) -> dict:
    user = await db.scalar(select(User).where(User.email_verify_token == token))
    if user is None:
        raise HTTPException(status_code=400, detail="bad_token")
    if user.email_verify_expires_at and user.email_verify_expires_at < datetime.now(
        timezone.utc
    ).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="token_expired")
    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_expires_at = None
    return {"ok": True}
