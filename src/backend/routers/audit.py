"""审计日志 API"""
from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from models.audit_log import AuditLog
from models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/audit", tags=["审计日志"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


# ── 写入审计日志（供其他模块调用的函数） ──
def write_audit_log(
    db: Session,
    tenant_id: int,
    user_id: int | None,
    action: str,
    target: str = "",
    detail: str = "",
    ip: str = "127.0.0.1",
) -> AuditLog:
    """统一写审计日志入口，其他 router 直接调用"""
    entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id or 0,
        action=action,
        target=target,
        detail=detail,
        ip=ip,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


class AuditLogCreate(BaseModel):
    action: str = Field(..., min_length=1, max_length=100, description="操作类型")
    target: str = Field("", max_length=200, description="操作对象")
    detail: str = Field("", max_length=500, description="详情")
    time: str = Field("", description="前端时间戳（YYYY-MM-DD HH:MM:SS），备用")


# GET /api/audit/logs — 查询审计日志
@router.get("/logs")
def list_audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    action: str = Query("", description="操作类型筛选"),
    keyword: str = Query("", description="搜索用户名/对象/详情"),
    db: Session = Depends(get_db),
):
    u = _user(request)
    role = u.get("role", "")
    if role and role not in ("admin", "gm", "operation"):
        return {"data": [], "total": 0, "page": page, "size": size}

    q = db.query(AuditLog).filter(AuditLog.tenant_id == u.get("tenant_id", 1))

    if action:
        q = q.filter(AuditLog.action == action)
    if keyword:
        q = q.filter(AuditLog.detail.ilike(f"%{keyword}%") | AuditLog.target.ilike(f"%{keyword}%"))

    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size).all()

    user_ids = list(set(r.user_id for r in rows if r.user_id > 0))
    users_map: dict[int, str] = {}
    if user_ids:
        user_rows = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {ur.id: ur.username for ur in user_rows}

    return {
        "data": [{
            "id": r.id,
            "time": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            "user": users_map.get(r.user_id, "-"),
            "name": users_map.get(r.user_id, "系统"),
            "action": r.action,
            "target": r.target or "",
            "detail": r.detail or "",
            "ip": r.ip or "127.0.0.1",
        } for r in rows],
        "total": total,
        "page": page,
        "size": size,
    }


# POST /api/audit/logs — 前端写入审计日志
@router.post("/logs")
def create_audit_log(
    body: AuditLogCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    u = _user(request)
    entry = write_audit_log(
        db=db,
        tenant_id=u.get("tenant_id", 1),
        user_id=u.get("user_id") or 0,
        action=body.action,
        target=body.target,
        detail=body.detail,
        ip=request.client.host if request.client else "127.0.0.1",
    )
    return {
        "ok": True,
        "id": entry.id,
        "time": entry.created_at.strftime("%Y-%m-%d %H:%M:%S") if entry.created_at else "",
    }


# GET /api/audit/actions — 操作类型列表（供筛选下拉）
@router.get("/actions")
def list_action_types(db: Session = Depends(get_db)):
    actions = db.query(AuditLog.action).distinct().order_by(AuditLog.action).all()
    return {"actions": [a[0] for a in actions]}
