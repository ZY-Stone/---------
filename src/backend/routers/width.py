"""
backend/routers/width.py — 产品宽度 API
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from services.data_service import (
    get_width_summary, get_heatmap_data, get_customer_list,
    get_width_distribution, get_team_avg,
    get_prod_top_coverage, get_width_distribution_drill,
    get_width_trend, get_width_low_analysis
)

router = APIRouter(prefix="/api/width", tags=["产品宽度"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/summary")
def summary(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """产品宽度总览 KPI，dept 为空则按角色权限"""
    return get_width_summary(db, _user(request), dept or None)


@router.get("/customers")
def customers(request: Request, limit: int = 20, db: Session = Depends(get_db)):
    return get_customer_list(db, _user(request), limit)


@router.get("/dist")
def width_dist(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """产品宽度分布（6 桶），dept 为空则按角色权限"""
    return get_width_distribution(db, _user(request), dept or None)


@router.get("/team-avg")
def team_avg(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """各组/部门平均产品宽度，dept 为空则按角色权限"""
    return get_team_avg(db, _user(request), dept or None)


@router.get("/heatmap")
def heatmap(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """产品覆盖率热力图，dept 为空则按角色权限"""
    return get_heatmap_data(db, _user(request), dept or None)


@router.get("/prod-top")
def prod_top(request: Request, dept: str = "", top: int = 15, db: Session = Depends(get_db)):
    """产品覆盖率 TOP N（与热力图同源）"""
    return get_prod_top_coverage(db, _user(request), dept or None, top)


@router.get("/dist/drill")
def dist_drill(request: Request, bucket: str = "7-10", dept: str = "", limit: int = 50,
               db: Session = Depends(get_db)):
    """宽度分布下钻明细"""
    return {"bucket": bucket, "rows": get_width_distribution_drill(db, _user(request), bucket, dept or None, limit)}


@router.get("/trend")
def width_trend(request: Request, dept: str = "", db: Session = Depends(get_db)):
    """产品宽度历史趋势（近12月）"""
    return get_width_trend(db, _user(request), dept or None)


@router.get("/low-width")
def low_width(request: Request, dept: str = "", rtype: str = "cust", threshold: int = 3,
              db: Session = Depends(get_db)):
    """低宽度客户/用户分析"""
    return get_width_low_analysis(db, _user(request), dept or None, rtype, threshold)
