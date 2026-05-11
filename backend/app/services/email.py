"""Email sending. In dev mode (no SMTP env vars) just log the link."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import (
    PUBLIC_BASE_URL,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USER,
)

log = logging.getLogger("email")


def verify_link(token: str) -> str:
    return f"{PUBLIC_BASE_URL.rstrip('/')}/verify-email?token={token}"


def _send_via_smtp(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if SMTP_USE_TLS and SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as s:
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            if SMTP_USE_TLS:
                s.starttls()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)


async def send_verify_email(to: str, token: str) -> None:
    link = verify_link(token)
    body = (
        f"Привет!\n\n"
        f"Твой код подтверждения для MATCH 57:\n\n"
        f"    {token}\n\n"
        f"Введи его на экране подтверждения или просто открой ссылку:\n"
        f"{link}\n\n"
        f"Код действует 15 минут.\n"
        f"Если ты не регистрировался — просто проигнорируй это письмо.\n"
    )
    if not SMTP_HOST:
        log.warning("EMAIL VERIFY (dev) → %s : code=%s", to, token)
        print(f"[email] verify code for {to}: {token}  (link: {link})", flush=True)
        return
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, _send_via_smtp, to, f"MATCH 57 — код подтверждения {token}", body
        )
        log.info("verify email sent to %s", to)
    except Exception as exc:
        log.exception("smtp_failed: %s", exc)
        # Always log code/link as a fallback so users aren't locked out.
        print(f"[email] FALLBACK verify code for {to}: {token}", flush=True)


__all__ = ["send_verify_email", "verify_link"]
