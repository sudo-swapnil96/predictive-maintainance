"""
Schemas for the machine configuration system (Phase 2). These define the
shape of data going in/out of the machine + machine-parameter config —
not yet wired to API routes (that's Phase 3), but establishing the
validated contract now so the config system has a clear, enforced shape
before any endpoint touches it.

Every real-machine-specific field is Optional with no invented default —
see docs/architecture-plan.md section 8 for the TBD-items list this
mirrors.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import DataSource, MachineStatusEnum, ParameterSourceType, SensorStatus


# ---------------------------------------------------------------------------
# Machine
# ---------------------------------------------------------------------------

class MachineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    machine_type: str = Field(default="TBD", max_length=64)
    manufacturer: str | None = Field(default=None, max_length=128)
    model: str | None = Field(default=None, max_length=128)
    installation_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=1024)


class MachineCreate(MachineBase):
    machine_code: str = Field(..., min_length=1, max_length=64)


class MachineUpdate(BaseModel):
    """All fields optional — only what's provided gets updated."""
    name: str | None = Field(default=None, min_length=1, max_length=128)
    machine_type: str | None = Field(default=None, max_length=64)
    manufacturer: str | None = Field(default=None, max_length=128)
    model: str | None = Field(default=None, max_length=128)
    installation_date: datetime | None = None
    operating_hours: float | None = Field(default=None, ge=0)
    status: MachineStatusEnum | None = None
    notes: str | None = Field(default=None, max_length=1024)


class MachineRead(MachineBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    machine_code: str
    operating_hours: float
    status: MachineStatusEnum
    created_at: datetime


# ---------------------------------------------------------------------------
# Machine parameter (the configuration system requested for Phase 2)
# ---------------------------------------------------------------------------

class MachineParameterBase(BaseModel):
    parameter_key: str = Field(..., min_length=1, max_length=64, description="Stable machine-readable key, e.g. 'vibration'")
    display_name: str = Field(..., min_length=1, max_length=128)
    unit: str | None = Field(default=None, max_length=32)
    enabled: bool = True

    # Sensor/controller source
    source_type: ParameterSourceType = ParameterSourceType.TBD
    source_description: str | None = Field(default=None, max_length=256)

    # Sampling frequency — null until the real controller's capabilities are known
    sampling_interval_seconds: float | None = Field(default=None, gt=0)

    # Configured default for readings until real hardware is connected
    expected_data_source: DataSource = DataSource.SIMULATED

    # Thresholds — all optional, all TBD until real baseline data exists
    normal_min: float | None = None
    normal_max: float | None = None
    warning_min: float | None = None
    warning_max: float | None = None
    critical_min: float | None = None
    critical_max: float | None = None

    @field_validator("normal_max")
    @classmethod
    def normal_max_at_least_min(cls, v: float | None, info) -> float | None:
        normal_min = info.data.get("normal_min")
        if v is not None and normal_min is not None and v < normal_min:
            raise ValueError("normal_max must be >= normal_min")
        return v


class MachineParameterCreate(MachineParameterBase):
    pass


class MachineParameterUpdate(BaseModel):
    """All fields optional — only what's provided gets updated."""
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    unit: str | None = Field(default=None, max_length=32)
    enabled: bool | None = None
    source_type: ParameterSourceType | None = None
    source_description: str | None = Field(default=None, max_length=256)
    sampling_interval_seconds: float | None = Field(default=None, gt=0)
    expected_data_source: DataSource | None = None
    normal_min: float | None = None
    normal_max: float | None = None
    warning_min: float | None = None
    warning_max: float | None = None
    critical_min: float | None = None
    critical_max: float | None = None


class MachineParameterRead(MachineParameterBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    machine_id: uuid.UUID


# ---------------------------------------------------------------------------
# Sensor + calibration
# ---------------------------------------------------------------------------

class SensorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    machine_id: uuid.UUID
    parameter_id: uuid.UUID
    sensor_name: str
    status: SensorStatus
    last_seen_at: datetime | None


class SensorCalibrationCreate(BaseModel):
    """
    Records a calibration event. Leave fields null/unset until an actual
    calibration has been performed on the physical instrument — do not
    fill these in speculatively.
    """
    calibrated_at: datetime | None = None
    calibrated_by: str | None = Field(default=None, max_length=128)
    calibration_method: str | None = Field(default=None, max_length=256)
    reference_standard: str | None = Field(default=None, max_length=256)
    offset_applied: float | None = None
    valid_until: datetime | None = None
    notes: str | None = Field(default=None, max_length=1024)


class SensorCalibrationRead(SensorCalibrationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sensor_id: uuid.UUID
    created_at: datetime
