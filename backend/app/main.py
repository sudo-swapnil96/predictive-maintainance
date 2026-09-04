from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import get_logger
from app.api import (
    machines,
    readings,
    alerts,
    maintenance,
    predictions,
    dashboard,
)

settings = get_settings()
logger = get_logger(__name__)

# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://predictive-maintenance-theta.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CORS CONFIGURATION
#
# Allows the React/Vite frontend to communicate with the API.
# Both ports are included because Vite may automatically switch
# from 5173 to 5174 when another development server is running.
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# SYSTEM HEALTH CHECK
# ============================================================

@app.get("/api/v1/health", tags=["system"])
def health_check() -> dict:
    """Basic application health check."""

    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
    }


# ============================================================
# APPLICATION STARTUP
# ============================================================

@app.on_event("startup")
def on_startup() -> None:
    logger.info(
        "Starting %s in %s mode",
        settings.app_name,
        settings.environment,
    )


# ============================================================
# API ROUTERS
# ============================================================

app.include_router(
    machines.router,
    prefix=settings.api_v1_prefix,
)

app.include_router(
    readings.router,
    prefix=settings.api_v1_prefix,
)

app.include_router(
    alerts.router,
    prefix=settings.api_v1_prefix,
)

app.include_router(
    maintenance.router,
    prefix=settings.api_v1_prefix,
)

app.include_router(
    predictions.router,
    prefix=settings.api_v1_prefix,
)

app.include_router(
    dashboard.router,
    prefix=settings.api_v1_prefix,
)