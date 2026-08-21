import math, uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import db_session
from app.models.machine import Machine, MachineParameter, Sensor, SensorCalibration, MachineStatusSnapshot
from app.schemas.machine import (
    MachineCreate, MachineRead, MachineUpdate, MachineParameterCreate,
    MachineParameterRead, MachineParameterUpdate, SensorRead,
    SensorCalibrationCreate, SensorCalibrationRead
)
from app.schemas.api import MachineStatusRead, PageMeta, SensorCreate

router=APIRouter(prefix="/machines", tags=["machines"])

def _machine_or_404(db, machine_id):
    obj=db.get(Machine,machine_id)
    if not obj: raise HTTPException(404,"Machine not found")
    return obj

@router.get("", response_model=list[MachineRead])
def list_machines(db: Session=Depends(db_session), page:int=Query(1,ge=1), page_size:int=Query(50,ge=1,le=100), status_filter=None):
    stmt=select(Machine).order_by(Machine.created_at.desc()).offset((page-1)*page_size).limit(page_size)
    if status_filter: stmt=stmt.where(Machine.status==status_filter)
    return list(db.scalars(stmt).all())

@router.post("", response_model=MachineRead, status_code=status.HTTP_201_CREATED)
def create_machine(payload:MachineCreate, db:Session=Depends(db_session)):
    if db.scalar(select(Machine).where(Machine.machine_code==payload.machine_code)):
        raise HTTPException(409,"machine_code already exists")
    obj=Machine(**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/{machine_id}", response_model=MachineRead)
def get_machine(machine_id:uuid.UUID, db:Session=Depends(db_session)): return _machine_or_404(db,machine_id)

@router.patch("/{machine_id}", response_model=MachineRead)
def update_machine(machine_id:uuid.UUID,payload:MachineUpdate,db:Session=Depends(db_session)):
    obj=_machine_or_404(db,machine_id)
    for k,v in payload.model_dump(exclude_unset=True).items(): setattr(obj,k,v)
    db.commit(); db.refresh(obj); return obj

@router.delete("/{machine_id}",status_code=204)
def delete_machine(machine_id:uuid.UUID,db:Session=Depends(db_session)):
    obj=_machine_or_404(db,machine_id)
    db.delete(obj); db.commit()

@router.get("/{machine_id}/parameters",response_model=list[MachineParameterRead])
def list_parameters(machine_id:uuid.UUID,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    return list(db.scalars(select(MachineParameter).where(MachineParameter.machine_id==machine_id).order_by(MachineParameter.parameter_key)).all())

@router.post("/{machine_id}/parameters",response_model=MachineParameterRead,status_code=201)
def create_parameter(machine_id:uuid.UUID,payload:MachineParameterCreate,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    if db.scalar(select(MachineParameter).where(MachineParameter.machine_id==machine_id,MachineParameter.parameter_key==payload.parameter_key)):
        raise HTTPException(409,"parameter_key already exists for this machine")
    obj=MachineParameter(machine_id=machine_id,**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@router.patch("/{machine_id}/parameters/{parameter_id}",response_model=MachineParameterRead)
def update_parameter(machine_id:uuid.UUID,parameter_id:uuid.UUID,payload:MachineParameterUpdate,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id); obj=db.scalar(select(MachineParameter).where(MachineParameter.id==parameter_id,MachineParameter.machine_id==machine_id))
    if not obj: raise HTTPException(404,"Machine parameter not found")
    for k,v in payload.model_dump(exclude_unset=True).items(): setattr(obj,k,v)
    db.commit(); db.refresh(obj); return obj

@router.get("/{machine_id}/sensors",response_model=list[SensorRead])
def list_sensors(machine_id:uuid.UUID,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    return list(db.scalars(select(Sensor).where(Sensor.machine_id==machine_id).order_by(Sensor.sensor_name)).all())

@router.post("/{machine_id}/sensors",response_model=SensorRead,status_code=201)
def create_sensor(machine_id:uuid.UUID,payload:SensorCreate,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    param=db.scalar(select(MachineParameter).where(MachineParameter.id==payload.parameter_id,MachineParameter.machine_id==machine_id))
    if not param: raise HTTPException(404,"Machine parameter not found")
    obj=Sensor(machine_id=machine_id,**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/{machine_id}/sensors/{sensor_id}/calibrations",response_model=list[SensorCalibrationRead])
def list_calibrations(machine_id:uuid.UUID,sensor_id:uuid.UUID,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    sensor=db.scalar(select(Sensor).where(Sensor.id==sensor_id,Sensor.machine_id==machine_id))
    if not sensor: raise HTTPException(404,"Sensor not found")
    return list(db.scalars(select(SensorCalibration).where(SensorCalibration.sensor_id==sensor_id).order_by(SensorCalibration.created_at.desc())).all())

@router.post("/{machine_id}/sensors/{sensor_id}/calibrations",response_model=SensorCalibrationRead,status_code=201)
def create_calibration(machine_id:uuid.UUID,sensor_id:uuid.UUID,payload:SensorCalibrationCreate,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id)
    if not db.scalar(select(Sensor).where(Sensor.id==sensor_id,Sensor.machine_id==machine_id)): raise HTTPException(404,"Sensor not found")
    obj=SensorCalibration(sensor_id=sensor_id,**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/{machine_id}/health",response_model=MachineStatusRead)
def get_health(machine_id:uuid.UUID,db:Session=Depends(db_session)):
    _machine_or_404(db,machine_id); obj=db.get(MachineStatusSnapshot,machine_id)
    if not obj: raise HTTPException(404,"Machine health status not available")
    return obj

@router.get("/{machine_id}/status",response_model=MachineStatusRead)
def get_status(machine_id:uuid.UUID,db:Session=Depends(db_session)):
    return get_health(machine_id,db)
