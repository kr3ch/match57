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
        "Привет!\n\n"
        "Подтверди email для MATCH 57: " + link + "\n\n"
        "Если ты не регистрировался — просто проигнорируй это письмо.\n"
    )
    if not SMTP_HOST:
        log.warning("EMAIL VERIFY (dev) → %s : %s", to, link)
        print(f"[email] verify link for {to}: {link}", flush=True)
        return
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, _send_via_smtp, to, "MATCH 57 — подтверждение почты", body
        )
        log.info("verify email sent to %s", to)
    except Exception as exc:
        log.exception("smtp_failed: %s", exc)
        # Always log link as a fallback so users aren't locked out.
        print(f"[email] FALLBACK verify link for {to}: {link}", flush=True)


__all__ = ["send_verify_email", "verify_link"]
