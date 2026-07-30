"""
utils/scope.py — 数据范围过滤 + RBAC 权限装饰器
用于所有 API 路由的数据隔离和权限校验
"""
import asyncio
from functools import wraps
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

# 权限缓存字段（与 RolePermission 模型对齐）
PERM_CACHE_FIELDS = [
    "overview", "width", "potential",
    "users_mgmt", "roles_mgmt", "products_mgmt",
    "audit_log", "backup", "import_data", "export_data",
]

# ── 缓存 ──
_dept_cache: dict[int, str] = {}
_group_cache: dict[int, str] = {}
_perm_cache: dict[str, dict[str, bool]] = {}  # role → {perm_field: bool}


def invalidate_perm_cache():
    """角色权限变更后清除缓存（由 permission.py 的更新接口调用）"""
    _perm_cache.clear()


# ── 从 Request 提取当前用户 ──
def scope_user_from_request(request: Request | None) -> dict:
    if request is None:
        return {}
    return getattr(request.state, "user", None) or {}


def scope_data_scope(user: dict) -> str:
    scope = user.get("data_scope", "")
    if scope:
        return scope
    role = user.get("role", "")
    if role in ("admin", "gm", "operation"):
        return "all"
    return "self"


# ── 核心：根据数据范围过滤 SQLAlchemy Query ──
def filter_by_scope(query, model, user: dict,
                    dept_field: str = "dept3",
                    group_field: str = "dept5",
                    sales_field: str = "sales"):
    if not user or not user.get("user_id"):
        return query
    scope = scope_data_scope(user)
    role = user.get("role", "")
    username = user.get("username", "")
    dept_id = user.get("dept_id")
    group_id = user.get("group_id")

    if scope == "all" or role in ("admin", "gm", "operation"):
        return query

    dept_name = _resolve_name("department", dept_id)

    if scope == "dept" and dept_name:
        return query.filter(getattr(model, dept_field) == dept_name)

    if scope == "group" and dept_name:
        group_name = _resolve_name("group", group_id)
        if group_name:
            from sqlalchemy import and_
            return query.filter(
                and_(
                    getattr(model, dept_field) == dept_name,
                    getattr(model, group_field) == group_name,
                )
            )
        return query.filter(getattr(model, dept_field) == dept_name)

    if scope == "self":
        return query.filter(getattr(model, sales_field) == username)

    return query.filter(getattr(model, sales_field) == username)


# ── 通用名称解析（部门 / 组） ──
def _resolve_name(entity: str, entity_id) -> str:
    """从缓存或数据库查 dept_id/group_id → name。entity: 'department' | 'group'"""
    if not entity_id:
        return ""
    cache = _dept_cache if entity == "department" else _group_cache
    if entity_id in cache:
        return cache[entity_id]
    try:
        from database import SessionLocal
        db = SessionLocal()
        try:
            if entity == "department":
                from models.department import Department
                row = db.query(Department).filter(Department.id == entity_id).first()
            else:
                from models.group import Group
                row = db.query(Group).filter(Group.id == entity_id).first()
            name = row.name if row else ""
            cache[entity_id] = name
            return name
        finally:
            db.close()
    except Exception:
        return ""


# ── RBAC 装饰器工厂 ──
def _make_perm_decorator(check_fn):
    """通用装饰器工厂：接收 check_fn(request) → raises on denial"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            request = _extract_request(args, kwargs)
            check_fn(request)
            return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            request = _extract_request(args, kwargs)
            check_fn(request)
            return func(*args, **kwargs)

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def require_perm(perm: str):
    """检查当前用户是否有某个模块权限"""
    return _make_perm_decorator(lambda req: _check_perm(scope_user_from_request(req), perm))


def require_data_scope_all():
    """仅允许 data_scope=all 的角色访问"""
    return _make_perm_decorator(lambda req: _check_data_scope_all(scope_user_from_request(req)))


def _extract_request(args, kwargs) -> Request | None:
    for key in ("request", "req"):
        if key in kwargs:
            return kwargs[key]
    for arg in args:
        if isinstance(arg, Request):
            return arg
    return None


def _check_data_scope_all(u: dict):
    scope = scope_data_scope(u)
    if scope != "all":
        raise HTTPException(status_code=403, detail="仅 all 权限可访问")


def _check_perm(u: dict, perm: str):
    role = u.get("role", "")
    if not role:
        raise HTTPException(status_code=401, detail="请先登录")
    if role == "admin":
        return

    # 查缓存
    cached = _perm_cache.get(role)
    if cached is not None:
        if not cached.get(perm, False):
            raise HTTPException(status_code=403, detail=f"无权限 {perm}（角色 {role}）")
        return

    # 查数据库并缓存
    try:
        from database import SessionLocal
        from models.permission import RolePermission
        db = SessionLocal()
        try:
            perm_row = db.query(RolePermission).filter(RolePermission.role == role).first()
            if not perm_row:
                raise HTTPException(status_code=403, detail=f"角色 {role} 权限未配置")
            _perm_cache[role] = {f: bool(getattr(perm_row, f)) for f in PERM_CACHE_FIELDS}
            if not _perm_cache[role].get(perm, False):
                raise HTTPException(status_code=403, detail=f"无权限 {perm}（角色 {role}）")
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"权限检查失败: {str(e)}")
