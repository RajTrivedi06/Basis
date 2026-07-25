"""FastAPI application entry point.

Run with: uvicorn basis.api.main:app --reload
"""

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from basis.api.routes import (
    basis,
    dispersion,
    fungibility,
    gpu_skus,
    health,
    offers,
    providers,
    provenance,
)
from basis.config import settings

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.0,
    )

app = FastAPI(
    title="Basis API",
    description="GPU compute fungibility study -- public pricing data and analysis",
    version="0.1.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(offers.router)
app.include_router(dispersion.router)
app.include_router(basis.router)
app.include_router(providers.router)
app.include_router(gpu_skus.router)
app.include_router(fungibility.router)
app.include_router(provenance.router)


@app.get("/")
async def root() -> dict[str, str]:
    """Project metadata."""
    return {
        "project": "Basis",
        "version": "0.1.0",
        "description": "GPU compute fungibility study",
        "environment": settings.environment,
        "docs": "/docs",
    }
