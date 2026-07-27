"""审计日志 API"""
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from database import get_db
from models.audit_log import AuditLog
from models.user import User

router = APIRouter(prefix="/api/audit", tags=["审计日志"])


def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})


@router.get("/logs")
def list_audit_logs(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    u = _user(request)
    if not u or u.get("role") not in ("admin", "gm", "operation"):
        # 非管理员返回空列表
        return []

    q = db.query(AuditLog).filter(AuditLog.tenant_id == u.get("tenant_id", 1))
    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size).all()

    # 关联用户名
    user_ids = list(set(r.user_id for r in rows))
    users_map: dict[int, str] = {}
    if user_ids:
        user_rows = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u.username for u in user_rows}

    return [{
        "id": r.id,
        "time": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        "user": users_map.get(r.user_id, str(r.user_id)),
        "name": users_map.get(r.user_id, str(r.user_id)),
        "action": r.action,
        "target": r.target or "",
        "detail": r.detail or "",
        "ip": r.ip or "127.0.0.1",
    } for r in rows]
