"""种子数据：默认角色、权限、管理员账号"""
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.role import Role, Permission
from ..models.department import Department
from ..models.group import Group
from ..utils.security import hash_password
from ..config import DEFAULT_ROLES, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS, VIEWER_PERMISSIONS


def seed_all(db: Session):
    """初始化所有种子数据（幂等）"""
    _seed_permissions(db)
    _seed_roles(db)
    _seed_admin(db)
    db.commit()


def _seed_permissions(db: Session):
    existing = {p.code for p in db.query(Permission).all()}
    for pdef in DEFAULT_PERMISSIONS:
        if pdef["code"] not in existing:
            db.add(Permission(**pdef))


def _seed_roles(db: Session):
    all_perms = {p.code: p for p in db.query(Permission).all()}
    for rdef in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.code == rdef["code"]).first()
        if existing:
            continue
        role = Role(
            code=rdef["code"],
            name=rdef["name"],
            scope=rdef["scope"],
            color=rdef["color"],
            is_system=rdef["is_system"],
            description=rdef.get("description", ""),
        )
        db.add(role)
        db.flush()  # 获取 role.id
        # 分配权限（通过 ORM relationship 设置）
        perm_codes = ADMIN_PERMISSIONS if rdef["code"] == "admin" else (
            VIEWER_PERMISSIONS if rdef["scope"] == "all" else ["org.view"]
        )
        perms_to_add = [all_perms[pc] for pc in perm_codes if pc in all_perms]
        role.permissions = perms_to_add
        db.flush()


def _seed_admin(db: Session):
    if db.query(User).filter(User.username == "admin").first():
        return
    admin_role = db.query(Role).filter(Role.code == "admin").first()
    admin = User(
        username="admin",
        password_hash=hash_password("admin123"),
        name="系统管理员",
        role_id=admin_role.id if admin_role else None,
    )
    db.add(admin)


def seed_demo_org(db: Session):
    """种子演示组织架构（部门+组），仅当组织表为空时执行"""
    if db.query(Department).count() > 0:
        return

    dept_data = [
        ("客户销售一部", "高巍"),
        ("客户销售二部", "吴正豪"),
        ("大客户销售部", "韩杰"),
        ("行业一部", "卫玉昌"),
        ("行业二部", "房伟建"),
    ]
    dept_map = {}
    for i, (name, leader) in enumerate(dept_data):
        d = Department(name=name, leader=leader, sort_order=i)
        db.add(d)
        db.flush()
        dept_map[name] = d.id

    group_data = [
        ("客户销售一组", "客户销售一部", "张栋柱"),
        ("客户销售二组", "客户销售一部", "陈刚sz"),
        ("客户销售三组", "客户销售一部", "高巍"),
        ("客户销售四组", "客户销售一部", "刘文宇5"),
        ("客户销售六组", "客户销售二部", "吴正豪"),
        ("客户销售七组", "客户销售二部", "朱迪7"),
        ("客户销售八组", "客户销售二部", "邓畅"),
        ("客户销售九组", "客户销售二部", "李拥政5"),
        ("工业企业一组", "行业一部", "潘仲楠"),
        ("工业企业二组", "行业一部", "卫玉昌"),
        ("智慧建筑组", "行业一部", "朱绪浩"),
        ("智慧商贸组", "行业一部", "李耀东"),
        ("公安交警行业组", "行业二部", "房伟建"),
        ("政府行业组", "行业二部", "廖贝贝"),
        ("文教卫组", "行业二部", "王茜"),
        ("交通行业组", "行业二部", "王魁8"),
        ("司法行业组", "行业二部", "刘冬6"),
    ]
    for i, (name, dept_name, leader) in enumerate(group_data):
        if dept_name in dept_map:
            g = Group(name=name, department_id=dept_map[dept_name], leader=leader, sort_order=i)
            db.add(g)

    db.commit()
