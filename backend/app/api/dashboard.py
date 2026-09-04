import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.alert import Alert
from app.models.machine import Machine
from app.models.prediction import Anomaly, Prediction


router = APIRouter(
    prefix="/machines/{machine_id}",
    tags=["dashboard"],
)


@router.get("/dashboard")
def get_machine_dashboard(
    machine_id: uuid.UUID,
    db: Session = Depends(db_session),
):
    # Check whether the machine exists.
    machine = db.get(Machine, machine_id)

    if machine is None:
        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    # Get the most recent prediction.
    latest_prediction = db.scalar(
        select(Prediction)
        .where(Prediction.machine_id == machine_id)
        .order_by(Prediction.created_at.desc())
        .limit(1)
    )

    # Get the most recent anomaly.
    latest_anomaly = db.scalar(
        select(Anomaly)
        .where(Anomaly.machine_id == machine_id)
        .order_by(Anomaly.detected_at.desc())
        .limit(1)
    )

    # Count open anomalies.
    open_anomalies = db.scalar(
        select(func.count())
        .select_from(Anomaly)
        .where(
            Anomaly.machine_id == machine_id,
            Anomaly.status == "OPEN",
        )
    )

    # Count unresolved alerts.
    active_alerts = db.scalar(
        select(func.count())
        .select_from(Alert)
        .where(
            Alert.machine_id == machine_id,
            Alert.resolved_at.is_(None),
        )
    )

    # Determine overall machine health.
    overall_health = "HEALTHY"

    if latest_prediction is not None:
        if latest_prediction.predicted_fault == "FAULT":
            overall_health = "CRITICAL"

        elif latest_prediction.predicted_fault == "DEGRADING":
            overall_health = "WARNING"

    if active_alerts and active_alerts > 0:
        critical_alert = db.scalar(
            select(Alert)
            .where(
                Alert.machine_id == machine_id,
                Alert.resolved_at.is_(None),
                Alert.severity == "CRITICAL",
            )
            .limit(1)
        )

        if critical_alert is not None:
            overall_health = "CRITICAL"

        elif overall_health == "HEALTHY":
            overall_health = "WARNING"

    return {
        "machine_id": str(machine.id),
        "machine_name": machine.name,
        "machine_status": str(machine.status),

        "latest_prediction": (
            {
                "predicted_state": latest_prediction.predicted_fault,
                "probability": latest_prediction.probability,
                "created_at": latest_prediction.created_at,
            }
            if latest_prediction is not None
            else None
        ),

        "latest_anomaly": (
            {
                "anomaly_score": latest_anomaly.anomaly_score,
                "status": latest_anomaly.status,
                "detected_at": latest_anomaly.detected_at,
            }
            if latest_anomaly is not None
            else None
        ),

        "open_anomalies": open_anomalies or 0,
        "active_alerts": active_alerts or 0,
        "overall_health": overall_health,
    }