"""Referral helpers (web link + bonus text), mirroring bot.py invitations."""

from __future__ import annotations

from app.db import Database


def record_referral(db: Database, referrer_id: int, new_user_id: int) -> bool:
    if referrer_id == new_user_id:
        return False
    if db.get_user(new_user_id):
        return False
    referrer = db.get_user(referrer_id)
    if not referrer:
        return False
    referrer.setdefault("referrals", [])
    if new_user_id in referrer["referrals"]:
        return False
    referrer["referrals"].append(new_user_id)
    db.update_user(referrer_id, referrer)
    return True


def bonuses_text(referral_count: int) -> str:
    if referral_count == 0:
        return "Пригласи 1 друга — твою анкету увидит больше людей 👀"
    if referral_count < 3:
        return (
            f"Ты пригласил {referral_count} друга(-ов). "
            f"Ещё {3 - referral_count} — и твоя анкета поднимется в топ! 🚀"
        )
    return f"Ты пригласил {referral_count} друзей. Твоя анкета в топе! 🔥"


def web_referral_link(frontend_origin: str, user_id: int) -> str:
    base = frontend_origin.rstrip("/")
    return f"{base}/?ref={user_id}"


def telegram_referral_link(bot_username: str | None, user_id: int) -> str | None:
    if not bot_username:
        return None
    return f"https://t.me/{bot_username}?start=ref{user_id}"
