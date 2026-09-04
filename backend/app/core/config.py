"""
Centralized application configuration.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root:
# predictive-maintenance/backend/app/core/config.py
# parents[0] = core
# parents[1] = app
# parents[2] = backend
# parents[3] = predictive-maintenance
BASE_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "Predictive Maintenance Platform"
    environment: Literal["development", "production", "test"] = "development"
    api_v1_prefix: str = "/api/v1"

    # --- Database ---
    database_url: str = Field(
        ...,
        description="postgresql+psycopg://user:pass@host:port/dbname",
    )

    # --- Auth ---
    jwt_secret_key: str = Field(
        ...,
        description="Random 32+ character secret",
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7

    admin_username: str = Field(
        ...,
        description="Single administrator username",
    )
    admin_password_hash: str = Field(
        ...,
        description="Bcrypt hash of administrator password",
    )

    # --- MQTT ---
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_tls_enabled: bool = False

    # --- Simulator ---
    simulator_default_interval_seconds: int = 5

    # --- CORS ---
    cors_allowed_origins: list[str] = [
        "http://localhost:5173"
    ]

    # --- Logging ---
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()