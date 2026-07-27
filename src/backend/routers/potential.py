"""
backend/routers/potential.py — 潜力产品 API
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from services.data_service import (
    get_potential_summary, get_dept_ranking, get_team_matrix,
    get_potential_composition, get_potential_trend, get_potential_quadrant,
    get_potential_scorecard, get_potential_customer_link, get_potential_user_link
)

router = APIRouter(prefix="/api/potential", tags=["潜力产品"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/summary")
def summary(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """潜力产品总览 KPI，dept 为空则全量"""
    return get_potential_summary(db, _user(request), dept or None)


@router.get("/dept-ranking")
def dept_ranking(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """部门排名，dept 为空则全量"""
    return get_dept_ranking(db, _user(request), dept or None)


@router.get("/team-matrix")
def team_matrix(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """团队×产品矩阵，dept 为空则全量"""
    return get_team_matrix(db, _user(request), dept or None)


@router.get("/composition")
def composition(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """潜力产品销售额构成"""
    return get_potential_composition(db, _user(request), dept or None)


@router.get("/trend")
def trend(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """潜力产品近12月销售额趋势"""
    return get_potential_trend(db, _user(request), dept or None)


@router.get("/quadrant")
def quadrant(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """量价四象限"""
    return get_potential_quadrant(db, _user(request), dept or None)


@router.get("/scorecard")
def scorecard(request: Request, dept: str = "", dim: str = "dept", metric: str = "sales",
              db: Session = Depends(get_db)):
    """差距看板"""
    return get_potential_scorecard(db, _user(request), dept or None, dim, metric)


@router.get("/customer-link")
def customer_link(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """客户×产品关联"""
    return get_potential_customer_link(db, _user(request), dept or None)


@router.get("/user-link")
def user_link(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """用户×产品关联"""
    return get_potential_user_link(db, _user(request), dept or None)
