# 角色权限管理 API — FastAPI

> 角色权限 CRUD + 批量更新 + 当前用户权限查询。
> 来源：`src/backend/routers/permission.py`

---

## 🗣 大白话

### 这是什么？

一个"权限配置后台"。让管理员可以在网页上勾选：总经理能看哪些页面、总监能导出哪些数据、销售只能看自己等等。

本质就是一个表格（角色 × 权限模块），管理员勾选后点保存，配置存进数据库，然后上面的 [RBAC 权限装饰器](01-RBAC权限装饰器-FastAPI.md) 就会按这个配置来拦截请求。

### 什么时候用？

- 你需要一个"角色权限管理"页面，管理员可以随时调整每个角色的权限
- 不想每次改权限都改代码重启（配置存数据库，改了即时生效）
- 前端需要知道当前登录用户的权限（比如：要显示/隐藏哪些菜单按钮）

### 提供了哪些接口？

| 接口 | 作用 | 谁可以调 |
|------|------|----------|
| `GET /api/permission/my-perms` | 前端问：我登录了，我有哪些权限？ | 任何人 |
| `GET /api/permission/roles` | 前端列出权限表格 | 管理员 |
| `PUT /api/permission/roles` | 管理员修改后点保存 | 管理员 |

---

## 前置条件

- `models/permission.py` 中有 `RolePermission` 表（含 `role`, `overview`, `width`, `potential`, `users_mgmt`, `roles_mgmt`, `products_mgmt`, `audit_log`, `backup`, `import_data`, `export_data`, `data_scope` 字段）
- 已配置 `utils/scope.py`（提供 `require_perm`, `scope_user_from_request`, `invalidate_perm_cache`）

## 代码

```python
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


class RolePermUpdate(BaseModel):
    """角色权限更新（role 在批量时必填，单条时可选）"""
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
    return {f: getattr(r, f) for f in SERIALIZE_FIELDS}


def _apply_perm_fields(row: RolePermission, data: dict):
    """只更新实际传入的 key，不覆盖未传字段"""
    for k, v in data.items():
        if k in PERM_FIELDS:
            setattr(row, k, bool(v))
        elif k == "data_scope":
            setattr(row, "data_scope", v)


# ── 列表 ──
@router.get("/roles")
@require_perm("roles_mgmt")
def list_roles(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    rows = db.query(RolePermission).filter(
        RolePermission.tenant_id == u.get("tenant_id", 1)
    ).all()
    return [_serialize_role(r) for r in rows]


# ── 单条更新（URL 传 role）──
@router.put("/roles/{role}")
@require_perm("roles_mgmt")
def update_role(role: str, req: RolePermUpdate, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    row = db.query(RolePermission).filter(
        RolePermission.role == role, RolePermission.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"角色 {role} 不存在")
    data = req.model_dump(exclude={"role"}, exclude_none=True)
    _apply_perm_fields(row, data)
    db.commit()
    invalidate_perm_cache()
    return {"ok": True, "message": "权限已更新"}


# ── 批量更新（body 传数组，每个元素含 role）──
@router.put("/roles")
@require_perm("roles_mgmt")
def update_roles_batch(req_list: list[RolePermUpdate], request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    updated = 0
    for req in req_list:
        row = db.query(RolePermission).filter(
            RolePermission.role == req.role, RolePermission.tenant_id == u.get("tenant_id", 1)
        ).first()
        if not row:
            continue
        data = req.model_dump(exclude={"role"}, exclude_none=True)
        _apply_perm_fields(row, data)
        updated += 1
    db.commit()
    invalidate_perm_cache()
    return {"ok": True, "message": f"已更新 {updated} 个角色", "count": updated}


# ── 当前用户权限 ──
@router.get("/my-perms")
def get_my_perms(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    role = u.get("role", "")
    if not role:
        return {"role": "", "data_scope": "self", "perms": {}}

    row = db.query(RolePermission).filter(RolePermission.role == role).first()
    if not row:
        return {"role": role, "data_scope": "self",
                "perms": {f: f in ("overview", "width", "potential") for f in PERM_FIELDS}}

    d = _serialize_role(row)
    return {"role": role, "data_scope": d.pop("data_scope"), "perms": d}
```

## API 清单

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/permission/roles` | `roles_mgmt` | 列出所有角色权限 |
| PUT | `/api/permission/roles/{role}` | `roles_mgmt` | 更新单个角色 |
| PUT | `/api/permission/roles` | `roles_mgmt` | 批量更新 `[{role, ...}]` |
| GET | `/api/permission/my-perms` | 无 | 当前用户权限（前端初始化） |

## 关键设计

- `RolePermUpdate` 全部字段 `Optional` → 支持部分更新（只传要改的字段）
- `exclude_none=True` → Pydantic 自动去掉未传字段，防止误覆盖
- `_apply_perm_fields` → 单条和批量共用同一逻辑
- `invalidate_perm_cache()` → 保存后立即清除权限缓存，下次请求重新加载
