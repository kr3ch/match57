"""One-shot CLI: promote a user to admin (or revoke).

Usage on Render (or locally):

    cd backend
    python scripts/grant_admin.py promote vasya@example.com
    python scripts/grant_admin.py revoke  vasya@example.com
    python scripts/grant_admin.py list

The script talks straight to the DB via the project's async session, so it
works against SQLite *and* Postgres without extra setup.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Sequence

from sqlalchemy import select

from app.db import SessionLocal
from app.db.models import User


async def _resolve(session, identifier: str) -> User | None:
    """Look up by id (int) or email (str)."""
    try:
        user_id = int(identifier)
    except ValueError:
        user_id = None
    stmt = select(User).where(User.id == user_id) if user_id is not None else select(User).where(
        User.email == identifier.lower()
    )
    return await session.scalar(stmt)


async def _set(identifier: str, value: bool) -> int:
    async with SessionLocal() as session:
        user = await _resolve(session, identifier)
        if user is None:
            print(f"user not found: {identifier}", file=sys.stderr)
            return 1
        user.is_admin = value
        await session.commit()
        print(f"{'PROMOTED' if value else 'REVOKED '} id={user.id} email={user.email} name={user.name}")
        return 0


async def _list() -> int:
    async with SessionLocal() as session:
        rows = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().all()
        if not rows:
            print("no admins")
            return 0
        for u in rows:
            print(f"id={u.id}\temail={u.email}\tname={u.name}")
        return 0


def main(argv: Sequence[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    cmd = argv[1]
    if cmd == "list":
        return asyncio.run(_list())
    if cmd in ("promote", "revoke") and len(argv) >= 3:
        return asyncio.run(_set(argv[2], cmd == "promote"))
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
