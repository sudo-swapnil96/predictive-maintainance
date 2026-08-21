import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import db_session
from app.models.alert import Alert
from app.models.machine import Machine
from app.schemas.api import AlertCreate, AlertRead

router=APIRouter(prefix="/machines/{machine_id}/alerts",tags=["alerts"])

@router.get("",response_model=list[AlertRead])
def list_alerts(machine_id:uuid.UUID,active_only:bool=False,limit:int=Query(100,ge=1,le=1000),db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    stmt=select(Alert).where(Alert.machine_id==machine_id).order_by(Alert.triggered_at.desc()).limit(limit)
    if active_only: stmt=stmt.where(Alert.resolved_at.is_(None))
    return list(db.scalars(stmt).all())

@router.post("",response_model=AlertRead,status_code=201)
def create_alert(machine_id:uuid.UUID,payload:AlertCreate,db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    obj=Alert(machine_id=machine_id,**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@router.post("/{alert_id}/resolve",response_model=AlertRead)
def resolve_alert(machine_id:uuid.UUID,alert_id:uuid.UUID,db:Session=Depends(db_session)):
    obj=db.scalar(select(Alert).where(Alert.id==alert_id,Alert.machine_id==machine_id))
    if not obj: raise HTTPException(404,"Alert not found")
    obj.resolved_at=datetime.now(timezone.utc); db.commit(); db.refresh(obj); return obj
