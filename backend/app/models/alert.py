import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.enums import AlertSeverity


class Alert(Base):
    """
    `dedup_key` (typically hash of machine_id + parameter_key + severity)
    plus `triggered_at` is how the alert service enforces a cooldown
    window and avoids spamming repeated alerts for the same ongoing
    condition (see docs/architecture-plan.md section 3).
    """

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    parameter_key: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    condition_description: Mapped[str] = mapped_column(String(512), nullable=False)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(String(512), nullable=True)
    dedup_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
