"""
backend/routers/admin.py — 用户管理/部门/组 CRUD（含 RBAC 权限 + 数据隔离）
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.department import Department
from models.group import Group
from schemas.admin import UserCreate, UserUpdate, UserOut
from utils.security import hash_password
from utils.scope import scope_user_from_request, require_perm, filter_by_scope
from models.permission import RolePermission

router = APIRouter(prefix="/api/admin", tags=["管理"])


def _get_user_from_request(request: Request) -> dict:
    return getattr(request.state, "user", None) or {}


# ── 用户管理 ──
@router.get("/users")
@require_perm("users_mgmt")
def list_users(request: Request, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)
    tenant_id = u.get("tenant_id", 1)

    q = db.query(User).filter(User.tenant_id == tenant_id)

    # 数据范围：主管只看本组用户，总监/接口人只看本部门用户
    role = u.get("role", "")
    if role == "manager":
        q = q.filter(User.group_id == u.get("group_id"))
    elif role in ("director", "interface"):
        q = q.filter(User.dept_id == u.get("dept_id"))

    users = q.all()
    # 批量查询：避免 N+1
    role_perms = {rp.role: rp for rp in db.query(RolePermission).all()}
    dept_ids = {u.dept_id for u in users if u.dept_id}
    group_ids = {u.group_id for u in users if u.group_id}
    dept_map = {d.id: d.name for d in db.query(Department).filter(Department.id.in_(dept_ids)).all()} if dept_ids else {}
    group_map = {g.id: g.name for g in db.query(Group).filter(Group.id.in_(group_ids)).all()} if group_ids else {}

    result = []
    for user in users:
        rp = role_perms.get(user.role)
        data_scope = rp.data_scope if rp else "self"
        result.append({
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "dept_name": dept_map.get(user.dept_id, "-"),
            "dept_id": user.dept_id,
            "group_name": group_map.get(user.group_id, "-"),
            "group_id": user.group_id,
            "status": user.status,
            "data_scope": data_scope,
        })
    return result


@router.post("/users")
@require_perm("users_mgmt")
def create_user(req: UserCreate, request: Request, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)

    exists = db.query(User).filter(User.username == req.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="账号已存在")

    # 校验部门/组是否存在
    if req.dept_id:
        dept = db.query(Department).filter(Department.id == req.dept_id, Department.tenant_id == u["tenant_id"]).first()
        if not dept:
            raise HTTPException(status_code=400, detail="部门不存在")
    if req.group_id:
        grp = db.query(Group).filter(Group.id == req.group_id, Group.tenant_id == u["tenant_id"]).first()
        if not grp:
            raise HTTPException(status_code=400, detail="小组不存在")

    new_user = User(
        tenant_id=u["tenant_id"],
        username=req.username,
        password_hash=hash_password(req.password),
        name=req.name,
        role=req.role,
        dept_id=req.dept_id,
        group_id=req.group_id,
        status="active",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": new_user.id, "message": "创建成功"}


@router.put("/users/{user_id}")
@require_perm("users_mgmt")
def update_user(user_id: int, req: UserUpdate, request: Request, db: Session = Depends(get_db)):
    current = _get_user_from_request(request)
    tenant_id = current.get("tenant_id", 1)

    # 检查目标用户是否在自己数据范围内
    role = current.get("role", "")
    user_q = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id)
    if role == "manager":
        user_q = user_q.filter(User.group_id == current.get("group_id"))
    elif role in ("director", "interface"):
        user_q = user_q.filter(User.dept_id == current.get("dept_id"))

    user = user_q.first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在或不在您管辖范围内")

    if req.name is not None:
        user.name = req.name
    if req.role is not None:
        user.role = req.role
    if req.dept_id is not None:
        user.dept_id = req.dept_id
    if req.group_id is not None:
        user.group_id = req.group_id
    if req.status is not None:
        user.status = req.status
    db.commit()
    return {"message": "更新成功"}


@router.delete("/users/{user_id}")
@require_perm("users_mgmt")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    current = _get_user_from_request(request)
    tenant_id = current.get("tenant_id", 1)
    if user_id == current.get("user_id"):
        raise HTTPException(status_code=400, detail="不能删除自己")

    # 检查目标用户是否在自己数据范围内
    role = current.get("role", "")
    user_q = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id)
    if role == "manager":
        user_q = user_q.filter(User.group_id == current.get("group_id"))
    elif role in ("director", "interface"):
        user_q = user_q.filter(User.dept_id == current.get("dept_id"))

    user = user_q.first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在或不在您管辖范围内")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="不可删除管理员")

    db.delete(user)
    db.commit()
    return {"message": "删除成功"}


# ── 部门/组只读 ──
@router.get("/departments")
def list_depts(request: Request, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)
    if not u:
        raise HTTPException(status_code=401)
    depts = db.query(Department).filter(Department.tenant_id == u["tenant_id"]).order_by(Department.sort_order).all()
    return [{"id": d.id, "name": d.name, "leader": d.leader} for d in depts]


@router.get("/groups")
def list_groups(request: Request, dept_id: int = None, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)
    if not u:
        raise HTTPException(status_code=401)
    q = db.query(Group).filter(Group.tenant_id == u["tenant_id"])
    if dept_id:
        q = q.filter(Group.dept_id == dept_id)
    groups = q.order_by(Group.sort_order).all()
    return [{"id": g.id, "name": g.name, "dept_id": g.dept_id, "leader": g.leader} for g in groups]
