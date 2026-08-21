import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import DataSource, HealthCondition, MachineStatusEnum, ParameterSourceType, SensorStatus


class Machine(Base):
    """
    A configurable machine profile. Fields intentionally nullable where
    the real specification is not yet known (see docs/architecture-plan.md
    section 8 — TBD items). Never populate these with invented values;
    leave null / "TBD" until verified against the physical machine.
    """

    __tablename__ = "machines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    machine_type: Mapped[str] = mapped_column(String(64), nullable=False, default="TBD")
    manufacturer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    installation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operating_hours: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[MachineStatusEnum] = mapped_column(
        Enum(MachineStatusEnum), default=MachineStatusEnum.UNKNOWN
    )
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    parameters: Mapped[list["MachineParameter"]] = relationship(back_populates="machine")
    sensors: Mapped[list["Sensor"]] = relationship(back_populates="machine")


class MachineParameter(Base):
    """
    Defines which parameters exist/are enabled for a given machine, their
    thresholds, and where their data comes from. This table is what lets
    the platform support different machine types without hardcoding
    parameter lists — see docs/architecture-plan.md section 3.

    Field-to-concept mapping (per the Phase 2 configuration requirements):
    - parameter name      -> parameter_key, display_name
    - unit                -> unit
    - sensor/controller
      source               -> source_type, source_description
    - sampling frequency  -> sampling_interval_seconds
    - normal/warning/
      critical range       -> normal_min/max, warning_min/max, critical_min/max
    - sensor status        -> lives on Sensor.status (runtime, per physical
                              instrument — this table is the logical
                              parameter *definition*, not the live instrument
                              state, so status is intentionally not
                              duplicated here)
    - data quality          -> lives on SensorReading.quality (per-reading,
                              inherently dynamic — see docs/architecture-plan.md
                              section 7)
    - data source            -> lives on SensorReading.source (per-reading);
                              expected_data_source below is the *configured
                              default* used until real hardware is connected
    - calibration information -> SensorCalibration table (linked via Sensor,
                              since calibration is a property of the physical
                              instrument, not the logical parameter) — kept
                              as a history table rather than a single field
                              so calibration events are never overwritten
    """

    __tablename__ = "machine_parameters"
    __table_args__ = (
        UniqueConstraint("machine_id", "parameter_key", name="uq_machine_parameter_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    parameter_key: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "vibration"
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sensor/controller source — TBD by default; never guess for a real machine.
    source_type: Mapped[ParameterSourceType] = mapped_column(
        Enum(ParameterSourceType), default=ParameterSourceType.TBD
    )
    source_description: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Sampling frequency. Null/TBD until the real controller's capabilities
    # are known — do not assume a rate for real hardware.
    sampling_interval_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Configured default source for this parameter's data until real
    # hardware is connected. Individual readings still carry their own
    # authoritative `source`/`quality` — this is a config-time default,
    # not a runtime override.
    expected_data_source: Mapped[DataSource] = mapped_column(Enum(DataSource), default=DataSource.SIMULATED)

    normal_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    normal_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    warning_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    warning_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    machine: Mapped["Machine"] = relationship(back_populates="parameters")


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    parameter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machine_parameters.id"), nullable=False, index=True
    )
    sensor_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[SensorStatus] = mapped_column(Enum(SensorStatus), default=SensorStatus.DISCONNECTED)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    machine: Mapped["Machine"] = relationship(back_populates="sensors")
    calibrations: Mapped[list["SensorCalibration"]] = relationship(back_populates="sensor")


class SensorCalibration(Base):
    """
    Calibration history for a physical sensor/instrument. Insert-only —
    each calibration event gets its own row rather than overwriting a
    single "last calibrated" field, so the full history is always
    traceable (matches the traceability requirement in
    docs/architecture-plan.md section 3 / requirement 32).

    All fields nullable/TBD until the physical machine and its sensors
    have actually been inspected and calibrated — never invent a
    calibration date or method for hardware that hasn't been verified.
    """

    __tablename__ = "sensor_calibrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sensors.id"), nullable=False, index=True)
    calibrated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calibrated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    calibration_method: Mapped[str | None] = mapped_column(String(256), nullable=True)
    reference_standard: Mapped[str | None] = mapped_column(String(256), nullable=True)
    offset_applied: Mapped[float | None] = mapped_column(Float, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sensor: Mapped["Sensor"] = relationship(back_populates="calibrations")


class MachineStatusSnapshot(Base):
    """
    Rolling current-state row per machine — one row per machine, kept up
    to date by the prediction/health-scoring service. Separate from
    sensor_readings history so the dashboard's "current state" call is
    a single indexed lookup, not a scan.
    """

    __tablename__ = "machine_status"

    machine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("machines.id"), primary_key=True)
    health_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    condition: Mapped[HealthCondition] = mapped_column(Enum(HealthCondition), default=HealthCondition.UNKNOWN)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
