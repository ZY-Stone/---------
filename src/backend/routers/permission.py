"""
routers/permission.py — 角色权限管理 API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models.permission import RolePermission
from utils.scope import scope_user_from_request, require_perm, invalidate_perm_cache

router = APIRouter(prefix="/api/permission", tags=["权限管理"])

PERM_FIELDS = frozenset([
    "overview", "width", "potential",
    "users_mgmt", "roles_mgmt", "products_mgmt",
    "audit_log", "backup", "import_data", "export_data",
])

SERIALIZE_FIELDS = list(PERM_FIELDS) + ["data_scope"]
SERIALIZE_FIELDS = ["role", "role_name"] + SERIALIZE_FIELDS


class RolePermUpdate(BaseModel):
    """单个角色权限更新（role 在 batch 时必填，单条时可选）"""
    role: str = ""
    overview: Optional[bool] = None
    width: Optional[bool] = None
    potential: Optional[bool] = None
    users_mgmt: Optional[bool] = None
    roles_mgmt: Optional[bool] = None
    products_mgmt: Optional[bool] = None
    audit_log: Optional[bool] = None
    backup: Optional[bool] = None
    import_data: Optional[bool] = None
    export_data: Optional[bool] = None
    data_scope: Optional[str] = None


def _serialize_role(r: RolePermission) -> dict:
    """RolePermission ORM 对象 → 前端 JSON"""
    return {f: getattr(r, f) for f in SERIALIZE_FIELDS}


def _apply_perm_fields(row: RolePermission, data: dict):
    """将 data 中的权限字段写入 row，只更新实际传入的 key"""
    for k, v in data.items():
        if k in PERM_FIELDS:
            setattr(row, k, bool(v))
        elif k == "data_scope":
            setattr(row, "data_scope", v)


@router.get("/roles")
@require_perm("roles_mgmt")
def list_roles(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    rows = db.query(RolePermission).filter(
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).all()
    return [_serialize_role(r) for r in rows]


@router.put("/roles/{role}")
@require_perm("roles_mgmt")
def update_role(role: str, req: RolePermUpdate, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    row = db.query(RolePermission).filter(
        RolePermission.role == role,
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"角色 {role} 不存在")

    data = req.model_dump(exclude={"role"}, exclude_none=True)
    _apply_perm_fields(row, data)
    db.commit()
    invalidate_perm_cache()
    return {"ok": True, "message": "权限已更新"}


@router.put("/roles")
@require_perm("roles_mgmt")
def update_roles_batch(req_list: list[RolePermUpdate], request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    updated = 0
    for req in req_list:
        row = db.query(RolePermission).filter(
            RolePermission.role == req.role,
            RolePermission.tenant_id == u.get("tenant_id", 1)
        ).first()
        if not row:
            continue
        data = req.model_dump(exclude={"role"}, exclude_none=True)
        _apply_perm_fields(row, data)
        updated += 1

    db.commit()
    invalidate_perm_cache()
    return {"ok": True, "message": f"已更新 {updated} 个角色", "count": updated}


@router.get("/matrix")
def get_matrix(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    if not u.get("role"):
        raise HTTPException(status_code=401, detail="请先登录")
    if u.get("role") not in ("admin", "gm"):
        raise HTTPException(status_code=403, detail="仅管理员/总经理可查看权限矩阵")

    rows = db.query(RolePermission).filter(
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).all()
    return [_serialize_role(r) for r in rows]


@router.get("/my-perms")
def get_my_perms(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    role = u.get("role", "")
    if not role:
        return {"role": "", "data_scope": "self", "perms": {}}

    row = db.query(RolePermission).filter(RolePermission.role == role).first()
    if not row:
        return {
            "role": role, "data_scope": "self",
            "perms": {f: f in ("overview", "width", "potential") for f in PERM_FIELDS},
        }

    d = _serialize_role(row)
    return {
        "role": role,
        "data_scope": d.pop("data_scope"),
        "perms": d,
    }
