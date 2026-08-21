"""
Central logging configuration. Import `get_logger(__name__)` anywhere
instead of using print(). Never logs secrets (passwords, tokens, MQTT
credentials) — callers must not pass them in.
"""

import logging
import sys

from app.core.config import get_settings

_configured = False


def _configure_once() -> None:
    global _configured
    if _configured:
        return
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
    _configured = True


def get_logger(name: str) -> logging.Logger:
    _configure_once()
    return logging.getLogger(name)
