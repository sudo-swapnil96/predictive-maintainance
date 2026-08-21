"""
Centralized application configuration.

All secrets and environment-specific values come from environment
variables (see .env.example at the repo root). Nothing here is
hardcoded. If a required variable is missing at startup, pydantic
will raise a clear validation error instead of silently defaulting
to something insecure.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "Predictive Maintenance Platform"
    environment: Literal["development", "production", "test"] = "development"
    api_v1_prefix: str = "/api/v1"

    # --- Database ---
    database_url: str = Field(..., description="postgresql+psycopg://user:pass@host:port/dbname")

    # --- Auth ---
    jwt_secret_key: str = Field(..., description="Random 32+ char secret, set via env var")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7

    # --- MQTT ---
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_tls_enabled: bool = False

    # --- Simulator ---
    simulator_default_interval_seconds: int = 5

    # --- CORS ---
    cors_allowed_origins: list[str] = ["http://localhost:5173"]

    # --- Logging ---
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — import this, don't instantiate Settings() directly."""
    return Settings()
