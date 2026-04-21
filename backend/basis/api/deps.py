"""Shared FastAPI dependencies.

Provides dependency-injected database sessions and common query parameters.
"""

from collections.abc import AsyncGenerator

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from basis.db.engine import get_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for request-scoped use."""
    async for session in get_session():
        yield session


class PaginationParams:
    """Common pagination query parameters."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size
