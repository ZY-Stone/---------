"""
backend/routers/admin.py — 用户管理/部门/组 CRUD
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.department import Department
from models.group import Group
from schemas.admin import UserCreate, UserUpdate, UserOut
from utils.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["管理"])


def _get_user_from_request(request: Request) -> dict | None:
    return getattr(request.state, "user", None)


# ── 用户管理 ──
@router.get("/users")
def list_users(request: Request, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)
    if not u or u.get("role") not in ("admin", "gm", "operation"):
        raise HTTPException(status_code=403, detail="无权限")

    users = db.query(User).filter(User.tenant_id == u["tenant_id"]).all()
    result = []
    for user in users:
        dept = db.query(Department).filter(Department.id == user.dept_id).first() if user.dept_id else None
        grp = db.query(Group).filter(Group.id == user.group_id).first() if user.group_id else None
        result.append({
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "dept_name": dept.name if dept else "-",
            "group_name": grp.name if grp else "-",
            "status": user.status,
        })
    return result


@router.post("/users")
def create_user(req: UserCreate, request: Request, db: Session = Depends(get_db)):
    u = _get_user_from_request(request)
    if not u or u.get("role") not in ("admin", "gm"):
        raise HTTPException(status_code=403, detail="无权限")

    exists = db.query(User).filter(User.username == req.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="账号已存在")

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
def update_user(user_id: int, req: UserUpdate, request: Request, db: Session = Depends(get_db)):
    current = _get_user_from_request(request)
    if not current or current.get("role") not in ("admin", "gm"):
        raise HTTPException(status_code=403, detail="无权限")

    user = db.query(User).filter(User.id == user_id, User.tenant_id == current["tenant_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

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
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    current = _get_user_from_request(request)
    if not current or current.get("role") not in ("admin", "gm"):
        raise HTTPException(status_code=403, detail="无权限")
    if user_id == current.get("user_id"):
        raise HTTPException(status_code=400, detail="不能删除自己")

    user = db.query(User).filter(User.id == user_id, User.tenant_id == current["tenant_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
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
