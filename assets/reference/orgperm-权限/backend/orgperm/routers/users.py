from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..dependencies import get_db, get_current_user, require_permission
from ..models.user import User
from ..models.role import Role
from ..schemas.user import UserCreate, UserUpdate
from ..utils.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(
    dept_id: Optional[int] = None,
    role_code: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(User)
    if dept_id is not None:
        q = q.filter(User.department_id == dept_id)
    if role_code:
        role = db.query(Role).filter(Role.code == role_code).first()
        if role:
            q = q.filter(User.role_id == role.id)
    users = q.all()
    return {"code": 0, "data": [u.to_dict() for u in users]}


@router.post("")
def create_user(body: UserCreate, db: Session = Depends(get_db), user=Depends(require_permission("user.create"))):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    role = db.query(Role).filter(Role.code == body.role_code).first()
    u = User(
        username=body.username,
        password_hash=hash_password(body.password),
        name=body.name,
        role_id=role.id if role else None,
        department_id=body.department_id,
        group_id=body.group_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"code": 0, "data": {"id": u.id, "username": u.username}}


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_permission("user.update")),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    for k, v in body.dict(exclude_unset=True).items():
        if k == "role_code":
            role = db.query(Role).filter(Role.code == v).first()
            setattr(u, "role_id", role.id if role else None)
        elif k == "password":
            if v:
                u.password_hash = hash_password(v)
        else:
            setattr(u, k, v)
    db.commit()
    return {"code": 0, "message": "更新成功"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("user.delete")),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.username == "admin":
        raise HTTPException(status_code=400, detail="不能删除内置管理员")
    db.delete(u)
    db.commit()
    return {"code": 0, "message": "删除成功"}
