"""SQLAlchemy declarative base shared by all model modules."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import DeclarativeBase, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """All ORM models inherit from this."""


def utcnow_col():
    """Server-side default timestamp for created_at / updated_at columns."""
    return mapped_column(
        default=func.now(),
        server_default=func.now(),
    )


__all__ = ["Base", "datetime", "utcnow_col"]
