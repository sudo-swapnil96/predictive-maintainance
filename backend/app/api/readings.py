import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import db_session
from app.models.machine import Machine
from app.models.reading import SensorReading
from app.schemas.api import SensorReadCreate, SensorReadingRead

router=APIRouter(prefix="/machines/{machine_id}/readings",tags=["readings"])

@router.get("",response_model=list[SensorReadingRead])
def list_readings(machine_id:uuid.UUID,parameter_key:str|None=None,from_ts:datetime|None=Query(None,alias="from"),to_ts:datetime|None=Query(None,alias="to"),resolution:str|None=None,limit:int=Query(500,ge=1,le=5000),db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    if from_ts and to_ts and to_ts<from_ts: raise HTTPException(400,"to must be >= from")
    stmt=select(SensorReading).where(SensorReading.machine_id==machine_id).order_by(SensorReading.timestamp.desc()).limit(limit)
    if parameter_key: stmt=stmt.where(SensorReading.parameter_key==parameter_key)
    if from_ts: stmt=stmt.where(SensorReading.timestamp>=from_ts)
    if to_ts: stmt=stmt.where(SensorReading.timestamp<=to_ts)
    return list(db.scalars(stmt).all())

@router.post("",response_model=SensorReadingRead,status_code=201)
def create_reading(machine_id:uuid.UUID,payload:SensorReadCreate,db:Session=Depends(db_session)):
    if not db.get(Machine,machine_id): raise HTTPException(404,"Machine not found")
    if payload.sensor_id:
        from app.models.machine import Sensor
        if not db.scalar(select(Sensor).where(Sensor.id==payload.sensor_id,Sensor.machine_id==machine_id)): raise HTTPException(404,"Sensor not found")
    obj=SensorReading(machine_id=machine_id,**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
