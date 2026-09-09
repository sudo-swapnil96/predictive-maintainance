from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.enums import AlertSeverity


def create_prediction_alerts(
    db: Session,
    machine_id,
    prediction_result: dict,
    anomaly_result: dict,
) -> list[Alert]:
    """
    Create alerts based on ML prediction and anomaly detection results.

    Rules:
    - FAULT -> CRITICAL alert
    - DEGRADING -> WARNING alert
    - ANOMALY -> WARNING alert
    """

    created_alerts = []

    predicted_state = prediction_result["predicted_state"]

    if predicted_state != "NORMAL":
        redundant_anomaly_alerts = db.scalars(
            select(Alert).where(
                Alert.machine_id == machine_id,
                Alert.parameter_key == "anomaly_detection",
                Alert.resolved_at.is_(None),
            )
        ).all()

        for alert in redundant_anomaly_alerts:
            alert.resolved_at = datetime.now(timezone.utc)

    # ---------------------------------------------------------
    # FAULT ALERT
    # ---------------------------------------------------------

    if predicted_state == "FAULT":

        dedup_key = f"{machine_id}:fault:critical"

        existing_alert = db.scalar(
            select(Alert).where(
                Alert.dedup_key == dedup_key,
                Alert.resolved_at.is_(None),
            )
        )

        if existing_alert is None:

            alert = Alert(
                machine_id=machine_id,
                parameter_key="machine_state",
                severity=AlertSeverity.CRITICAL,
                condition_description=(
                    "Machine fault detected by the predictive "
                    "maintenance model."
                ),
                value=prediction_result["probability"],
                threshold=0.5,
                suggested_action=(
                    "Stop the machine if necessary and perform "
                    "an immediate inspection."
                ),
                dedup_key=dedup_key,
            )

            db.add(alert)

            created_alerts.append(alert)

    # ---------------------------------------------------------
    # DEGRADING ALERT
    # ---------------------------------------------------------

    elif predicted_state == "DEGRADING":

        dedup_key = f"{machine_id}:degrading:warning"

        existing_alert = db.scalar(
            select(Alert).where(
                Alert.dedup_key == dedup_key,
                Alert.resolved_at.is_(None),
            )
        )

        if existing_alert is None:

            alert = Alert(
                machine_id=machine_id,
                parameter_key="machine_state",
                severity=AlertSeverity.WARNING,
                condition_description=(
                    "Machine performance is degrading."
                ),
                value=prediction_result["probability"],
                threshold=0.5,
                suggested_action=(
                    "Inspect the machine and schedule "
                    "preventive maintenance."
                ),
                dedup_key=dedup_key,
            )

            db.add(alert)

            created_alerts.append(alert)

    # ---------------------------------------------------------
    # ANOMALY ALERT
    # ---------------------------------------------------------

    # A non-normal model state already has a machine-state alert. Keep the
    # anomaly record for diagnostics, but avoid creating a duplicate alert.
    if anomaly_result["is_anomaly"] and predicted_state == "NORMAL":

        dedup_key = f"{machine_id}:anomaly:warning"

        existing_alert = db.scalar(
            select(Alert).where(
                Alert.dedup_key == dedup_key,
                Alert.resolved_at.is_(None),
            )
        )

        if existing_alert is None:

            alert = Alert(
                machine_id=machine_id,
                parameter_key="anomaly_detection",
                severity=AlertSeverity.WARNING,
                condition_description=(
                    "An unusual machine operating pattern "
                    "was detected."
                ),
                value=anomaly_result["anomaly_score"],
                threshold=0.0,
                suggested_action=(
                    "Inspect sensor readings and investigate "
                    "the abnormal operating condition."
                ),
                dedup_key=dedup_key,
            )

            db.add(alert)

            created_alerts.append(alert)

    return created_alerts