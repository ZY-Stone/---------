"""
backend/routers/dashboard.py — 数据总览 API
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from services.data_service import get_width_summary, get_potential_summary, get_dept_ranking

router = APIRouter(prefix="/api/dashboard", tags=["总览"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/overview")
def overview(request: Request, db: Session = Depends(get_db)):
    u = _user(request)
    width = get_width_summary(db, u)
    potential = get_potential_summary(db, u)
    return {"width": width, "potential": potential}


@router.get("/dept-ranking")
def dept_ranking(request: Request, db: Session = Depends(get_db)):
    return get_dept_ranking(db, _user(request))
