"""组织架构服务：部门/组管理 + 权限判断"""
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.group import Group


def can_manage_dept(user: User) -> bool:
    """检查用户是否可以管理部门"""
    if not user.role:
        return False
    if user.role.scope == "all":
        return True
    perms = {p.code for p in user.role.permissions} if user.role.permissions else set()
    return "dept.manage" in perms


def can_manage_group(user: User) -> bool:
    """检查用户是否可以管理组"""
    if not user.role:
        return False
    if user.role.scope == "all":
        return True
    perms = {p.code for p in user.role.permissions} if user.role.permissions else set()
    return "group.manage" in perms


def get_dept_groups(db: Session, dept_id: int) -> list:
    """获取部门下的所有组"""
    groups = db.query(Group).filter(Group.department_id == dept_id, Group.is_active == True).order_by(Group.sort_order).all()
    return [g.to_dict() for g in groups]


def get_visible_departments(db: Session, user: User) -> list:
    """根据用户 scope 返回可见部门列表"""
    from ..models.department import Department
    scope = user.role.scope if user.role else "self"
    if scope == "all":
        return [d.to_dict() for d in db.query(Department).filter(Department.is_active == True).all()]
    elif scope == "dept" or scope == "group":
        if user.department:
            return [user.department.to_dict()]
        return []
    return []


def get_visible_groups(db: Session, user: User) -> list:
    """根据用户 scope 返回可见组列表"""
    scope = user.role.scope if user.role else "self"
    if scope == "all":
        return [g.to_dict() for g in db.query(Group).filter(Group.is_active == True).all()]
    elif scope == "dept":
        if user.department_id:
            return [g.to_dict() for g in db.query(Group).filter(Group.department_id == user.department_id, Group.is_active == True).all()]
        return []
    elif scope == "group":
        if user.group:
            return [user.group.to_dict()]
        return []
    return []
