"""Lazy ``aiogram.Bot`` singleton used by the web backend for outbound
notifications (match alerts, admin DMs, broadcasts) and as a media bridge
(``getFile`` to proxy photos/videos to the browser, ``send_photo``/``send_video``
to obtain ``file_id``s when the web user uploads new media).

If ``BOT_TOKEN`` is not configured in the environment, calls degrade
gracefully -- the JSON database keeps being mutated, but no Telegram messages
are sent. This lets local development work without a token.
"""

from __future__ import annotations

import asyncio
import logging

from app.config import BOT_TOKEN

logger = logging.getLogger(__name__)

_bot: object | None = None  # aiogram.Bot at runtime
_bot_username: str | None = None


def get_bot():
    """Return a process-wide aiogram Bot, or ``None`` if no token is set."""
    global _bot
    if _bot is not None:
        return _bot
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN is not set -- outbound notifications disabled.")
        return None
    try:
        from aiogram import Bot  # type: ignore
    except Exception as exc:  # pragma: no cover - aiogram is a hard dep in prod
        logger.warning("aiogram not available: %s", exc)
        return None
    _bot = Bot(token=BOT_TOKEN)
    return _bot


async def get_bot_username() -> str | None:
    global _bot_username
    if _bot_username:
        return _bot_username
    from app.config import BOT_USERNAME

    if BOT_USERNAME:
        _bot_username = BOT_USERNAME
        return _bot_username
    bot = get_bot()
    if bot is None:
        return None
    try:
        me = await bot.get_me()
        _bot_username = me.username
        return _bot_username
    except Exception as exc:  # network / auth errors during dev
        logger.warning("get_me() failed: %s", exc)
        return None


async def safe_send_message(chat_id: int, text: str, **kwargs) -> bool:
    bot = get_bot()
    if bot is None:
        return False
    try:
        await bot.send_message(chat_id, text, **kwargs)
        return True
    except Exception as exc:
        logger.info("send_message to %s failed: %s", chat_id, exc)
        return False


async def safe_send_photo(chat_id: int, photo, **kwargs) -> bool:
    bot = get_bot()
    if bot is None:
        return False
    try:
        await bot.send_photo(chat_id, photo, **kwargs)
        return True
    except Exception as exc:
        logger.info("send_photo to %s failed: %s", chat_id, exc)
        return False


async def safe_send_video(chat_id: int, video, **kwargs) -> bool:
    bot = get_bot()
    if bot is None:
        return False
    try:
        await bot.send_video(chat_id, video, **kwargs)
        return True
    except Exception as exc:
        logger.info("send_video to %s failed: %s", chat_id, exc)
        return False


async def safe_send_voice(chat_id: int, voice) -> bool:
    bot = get_bot()
    if bot is None:
        return False
    try:
        await bot.send_voice(chat_id, voice)
        return True
    except Exception as exc:
        logger.info("send_voice to %s failed: %s", chat_id, exc)
        return False


async def safe_send_video_note(chat_id: int, video_note) -> bool:
    bot = get_bot()
    if bot is None:
        return False
    try:
        await bot.send_video_note(chat_id, video_note)
        return True
    except Exception as exc:
        logger.info("send_video_note to %s failed: %s", chat_id, exc)
        return False


async def upload_photo_for_storage(content: bytes, chat_id: int) -> str | None:
    """Re-upload a web-uploaded photo to a Telegram chat to obtain a ``file_id``.

    Returns the largest photo's ``file_id`` so the schema in users_db.json
    matches what the bot stores when receiving a Telegram photo.
    """
    bot = get_bot()
    if bot is None:
        return None
    try:
        from aiogram.types import BufferedInputFile  # type: ignore

        msg = await bot.send_photo(chat_id, BufferedInputFile(content, filename="upload.jpg"))
        if msg.photo:
            return msg.photo[-1].file_id
    except Exception as exc:
        logger.warning("upload_photo_for_storage failed: %s", exc)
    return None


async def upload_video_for_storage(content: bytes, chat_id: int) -> str | None:
    bot = get_bot()
    if bot is None:
        return None
    try:
        from aiogram.types import BufferedInputFile  # type: ignore

        msg = await bot.send_video(chat_id, BufferedInputFile(content, filename="upload.mp4"))
        if msg.video:
            return msg.video.file_id
    except Exception as exc:
        logger.warning("upload_video_for_storage failed: %s", exc)
    return None


async def fetch_file_bytes(file_id: str) -> bytes | None:
    """Stream a Telegram file by ``file_id`` and return its bytes.

    Used by the /api/media/{file_id} proxy so the browser can render photos
    and videos that originated as Telegram uploads (= every photo today).
    """
    bot = get_bot()
    if bot is None:
        return None
    try:
        file = await bot.get_file(file_id)
        buf = await bot.download_file(file.file_path)
        if buf is None:
            return None
        if hasattr(buf, "read"):
            data = buf.read()
        else:
            data = bytes(buf)
        return data
    except Exception as exc:
        logger.info("fetch_file_bytes(%s) failed: %s", file_id, exc)
        return None


async def fetch_file_path(file_id: str) -> str | None:
    """Return the Telegram-side ``file_path`` (used to detect MIME from suffix)."""
    bot = get_bot()
    if bot is None:
        return None
    try:
        file = await bot.get_file(file_id)
        return file.file_path
    except Exception:
        return None


def run_async(coro):
    """Helper for code paths that aren't naturally async (rare)."""
    return asyncio.get_event_loop().run_until_complete(coro)
