import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.enums import PredictionType


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    triggering_parameters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    model_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ai_models.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")


class Prediction(Base):
    """
    Insert-only — never UPDATE a row here (see docs/architecture-plan.md
    section 3 / requirement 32). `feature_snapshot` plus the input data
    range is what makes a prediction traceable back to the exact data
    and model version that produced it.
    """

    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    prediction_type: Mapped[PredictionType] = mapped_column(Enum(PredictionType), nullable=False)
    predicted_fault: Mapped[str | None] = mapped_column(String(128), nullable=True)
    probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ai_models.id"), nullable=True)
    feature_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    explanation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    input_data_range_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    input_data_range_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="GENERATED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Fault(Base):
    """Confirmed/labelled faults — becomes training-label data over time."""

    __tablename__ = "faults"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    fault_type: Mapped[str] = mapped_column(String(128), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
