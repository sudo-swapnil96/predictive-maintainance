"""Phase 3 API contracts. No machine-specific values are invented here."""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import (
    AlertSeverity, DataQuality, DataSource, HealthCondition, MachineStatusEnum,
    PredictionType, SensorStatus
)

class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int

class MachineStatusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    machine_id: uuid.UUID
    health_score: float | None
    condition: HealthCondition
    last_updated: datetime

class SensorCreate(BaseModel):
    parameter_id: uuid.UUID
    sensor_name: str = Field(..., min_length=1, max_length=128)
    status: SensorStatus = SensorStatus.DISCONNECTED
    last_seen_at: datetime | None = None

class SensorReadCreate(BaseModel):
    sensor_id: uuid.UUID | None = None
    parameter_key: str = Field(..., min_length=1, max_length=64)
    value: float | None = None
    unit: str | None = Field(default=None, max_length=32)
    timestamp: datetime
    quality: DataQuality
    source: DataSource

class SensorReadingRead(SensorReadCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    machine_id: uuid.UUID

class AlertCreate(BaseModel):
    parameter_key: str = Field(..., min_length=1, max_length=64)
    severity: AlertSeverity
    condition_description: str = Field(..., min_length=1, max_length=512)
    value: float | None = None
    threshold: float | None = None
    suggested_action: str | None = Field(default=None, max_length=512)
    dedup_key: str = Field(..., min_length=1, max_length=128)

class AlertUpdate(BaseModel):
    resolved: bool = True

class AlertRead(AlertCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    machine_id: uuid.UUID
    triggered_at: datetime
    resolved_at: datetime | None

class MaintenanceCreate(BaseModel):
    machine_id: uuid.UUID
    date: datetime
    issue: str = Field(..., min_length=1, max_length=512)
    detected_fault: str | None = Field(default=None, max_length=128)
    action_taken: str | None = Field(default=None, max_length=1024)
    technician: str | None = Field(default=None, max_length=128)
    parts_replaced: str | None = Field(default=None, max_length=512)
    notes: str | None = Field(default=None, max_length=1024)
    cost: float | None = Field(default=None, ge=0)
    downtime_minutes: float | None = Field(default=None, ge=0)
    next_maintenance_date: datetime | None = None

class MaintenanceRead(MaintenanceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime

class AnomalyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    machine_id: uuid.UUID
    detected_at: datetime
    anomaly_score: float
    triggering_parameters: dict
    model_id: uuid.UUID | None
    status: str

class PredictionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    machine_id: uuid.UUID
    prediction_type: PredictionType
    predicted_fault: str | None
    probability: float | None
    model_id: uuid.UUID | None
    feature_snapshot: dict
    explanation: dict | None
    input_data_range_start: datetime | None
    input_data_range_end: datetime | None
    status: str
    created_at: datetime
