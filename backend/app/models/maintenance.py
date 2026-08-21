import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issue: Mapped[str] = mapped_column(String(512), nullable=False)
    detected_fault: Mapped[str | None] = mapped_column(String(128), nullable=True)
    action_taken: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    technician: Mapped[str | None] = mapped_column(String(128), nullable=True)
    parts_replaced: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    downtime_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    next_maintenance_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MaintenanceRecommendation(Base):
    __tablename__ = "maintenance_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    anomaly_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("anomalies.id"), nullable=True)
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("predictions.id"), nullable=True)
    # Wording is intentionally advisory ("Recommended inspection...") per
    # docs/architecture-plan.md — recommendation text is config-driven,
    # never a hardcoded "replace immediately" instruction.
    recommendation_text: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
