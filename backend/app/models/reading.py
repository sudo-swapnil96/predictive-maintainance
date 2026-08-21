import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.enums import DataQuality, DataSource


class SensorReading(Base):
    """
    The core time-series table. Every reading — whether from real MQTT
    traffic, the simulator, or a replayed dataset — lands here through
    the same ingestion path, tagged with `source` and `quality`. This is
    what structurally prevents simulated data from being presented as
    real (see docs/architecture-plan.md section 1).
    """

    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_readings_machine_param_time", "machine_id", "parameter_key", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False)
    sensor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sensors.id"), nullable=True)
    parameter_key: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)  # null when quality=MISSING
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quality: Mapped[DataQuality] = mapped_column(Enum(DataQuality), nullable=False)
    source: Mapped[DataSource] = mapped_column(Enum(DataSource), nullable=False)
