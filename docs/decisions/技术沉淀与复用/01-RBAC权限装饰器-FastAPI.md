# RBAC 权限装饰器 — FastAPI

> 可直接复用的 `require_perm` 装饰器 + 数据隔离过滤函数。
> 来源：`src/backend/utils/scope.py`

---

## 🗣 大白话

### 这是什么？

一个"门卫"工具。在你的 API 接口上加一行 `@require_perm("xxx")`，它就能自动检查：当前登录的人有没有权限访问这个接口。

比如你有一个"用户管理"页面，只有管理员和主管能看。以前你要在每个接口里写一堆 `if role == 'admin' or role == 'manager'` 的判断，现在只需要一行代码。

### 同时解决两个问题

**问题1：谁能访问什么页面？**（权限控制）
- 管理员能看到所有页面 → `@require_perm("users_mgmt")` 只让有用户管理权限的人进
- 销售看不到"账号管理" → 装饰器自动拦截，返回 403

**问题2：能看到多少数据？**（数据隔离）
- 总监登录，只看自己部门的数据
- 销售登录，只看自己名下的客户 → `filter_by_scope()` 自动过滤查询结果

### 什么时候用？

- 你做了个后台管理系统，有管理员、普通用户等不同角色
- 不同角色登录后，看到的菜单不同，能看到的数据范围也不同
- 不想在每个接口里重复写权限判断代码

### 怎么用？（最简示例）

```python
# 一行代码保护接口
@router.get("/users")
@require_perm("users_mgmt")        # ← 就这一行，没权限的人访问自动返回 403
def list_users(...):
    ...

# 一行代码过滤数据
u = get_current_user(request)
query = filter_by_scope(query, MyTable, u)  # ← 自动加上 where dept = '用户部门'
```

---

## 前置条件

- FastAPI + SQLAlchemy 2.0
- JWT 中间件已将用户信息注入 `request.state.user`
- `request.state.user` 包含字段：`role`, `user_id`, `tenant_id`, `dept_id`, `group_id`, `username`, `data_scope`
- 数据库有 `role_permissions` 表（或等价权限表）

## 代码

```python
"""
utils/scope.py — RBAC 权限装饰器 + 数据范围过滤
"""
import asyncio
from functools import wraps
from fastapi import HTTPException, Request

# 权限字段清单（按项目调整）
PERM_FIELDS = [
    "overview", "width", "potential",
    "users_mgmt", "roles_mgmt", "products_mgmt",
    "audit_log", "backup", "import_data", "export_data",
]

# 缓存
_perm_cache: dict[str, dict[str, bool]] = {}


def invalidate_perm_cache():
    """角色权限变更后清除缓存"""
    _perm_cache.clear()


def scope_user_from_request(request: Request | None) -> dict:
    if request is None:
        return {}
    return getattr(request.state, "user", None) or {}


# ── 装饰器工厂 ──
def _make_perm_decorator(check_fn):
    """通用装饰器：check_fn(request) → raises on denial"""
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


def _extract_request(args, kwargs) -> Request | None:
    for key in ("request", "req"):
        if key in kwargs:
            return kwargs[key]
    for arg in args:
        if isinstance(arg, Request):
            return arg
    return None


def require_perm(perm: str):
    """检查当前用户是否有某个模块权限"""
    return _make_perm_decorator(lambda req: _check_perm(scope_user_from_request(req), perm))


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

    # 查数据库并缓存（替换为实际模型）
    try:
        from database import SessionLocal
        from models.permission import RolePermission
        db = SessionLocal()
        try:
            row = db.query(RolePermission).filter(RolePermission.role == role).first()
            if not row:
                raise HTTPException(status_code=403, detail=f"角色 {role} 权限未配置")
            _perm_cache[role] = {f: bool(getattr(row, f)) for f in PERM_FIELDS}
            if not _perm_cache[role].get(perm, False):
                raise HTTPException(status_code=403, detail=f"无权限 {perm}（角色 {role}）")
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"权限检查失败: {str(e)}")


# ── 数据范围过滤 ──
def filter_by_scope(query, model, user: dict,
                    dept_field: str = "dept3",
                    group_field: str = "dept5",
                    sales_field: str = "sales"):
    """根据 role + data_scope 对 SQLAlchemy Query 加过滤条件"""
    scope = user.get("data_scope", "")
    role = user.get("role", "")
    username = user.get("username", "")
    dept_id = user.get("dept_id")
    group_id = user.get("group_id")

    if scope == "all" or role in ("admin", "gm", "operation"):
        return query

    from sqlalchemy import and_
    dept_name = _resolve_name("department", dept_id)

    if scope == "dept" and dept_name:
        return query.filter(getattr(model, dept_field) == dept_name)

    if scope == "group" and dept_name:
        group_name = _resolve_name("group", group_id)
        if group_name:
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


# 部门/组名称缓存
_dept_cache: dict[int, str] = {}
_group_cache: dict[int, str] = {}


def _resolve_name(entity: str, entity_id) -> str:
    """entity: 'department' | 'group'"""
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
```

## 使用方式

```python
from utils.scope import require_perm, filter_by_scope, scope_user_from_request

# 1. 装饰器保护路由
@router.get("/users")
@require_perm("users_mgmt")
def list_users(request: Request, db: Session = Depends(get_db)):
    ...

# 2. 数据范围过滤
@router.get("/data")
def get_data(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    q = db.query(MyModel).filter(MyModel.tenant_id == u["tenant_id"])
    q = filter_by_scope(q, MyModel, u, dept_field="dept", group_field="group_name")
    return q.all()

# 3. 权限变更后清除缓存
from utils.scope import invalidate_perm_cache
invalidate_perm_cache()
```

## 适配要点

- `PERM_FIELDS` 按实际权限表字段修改
- `_resolve_name` 中的模型引用按项目路径修改
- `filter_by_scope` 的默认字段名（dept3/dept5/sales）按数据模型修改
- admin 硬编码在 `_check_perm` 中，如需改名请修改
