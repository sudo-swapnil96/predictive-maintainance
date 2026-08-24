import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.enums import PredictionType
from app.models.machine import Machine
from app.models.prediction import Anomaly, Prediction
from app.schemas.api import AnomalyRead, PredictionRead

from app.ml.inference.predictor import predict_machine_state
from app.ml.xai.explainer import explain_prediction

router = APIRouter(
    prefix="/machines/{machine_id}",
    tags=["predictions"],
)


class PredictionRequest(BaseModel):
    vibration: float
    motor_temperature: float
    motor_current: float
    motor_voltage: float
    rpm: float
    pressure: float
    ambient_temperature: float
    humidity: float


@router.post("/predict", response_model=PredictionRead, status_code=201)
def create_prediction(
    machine_id: uuid.UUID,
    request: PredictionRequest,
    db: Session = Depends(db_session),
):
    machine = db.get(Machine, machine_id)

    if machine is None:
        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    features = {
        "vibration": request.vibration,
        "motor_temperature": request.motor_temperature,
        "motor_current": request.motor_current,
        "motor_voltage": request.motor_voltage,
        "rpm": request.rpm,
        "pressure": request.pressure,
        "ambient_temperature": request.ambient_temperature,
        "humidity": request.humidity,
    }

    try:
        result = predict_machine_state(features)
        xai_explanation = explain_prediction(features)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    now = datetime.now(timezone.utc)

    prediction = Prediction(
        machine_id=machine_id,
        prediction_type=PredictionType.FAULT_CLASSIFICATION,
        predicted_fault=result["predicted_state"],
        probability=result["probability"],
        model_id=None,
        feature_snapshot=result["features"],
        explanation={
            "class_probabilities": result["class_probabilities"],
            "data_source": result["data_source"],
            "model_path": result["model_path"],
            "xai": xai_explanation,
        },
        input_data_range_start=now,
        input_data_range_end=now,
        status="GENERATED",
    )

    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    return prediction

@router.get(
    "/predictions",
    response_model=list[PredictionRead],
)
def list_predictions(
    machine_id: uuid.UUID,
    prediction_type: PredictionType | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(db_session),
):
    if not db.get(Machine, machine_id):
        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    stmt = (
        select(Prediction)
        .where(Prediction.machine_id == machine_id)
        .order_by(Prediction.created_at.desc())
        .limit(limit)
    )

    if prediction_type:
        stmt = stmt.where(
            Prediction.prediction_type == prediction_type
        )

    return list(db.scalars(stmt).all())


@router.get(
    "/anomalies",
    response_model=list[AnomalyRead],
)
def list_anomalies(
    machine_id: uuid.UUID,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(db_session),
):
    if not db.get(Machine, machine_id):
        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    stmt = (
        select(Anomaly)
        .where(Anomaly.machine_id == machine_id)
        .order_by(Anomaly.detected_at.desc())
        .limit(limit)
    )

    if status:
        stmt = stmt.where(Anomaly.status == status)

    return list(db.scalars(stmt).all())