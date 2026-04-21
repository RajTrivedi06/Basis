"""FastAPI application entry point.

Run with: uvicorn basis.api.main:app --reload
"""

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

app = FastAPI(
    title="Basis API",
    description="GPU compute fungibility study -- public pricing data and analysis",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
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
