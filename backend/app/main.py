from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import get_logger
from app.api import machines, readings, alerts, maintenance, predictions

settings = get_settings()
logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", tags=["system"])
def health_check() -> dict:
    """Basic liveness check — DB connectivity is checked separately in /health/db (Phase 2/3)."""
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@app.on_event("startup")
def on_startup() -> None:
    logger.info("Starting %s in %s mode", settings.app_name, settings.environment)


app.include_router(machines.router, prefix=settings.api_v1_prefix)
app.include_router(readings.router, prefix=settings.api_v1_prefix)
app.include_router(alerts.router, prefix=settings.api_v1_prefix)
app.include_router(maintenance.router, prefix=settings.api_v1_prefix)
app.include_router(predictions.router, prefix=settings.api_v1_prefix)
