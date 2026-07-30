# 种子数据幂等初始化 — SQLAlchemy

> 启动时自动检测并初始化配置数据，已存在则更新而非重复插入。
> 来源：`src/backend/seed.py` `seed_role_permissions()`

---

## 🗣 大白话

### 这是什么？

一个"配置刷子"。你的系统里有些配置数据（比如哪7种角色、每种角色有哪些权限），需要在数据库里存着。以前的做法是手动去数据库里 INSERT，但每次重装系统都要重来一遍。

这个函数在每次启动时自动检查：数据库里有没有这些配置？没有就创建，有就更新成最新的。这样你改了代码里的权限配置，重启就生效，不用手动改数据库。

### 什么时候用？

- 系统有一些"预设数据"需要在数据库里（角色列表、权限配置、字典表等）
- 这些数据可能会在后续版本中调整
- 不想每次部署都要手动跑 SQL

### 核心思路

```
启动 → 查数据库有没有这条记录 → 
  有 → 更新成最新值（防止旧配置残留）
  没有 → 创建新记录
```

---

## 代码

```python
"""seed.py — 幂等初始化"""

def seed_role_permissions():
    """每次启动都执行，确保配置数据正确且最新"""
    from database import SessionLocal
    from models.permission import RolePermission
    db = SessionLocal()

    configs = [
        ("admin",     "管理员",  True,  True,  True,  True,  True,  True,  True,  True,  True,  True,  "all"),
        ("gm",        "总经理",  True,  True,  True,  False, False, False, True,  False, True,  True,  "all"),
        ("operation", "运营",    True,  True,  True,  False, False, False, True,  True,  True,  True,  "all"),
        ("director",  "总监",    True,  True,  True,  False, False, False, False, False, True,  True,  "dept"),
        ("manager",   "主管",    True,  True,  True,  True,  False, False, False, False, True,  True,  "group"),
        ("interface", "接口人",  True,  True,  True,  False, False, False, False, False, False, False, "dept"),
        ("sales",     "一线销售",True,  True,  True,  False, False, False, False, False, False, False, "self"),
    ]

    for params in configs:
        (role, role_name, overview, width, potential, users_mgmt, roles_mgmt,
         products_mgmt, audit_log, backup, import_data, export_data, data_scope) = params

        existing = db.query(RolePermission).filter(RolePermission.role == role).first()
        if existing:
            # 更新已有记录（防止旧配置残留）
            existing.role_name = role_name
            existing.overview = overview
            existing.width = width
            existing.potential = potential
            existing.users_mgmt = users_mgmt
            existing.roles_mgmt = roles_mgmt
            existing.products_mgmt = products_mgmt
            existing.audit_log = audit_log
            existing.backup = backup
            existing.import_data = import_data
            existing.export_data = export_data
            existing.data_scope = data_scope
        else:
            db.add(RolePermission(
                tenant_id=1, role=role, role_name=role_name,
                overview=overview, width=width, potential=potential,
                users_mgmt=users_mgmt, roles_mgmt=roles_mgmt,
                products_mgmt=products_mgmt, audit_log=audit_log,
                backup=backup, import_data=import_data, export_data=export_data,
                data_scope=data_scope,
            ))

    db.commit()
    db.close()
    print("✓ 角色权限配置已初始化")
```

## 调用入口

```python
# main.py lifespan — 每次启动都执行
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()                   # 建表 + 自动加列
    seed()                      # 业务数据（仅空库时导入）
    seed_role_permissions()     # 配置数据（每次启动都更新）
    yield
```

## 设计要点

- **幂等** — 用 `first()` 查已有记录 → 更新 / 新增，多次运行不会重复
- **分离业务和配置** — 业务种子（部门、用户）只在空库时导入；配置种子（权限）每次启动都更新
- **配置即代码** — 权限矩阵定义在代码里，修改后重启即生效，不需要手动改数据库
