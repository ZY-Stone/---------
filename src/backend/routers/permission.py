"""
routers/permission.py — 角色权限管理 API
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models.permission import RolePermission
from utils.scope import scope_user_from_request, require_perm

router = APIRouter(prefix="/api/permission", tags=["权限管理"])

# 可编辑的权限字段
PERM_FIELDS = [
    "overview", "width", "potential",
    "users_mgmt", "roles_mgmt", "products_mgmt",
    "audit_log", "backup", "import_data", "export_data",
]


@router.get("/roles")
@require_perm("roles_mgmt")
def list_roles(request: Request, db: Session = Depends(get_db)):
    """列出所有角色权限配置"""
    u = scope_user_from_request(request)
    rows = db.query(RolePermission).filter(
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).all()
    return [{
        "id": r.id,
        "role": r.role,
        "role_name": r.role_name,
        "overview": r.overview,
        "width": r.width,
        "potential": r.potential,
        "users_mgmt": r.users_mgmt,
        "roles_mgmt": r.roles_mgmt,
        "products_mgmt": r.products_mgmt,
        "audit_log": r.audit_log,
        "backup": r.backup,
        "import_data": r.import_data,
        "export_data": r.export_data,
        "data_scope": r.data_scope,
    } for r in rows]


@router.put("/roles/{role}")
@require_perm("roles_mgmt")
def update_role(role: str, req: dict, request: Request, db: Session = Depends(get_db)):
    """更新单个角色权限"""
    u = scope_user_from_request(request)
    row = db.query(RolePermission).filter(
        RolePermission.role == role,
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"角色 {role} 不存在")

    for k in PERM_FIELDS:
        if k in req:
            setattr(row, k, bool(req[k]))
    if "data_scope" in req:
        setattr(row, "data_scope", req["data_scope"])

    db.commit()
    return {"ok": True, "message": "权限已更新"}


@router.put("/roles")
@require_perm("roles_mgmt")
def update_roles_batch(req_list: list[dict], request: Request, db: Session = Depends(get_db)):
    """批量更新角色权限 — 请求体: [{role: 'admin', overview: true, ...}, ...]"""
    u = scope_user_from_request(request)
    updated = 0
    for req in req_list:
        role = req.get("role", "")
        if not role:
            continue
        row = db.query(RolePermission).filter(
            RolePermission.role == role,
            RolePermission.tenant_id == u.get("tenant_id", 1)
        ).first()
        if not row:
            continue
        for k in PERM_FIELDS:
            if k in req:
                setattr(row, k, bool(req[k]))
        if "data_scope" in req:
            setattr(row, "data_scope", req["data_scope"])
        updated += 1

    db.commit()
    return {"ok": True, "message": f"已更新 {updated} 个角色", "count": updated}


@router.get("/matrix")
def get_matrix(request: Request, db: Session = Depends(get_db)):
    """角色权限矩阵（前端展示用）— 管理员和总经理可查看"""
    u = scope_user_from_request(request)
    if not u.get("role"):
        raise HTTPException(status_code=401, detail="请先登录")
    if u.get("role") not in ("admin", "gm"):
        raise HTTPException(status_code=403, detail="仅管理员/总经理可查看权限矩阵")

    rows = db.query(RolePermission).filter(
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).all()
    return [{
        "role": r.role,
        "role_name": r.role_name,
        "overview": r.overview,
        "width": r.width,
        "potential": r.potential,
        "users_mgmt": r.users_mgmt,
        "roles_mgmt": r.roles_mgmt,
        "products_mgmt": r.products_mgmt,
        "audit_log": r.audit_log,
        "backup": r.backup,
        "import_data": r.import_data,
        "export_data": r.export_data,
        "data_scope": r.data_scope,
    } for r in rows]


@router.get("/my-perms")
def get_my_perms(request: Request, db: Session = Depends(get_db)):
    """当前登录用户的权限（前端初始化用）"""
    u = scope_user_from_request(request)
    role = u.get("role", "")
    if not role:
        return {
            "role": "",
            "data_scope": "self",
            "perms": {},
        }

    row = db.query(RolePermission).filter(RolePermission.role == role).first()
    if not row:
        # 未配置的角色返回默认权限
        return {
            "role": role,
            "data_scope": "self",
            "perms": {
                "overview": True,
                "width": True,
                "potential": True,
                "users_mgmt": False,
                "roles_mgmt": False,
                "products_mgmt": False,
                "audit_log": False,
                "backup": False,
                "import_data": False,
                "export_data": False,
            }
        }

    return {
        "role": role,
        "data_scope": row.data_scope,
        "perms": {
            "overview": row.overview,
            "width": row.width,
            "potential": row.potential,
            "users_mgmt": row.users_mgmt,
            "roles_mgmt": row.roles_mgmt,
            "products_mgmt": row.products_mgmt,
            "audit_log": row.audit_log,
            "backup": row.backup,
            "import_data": row.import_data,
            "export_data": row.export_data,
        }
    }
