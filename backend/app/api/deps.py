from collections.abc import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

def db_session(db: Session = Depends(get_db)) -> Session:
    return db
