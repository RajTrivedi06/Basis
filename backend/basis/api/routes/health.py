"""Health check endpoint."""

from fastapi import APIRouter

from basis.schemas.api import HealthResponse
from basis.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return application health status."""
    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.environment,
    )
