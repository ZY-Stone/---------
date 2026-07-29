"""
backend/services/auth_service.py — 鉴权逻辑
"""
from sqlalchemy.orm import Session
from models.user import User
from models.department import Department
from models.group import Group
from models.permission import RolePermission
from utils.security import verify_password, hash_password, create_access_token


def authenticate(db: Session, username: str, password: str) -> dict | None:
    """验证用户并返回 token + user info"""
    user = db.query(User).filter(User.username == username, User.status == "active").first()
    if not user or not verify_password(password, user.password_hash):
        return None

    # 关联查询部门、组名称
    dept_name = None
    group_name = None
    if user.dept_id:
        dept = db.query(Department).filter(Department.id == user.dept_id).first()
        dept_name = dept.name if dept else None
    if user.group_id:
        grp = db.query(Group).filter(Group.id == user.group_id).first()
        group_name = grp.name if grp else None

    # 查询用户角色的 data_scope
    data_scope = "all"
    try:
        perm_row = db.query(RolePermission).filter(RolePermission.role == user.role).first()
        if perm_row:
            data_scope = perm_row.data_scope
    except Exception:
        pass

    token = create_access_token({
        "sub": user.username,
        "user_id": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role,
        "dept_id": user.dept_id,
        "group_id": user.group_id,
        "data_scope": data_scope,
    })

    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "dept_name": dept_name,
            "group_name": group_name,
            "dept_id": user.dept_id,
            "group_id": user.group_id,
            "tenant_id": user.tenant_id,
            "data_scope": data_scope,
            "must_change_pwd": bool(user.must_change_pwd),
        }
    }


def change_password(db: Session, user_id: int, old_pwd: str, new_pwd: str) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    if not verify_password(old_pwd, user.password_hash):
        return False
    user.password_hash = hash_password(new_pwd)
    user.must_change_pwd = False  # 密码已修改，取消强制标记
    db.commit()
    return True
