"""
backend/routers/potential.py — 潜力产品 API
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from services.data_service import get_potential_summary, get_dept_ranking, get_team_matrix

router = APIRouter(prefix="/api/potential", tags=["潜力产品"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/summary")
def summary(request: Request, db: Session = Depends(get_db)):
    return get_potential_summary(db, _user(request))


@router.get("/dept-ranking")
def dept_ranking(request: Request, db: Session = Depends(get_db)):
    return get_dept_ranking(db, _user(request))


@router.get("/team-matrix")
def team_matrix(request: Request, db: Session = Depends(get_db)):
    return get_team_matrix(db, _user(request))
