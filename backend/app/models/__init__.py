"""
Import every model here so that a single `import app.models` registers
the full metadata with SQLAlchemy's Base — this is required for Alembic
autogenerate to detect all tables.
"""

from app.models.ai_model import AIModel, Dataset, ModelMetric, SystemLog
from app.models.alert import Alert
from app.models.machine import Machine, MachineParameter, MachineStatusSnapshot, Sensor, SensorCalibration
from app.models.maintenance import MaintenanceRecommendation, MaintenanceRecord
from app.models.prediction import Anomaly, Fault, Prediction
from app.models.reading import SensorReading
from app.models.user import User

__all__ = [
    "AIModel",
    "Dataset",
    "ModelMetric",
    "SystemLog",
    "Alert",
    "Machine",
    "MachineParameter",
    "MachineStatusSnapshot",
    "Sensor",
    "SensorCalibration",
    "MaintenanceRecommendation",
    "MaintenanceRecord",
    "Anomaly",
    "Fault",
    "Prediction",
    "SensorReading",
    "User",
]
