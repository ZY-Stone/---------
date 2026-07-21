"""
backend/routers/export.py — 数据导出 API
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from urllib.parse import quote
from database import get_db
from services.export_service import export_width_excel, export_potential_excel, export_audit_excel

router = APIRouter(prefix="/api/export", tags=["导出"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/width")
def export_width(request: Request, db: Session = Depends(get_db)):
    data = export_width_excel(db, _user(request))
    filename = quote("产品宽度数据.xlsx")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + filename}
    )


@router.get("/potential")
def export_potential(request: Request, db: Session = Depends(get_db)):
    data = export_potential_excel(db, _user(request))
    filename = quote("潜力产品数据.xlsx")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + filename}
    )


@router.get("/audit")
def export_audit(request: Request, db: Session = Depends(get_db)):
    u = _user(request)
    if u.get("role") not in ("admin", "gm", "operation"):
        return {"error": "无权限"}
    data = export_audit_excel(db, u)
    filename = quote("审计日志.xlsx")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + filename}
    )
