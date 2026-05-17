"""User-to-user block list operations.

Blocks are directional: ``blocker_id`` chose to stop receiving anything
from ``blocked_id``. For message gating we treat any block in *either*
direction as a hard wall — neither side can send to the other once at
least one of them has blocked.

The existing :class:`Match` / :class:`Conversation` rows are left
intact; we just refuse to route new messages while a block is active.
That way unblocking restores the chat without re-running the matching
flow.
"""

from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserBlock


async def block_user(db: AsyncSession, blocker_id: int, blocked_id: int) -> bool:
    """Insert a block row. Idempotent — re-blocking the same user returns ``True``
    without raising. Returns ``True`` when a new row was created, ``False`` when
    the pair was already blocked.
    """
    if blocker_id == blocked_id:
        return False
    existing = await db.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return False
    db.add(UserBlock(blocker_id=blocker_id, blocked_id=blocked_id))
    try:
        await db.flush()
    except IntegrityError:
        # Race condition: another concurrent request inserted the same pair.
        await db.rollback()
        return False
    return True


async def unblock_user(db: AsyncSession, blocker_id: int, blocked_id: int) -> bool:
    """Remove a block. Returns ``True`` when a row was removed."""
    res = await db.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id,
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def block_status(
    db: AsyncSession, viewer_id: int, other_id: int
) -> dict[str, bool]:
    """Resolve the pair state from the viewer's perspective.

    Returns ``{"i_blocked": bool, "they_blocked": bool}``. ``either`` is
    derivable by the caller via ``i_blocked or they_blocked``.
    """
    if viewer_id == other_id:
        return {"i_blocked": False, "they_blocked": False}
    res = await db.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_id).where(
            or_(
                and_(UserBlock.blocker_id == viewer_id, UserBlock.blocked_id == other_id),
                and_(UserBlock.blocker_id == other_id, UserBlock.blocked_id == viewer_id),
            )
        )
    )
    i_blocked = False
    they_blocked = False
    for blocker, blocked in res.all():
        if blocker == viewer_id and blocked == other_id:
            i_blocked = True
        elif blocker == other_id and blocked == viewer_id:
            they_blocked = True
    return {"i_blocked": i_blocked, "they_blocked": they_blocked}


async def is_pair_blocked(db: AsyncSession, a_id: int, b_id: int) -> bool:
    """``True`` if either side of the pair has an active block on the other."""
    if a_id == b_id:
        return False
    res = await db.execute(
        select(UserBlock.id)
        .where(
            or_(
                and_(UserBlock.blocker_id == a_id, UserBlock.blocked_id == b_id),
                and_(UserBlock.blocker_id == b_id, UserBlock.blocked_id == a_id),
            )
        )
        .limit(1)
    )
    return res.scalar_one_or_none() is not None


async def blocked_user_ids(db: AsyncSession, viewer_id: int) -> set[int]:
    """All user ids the viewer is currently blocking. Used for excluding rows
    from feeds / matches list."""
    res = await db.execute(
        select(UserBlock.blocked_id).where(UserBlock.blocker_id == viewer_id)
    )
    return {int(r[0]) for r in res.all()}


async def users_blocking_viewer(db: AsyncSession, viewer_id: int) -> set[int]:
    """All user ids who have blocked the viewer."""
    res = await db.execute(
        select(UserBlock.blocker_id).where(UserBlock.blocked_id == viewer_id)
    )
    return {int(r[0]) for r in res.all()}


__all__ = [
    "block_status",
    "block_user",
    "blocked_user_ids",
    "is_pair_blocked",
    "unblock_user",
    "users_blocking_viewer",
]
