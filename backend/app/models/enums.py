import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    ENGINEER = "ENGINEER"
    VIEWER = "VIEWER"


class MachineStatusEnum(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"
    UNKNOWN = "UNKNOWN"


class DataQuality(str, enum.Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    MISSING = "MISSING"
    SUSPECT = "SUSPECT"
    SIMULATED = "SIMULATED"


class DataSource(str, enum.Enum):
    REAL = "REAL"
    SIMULATED = "SIMULATED"
    DATASET_REPLAY = "DATASET_REPLAY"


class SensorStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    INVALID = "INVALID"
    STALE = "STALE"


class HealthCondition(str, enum.Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"


class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class ModelStatus(str, enum.Enum):
    TRAINING = "TRAINING"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    FAILED = "FAILED"


class ParameterSourceType(str, enum.Enum):
    """Where a parameter's value originates from on the physical machine.
    Defaults to TBD until the physical machine has been inspected —
    never guess this for a real parameter."""
    SENSOR = "SENSOR"
    CONTROLLER = "CONTROLLER"
    PLC = "PLC"
    CALCULATED = "CALCULATED"
    MANUAL = "MANUAL"
    TBD = "TBD"


class PredictionType(str, enum.Enum):
    ANOMALY = "ANOMALY"
    FAULT_CLASSIFICATION = "FAULT_CLASSIFICATION"
    RUL = "RUL"
