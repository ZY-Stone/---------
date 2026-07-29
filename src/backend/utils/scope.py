"""
utils/scope.py — 数据范围过滤 + RBAC 权限装饰器
用于所有 API 路由的数据隔离和权限校验
"""
from functools import wraps
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session


# ── 从 Request 提取当前用户 ──
def scope_user_from_request(request: Request | None) -> dict:
    """从 request.state.user 拿当前用户（中间件已注入）"""
    if request is None:
        return {}
    return getattr(request.state, "user", None) or {}


def scope_data_scope(user: dict) -> str:
    """从 user 取数据范围"""
    # 优先从 user dict 中直接取
    scope = user.get("data_scope", "")
    if scope:
        return scope
    # 兜底：从 RolePermission 表读取
    role = user.get("role", "")
    if role in ("admin", "gm", "operation"):
        return "all"
    return "self"


# ── 核心：根据数据范围过滤 SQLAlchemy Query ──
def filter_by_scope(query, model, user: dict,
                    dept_field: str = "dept3",
                    group_field: str = "dept5",
                    sales_field: str = "sales"):
    """根据 role + data_scope 对 Query 加过滤条件"""
    scope = scope_data_scope(user)
    role = user.get("role", "")
    username = user.get("username", "")
    dept_id = user.get("dept_id")
    group_id = user.get("group_id")

    # admin / gm / operation 全量可见
    if scope == "all" or role in ("admin", "gm", "operation"):
        return query

    dept_name = _get_dept_name_from_user(user, dept_id)

    if scope == "dept" and dept_name:
        return query.filter(getattr(model, dept_field) == dept_name)

    if scope == "group" and dept_name:
        group_name = _get_group_name_from_user(user, group_id)
        if group_name:
            from sqlalchemy import and_
            return query.filter(
                and_(
                    getattr(model, dept_field) == dept_name,
                    getattr(model, group_field) == group_name,
                )
            )

    if scope == "self":
        return query.filter(getattr(model, sales_field) == username)

    # 兜底：无权限则返回空查询（本人）
    return query.filter(getattr(model, sales_field) == username)


# ── 部门/组名解析 ──
_dept_cache: dict[int, str] = {}
_group_cache: dict[int, str] = {}


def _get_dept_name_from_user(user: dict, dept_id) -> str:
    """从缓存或数据库查 dept_id → name"""
    if not dept_id:
        return ""
    if dept_id in _dept_cache:
        return _dept_cache[dept_id]
    try:
        from database import SessionLocal
        from models.department import Department
        db = SessionLocal()
        dept = db.query(Department).filter(Department.id == dept_id).first()
        db.close()
        name = dept.name if dept else ""
        _dept_cache[dept_id] = name
        return name
    except Exception:
        return ""


def _get_group_name_from_user(user: dict, group_id) -> str:
    """从缓存或数据库查 group_id → name"""
    if not group_id:
        return ""
    if group_id in _group_cache:
        return _group_cache[group_id]
    try:
        from database import SessionLocal
        from models.group import Group
        db = SessionLocal()
        grp = db.query(Group).filter(Group.id == group_id).first()
        db.close()
        name = grp.name if grp else ""
        _group_cache[group_id] = name
        return name
    except Exception:
        return ""


# ── RBAC 装饰器 ──
def require_perm(perm: str):
    """装饰器：检查当前用户是否有某个模块权限（从 RolePermission 表读取）"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 从参数中找 request
            request = _extract_request(args, kwargs)
            u = scope_user_from_request(request)
            _check_perm(u, perm)
            return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            request = _extract_request(args, kwargs)
            u = scope_user_from_request(request)
            _check_perm(u, perm)
            return func(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def _extract_request(args, kwargs) -> Request | None:
    """从函数参数中提取 Request 对象"""
    # 先检查 kwargs
    for key in ("request", "req"):
        if key in kwargs:
            return kwargs[key]
    # 再检查 args
    for arg in args:
        if isinstance(arg, Request):
            return arg
    return None


def _check_perm(u: dict, perm: str):
    """核心权限检查逻辑"""
    role = u.get("role", "")
    if not role:
        raise HTTPException(status_code=401, detail="请先登录")

    # admin 拥有全部权限
    if role == "admin":
        return

    try:
        from database import SessionLocal
        from models.permission import RolePermission
        db = SessionLocal()
        perm_row = db.query(RolePermission).filter(RolePermission.role == role).first()
        db.close()

        if not perm_row:
            raise HTTPException(status_code=403, detail=f"角色 {role} 权限未配置")

        allowed = getattr(perm_row, perm, False)
        if not allowed:
            raise HTTPException(status_code=403, detail=f"无权限 {perm}（角色 {role}）")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"权限检查失败: {str(e)}")


def require_data_scope_all():
    """装饰器：仅允许 data_scope=all 的角色访问"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            request = _extract_request(args, kwargs)
            u = scope_user_from_request(request)
            scope = scope_data_scope(u)
            if scope != "all":
                raise HTTPException(status_code=403, detail="仅 all 权限可访问")
            return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            request = _extract_request(args, kwargs)
            u = scope_user_from_request(request)
            scope = scope_data_scope(u)
            if scope != "all":
                raise HTTPException(status_code=403, detail="仅 all 权限可访问")
            return func(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
