"""
backend/routers/width.py — 产品宽度 API
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from services.data_service import get_width_summary, get_heatmap_data, get_customer_list

router = APIRouter(prefix="/api/width", tags=["产品宽度"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/summary")
def summary(request: Request, db: Session = Depends(get_db)):
    return get_width_summary(db, _user(request))


@router.get("/heatmap")
def heatmap(request: Request, db: Session = Depends(get_db)):
    return get_heatmap_data(db, _user(request))


@router.get("/customers")
def customers(request: Request, limit: int = 20, db: Session = Depends(get_db)):
    return get_customer_list(db, _user(request), limit)
