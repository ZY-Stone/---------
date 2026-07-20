from ..models.user import User
from ..models.role import Role, Permission
from ..models.department import Department
from ..models.group import Group
from ..utils.security import hash_password, verify_password, create_access_token
from sqlalchemy.orm import Session


def authenticate(db: Session, username: str, password: str):
    """登录认证，返回 token + 用户信息 或 None"""
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    token = create_access_token(user.id)
    user_dict = user.to_dict()
    # 附加权限列表
    if user.role and user.role.permissions:
        user_dict["permissions"] = [p.code for p in user.role.permissions]
    else:
        user_dict["permissions"] = []
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict,
    }


def change_password(db: Session, user: User, old_pwd: str, new_pwd: str) -> bool:
    if not verify_password(old_pwd, user.password_hash):
        return False
    user.password_hash = hash_password(new_pwd)
    db.commit()
    return True


def get_user_permissions(user: User) -> list:
    """获取用户的所有权限码"""
    if not user.role or not user.role.permissions:
        return []
    return [p.code for p in user.role.permissions]


def get_user_scope(user: User) -> str:
    """获取用户的数据范围"""
    if user.role:
        return user.role.scope
    return "self"
