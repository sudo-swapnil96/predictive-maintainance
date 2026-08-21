import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import db_session
from app.models.maintenance import MaintenanceRecord
from app.models.machine import Machine
from app.schemas.api import MaintenanceCreate, MaintenanceRead

router=APIRouter(prefix="/maintenance",tags=["maintenance"])

@router.get("",response_model=list[MaintenanceRead])
def list_maintenance(machine_id:uuid.UUID|None=None,limit:int=Query(100,ge=1,le=1000),db:Session=Depends(db_session)):
    stmt=select(MaintenanceRecord).order_by(MaintenanceRecord.date.desc()).limit(limit)
    if machine_id: stmt=stmt.where(MaintenanceRecord.machine_id==machine_id)
    return list(db.scalars(stmt).all())

@router.post("",response_model=MaintenanceRead,status_code=201)
def create_maintenance(payload:MaintenanceCreate,db:Session=Depends(db_session)):
    if not db.get(Machine,payload.machine_id): raise HTTPException(404,"Machine not found")
    obj=MaintenanceRecord(**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
