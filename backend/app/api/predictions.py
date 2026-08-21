import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import db_session
from app.models.machine import Machine
from app.models.prediction import Anomaly, Prediction
from app.models.enums import PredictionType
from app.schemas.api import AnomalyRead, PredictionRead

router=APIRouter(prefix="/machines/{machine_id}",tags=["predictions"])

@router.get("/predictions",response_model=list[PredictionRead])
def list_predictions(machine_id:uuid.UUID,prediction_type:PredictionType|None=None,limit:int=Query(100,ge=1,le=1000),db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    stmt=select(Prediction).where(Prediction.machine_id==machine_id).order_by(Prediction.created_at.desc()).limit(limit)
    if prediction_type: stmt=stmt.where(Prediction.prediction_type==prediction_type)
    return list(db.scalars(stmt).all())

@router.get("/anomalies",response_model=list[AnomalyRead])
def list_anomalies(machine_id:uuid.UUID,status:str|None=None,limit:int=Query(100,ge=1,le=1000),db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    stmt=select(Anomaly).where(Anomaly.machine_id==machine_id).order_by(Anomaly.detected_at.desc()).limit(limit)
    if status: stmt=stmt.where(Anomaly.status==status)
    return list(db.scalars(stmt).all())
