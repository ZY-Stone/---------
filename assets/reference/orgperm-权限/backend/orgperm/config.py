"""可配置项 — 集成时按需覆盖"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 数据库
DATABASE_URL = os.environ.get("ORGPERM_DB_URL", f"sqlite:///{os.path.join(BASE_DIR, 'orgperm.db')}")

# JWT
JWT_SECRET = os.environ.get("ORGPERM_JWT_SECRET", "orgperm-default-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8

# 默认角色定义（可在 create_app() 时覆盖）
DEFAULT_ROLES = [
    {"code": "admin",     "name": "管理员", "scope": "all",   "color": "#2563eb", "is_system": True},
    {"code": "gm",        "name": "总经理", "scope": "all",   "color": "#1e40af", "is_system": True},
    {"code": "operation", "name": "运营",   "scope": "all",   "color": "#7c3aed", "is_system": True},
    {"code": "director",  "name": "总监",   "scope": "dept",  "color": "#0891b2", "is_system": True},
    {"code": "manager",   "name": "主管",   "scope": "group", "color": "#ea580c", "is_system": True},
    {"code": "person",    "name": "普通用户","scope": "self",  "color": "#64748b", "is_system": True},
]

# 默认权限定义
DEFAULT_PERMISSIONS = [
    {"code": "user.list",   "name": "查看用户列表"},
    {"code": "user.create", "name": "创建用户"},
    {"code": "user.update", "name": "编辑用户"},
    {"code": "user.delete", "name": "删除用户"},
    {"code": "role.manage", "name": "管理角色权限"},
    {"code": "dept.manage", "name": "管理部门"},
    {"code": "group.manage","name": "管理组"},
    {"code": "org.view",    "name": "查看组织结构"},
]

# 管理员默认拥有所有权限
ADMIN_PERMISSIONS = ["user.list", "user.create", "user.update", "user.delete",
                     "role.manage", "dept.manage", "group.manage", "org.view"]

# 全局查看角色（gm / operation）拥有查看权限
VIEWER_PERMISSIONS = ["user.list", "org.view"]
