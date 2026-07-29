完整的 RBAC + 数据隔离 提示词
实现产品分析一体化平台 v1 的完整账号数据隔离 + 角色权限控制。

项目路径：C:\Users\zhangyan59\Desktop\产品分析一体化平台

═══════════════════════════════════════
一、权限模型（已存在，复用）
═══════════════════════════════════════

数据库表 role_permissions（src/backend/models/permission.py）
8 个角色 × 9 模块权限 + 1 数据范围：

角色        名称     overview width  potential users_mgmt roles_mgmt products_mgmt audit_log backup import export data_scope
admin       管理员   ✓        ✓     ✓        ✓          ✓           ✓            ✓          ✓      ✓      ✓      all
gm          总经理   ✓        ✓     ✓        ✗          ✗           ✗            ✓          ✗      ✓      ✓      all
operation   运营     ✓        ✓     ✓        ✗          ✗           ✗            ✓          ✓      ✓      ✓      all
director    总监     ✓        ✓     ✓        ✗          ✗           ✗            ✗          ✗      ✓      ✓      dept
manager     主管     ✓        ✓     ✓        ✗          ✗           ✗            ✗          ✗      ✓      ✓      group
interface   接口人   ✓        ✓     ✓        ✗          ✗           ✗            ✗          ✗      ✗      ✗      dept
sales       一线销售 ✓        ✓     ✓        ✗          ✗           ✗            ✗          ✗      ✗      ✗      self

数据范围 data_scope:
  all   → 全部数据
  dept  → 本部门
  group → 本小组
  self  → 本人

═══════════════════════════════════════
二、后端 SQL 注入 _scope() 工具函数
═══════════════════════════════════════

文件：src/backend/utils/scope.py（新建）

from sqlalchemy import and_
from models.user import User
from models.potential_cust import PotentialCust
from models.potential_user import PotentialUser
from models.width_record import WidthRecord


def scope_user_from_request(request) -> dict:
    """从 request.state.user 拿当前用户（中间件已注入）"""
    return getattr(request.state, "user", {}) or {}


def scope_data_scope(user: dict) -> str:
    """从 user 取数据范围；并支持从 RolePermission 表读取"""
    return user.get("data_scope", "all")


def filter_by_scope(query, model, user: dict, dept_field: str = "dept3", group_field: str = "dept5", sales_field: str = "sales"):
    """核心函数：根据数据范围过滤 SQLAlchemy Query"""
    scope = scope_data_scope(user)
    role = user.get("role", "")
    username = user.get("username", "")
    dept_id = user.get("dept_id")
    group_id = user.get("group_id")

    if scope == "all" or role in ("admin", "gm", "operation"):
        return query
    if scope == "dept" and dept_id:
        return query.filter(getattr(model, dept_field) == _get_dept_name(user, dept_id))
    if scope == "group" and dept_id and group_id:
        return query.filter(
            and_(
                getattr(model, dept_field) == _get_dept_name(user, dept_id),
                getattr(model, group_field) == _get_group_name(user, group_id)
            )
        )
    if scope == "self":
        return query.filter(getattr(model, sales_field) == username)
    # 兜底：本人
    return query.filter(getattr(model, sales_field) == username)


def _get_dept_name(user, dept_id):
    """从数据库查 dept_id → name"""
    from database import SessionLocal
    from models.department import Department
    db = SessionLocal()
    dept = db.query(Department).filter(Department.id == dept_id).first()
    db.close()
    return dept.name if dept else ""


def _get_group_name(user, group_id):
    from database import SessionLocal
    from models.group import Group
    db = SessionLocal()
    grp = db.query(Group).filter(Group.id == group_id).first()
    db.close()
    return grp.name if grp else ""


def require_perm(perm: str):
    """装饰器：检查当前用户是否有某个权限"""
    from functools import wraps
    from fastapi import HTTPException

    def decorator(func):
        @wraps(func)
        def wrapper(*args, request=None, **kwargs):
            u = scope_user_from_request(request)
            role = u.get("role", "")
            # 读 RolePermission 表
            from database import SessionLocal
            from models.permission import RolePermission
            db = SessionLocal()
            perm_row = db.query(RolePermission).filter(RolePermission.role == role).first()
            db.close()
            if not perm_row:
                raise HTTPException(status_code=403, detail=f"角色 {role} 权限未配置")
            allowed = getattr(perm_row, perm, False)
            if not allowed:
                raise HTTPException(status_code=403, detail=f"无权限 {perm}（角色 {role}）")
            return func(*args, request=request, **kwargs)
        return wrapper
    return decorator


def require_data_scope():
    """装饰器：仅允许 all 角色访问"""
    from functools import wraps
    from fastapi import HTTPException

    def decorator(func):
        @wraps(func)
        def wrapper(*args, request=None, **kwargs):
            u = scope_user_from_request(request)
            scope = scope_data_scope(u)
            if scope != "all":
                raise HTTPException(status_code=403, detail="仅 all 权限可访问")
            return func(*args, request=request, **kwargs)
        return wrapper
    return decorator

═══════════════════════════════════════
三、路由层改造（每个路由加 scope 过滤）
═══════════════════════════════════════

【A】src/backend/routers/admin.py 用户管理
所有端点加权限+数据范围校验：

  @router.get("/users")
  @require_perm("users_mgmt")
  def list_users(request: Request, db: Session = Depends(get_db)):
      u = scope_user_from_request(request)
      # 主管/接口人只能看到本组/本部门用户
      if u.get("role") == "manager":
          q = db.query(User).filter(User.tenant_id == u["tenant_id"], User.group_id == u["group_id"])
      elif u.get("role") in ("director", "interface"):
          q = db.query(User).filter(User.tenant_id == u["tenant_id"], User.dept_id == u["dept_id"])
      else:
          q = db.query(User).filter(User.tenant_id == u["tenant_id"])
      return [...]

  @router.post("/users")
  @require_perm("users_mgmt")
  def create_user(req: UserCreate, request: Request, db: Session = Depends(get_db)):
      # 主管/接口人没有创建用户的权限
      ...

  @router.put("/users/{user_id}")
  @require_perm("users_mgmt")
  def update_user(...):
      # 检查目标用户是否在自己数据范围内
      ...

  @router.delete("/users/{user_id}")
  @require_perm("users_mgmt")
  def delete_user(...):
      ...

【B】src/backend/routers/backup.py 数据备份
所有端点加权限+数据范围：

  from utils.scope import require_perm

  @router.post("/create")
  @require_perm("backup")
  def backup_create(...):
      ...

  @router.get("/list")
  @require_perm("backup")
  def backup_list(...):
      ...

【C】src/backend/routers/potential_import.py 导入接口
所有 GET 端点加 scope 过滤：

  @router.get("/potential-cust")
  def get_potential_cust(request: Request, db: Session = Depends(get_db)):
      u = scope_user_from_request(request)
      q = db.query(PotentialCust).filter(PotentialCust.tenant_id == u["tenant_id"])
      q = filter_by_scope(q, PotentialCust, u)
      return [...]

  @router.post("/potential-cust")
  @require_perm("import_data")
  def import_potential_cust(...):
      ...

【D】src/backend/routers/data_import.py 产品宽度导入
同上。所有 GET 端点加 scope 过滤；POST 端点加 @require_perm("import_data")。

【E】src/backend/services/data_service.py 所有查询函数
所有 get_* 函数都加 user_info 参数 + scope 过滤：

  def get_width(user_info, dept=None, group=None, person=None):
      q = db.query(WidthRecord).filter(WidthRecord.tenant_id == user_info["tenant_id"])
      q = filter_by_scope(q, WidthRecord, user_info)
      ...

  def get_potential(user_info, dept=None, group=None, person=None):
      q = db.query(PotentialCust)
      q = filter_by_scope(q, PotentialCust, user_info)
      ...

【F】src/backend/services/analytics_service.py
所有 get_*_ranking / get_*_heatmap / get_*_matrix 函数都加 user_info 参数 + scope 过滤。

【G】src/backend/services/backup_service.py
create_backup / list_backups / restore_backup 都加 user_info 参数 + 审计日志：
  - 触发 user_id = user["user_id"]
  - 写入 operation_logs 表

【H】src/backend/routers/audit.py 审计日志
  @router.get("/logs")
  @require_perm("audit_log")
  def get_logs(...):
      # 仅审计日志查看权限
      ...

═══════════════════════════════════════
四、新增角色权限管理 API（src/backend/routers/permission.py 新建）
═══════════════════════════════════════

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models.permission import RolePermission
from utils.scope import require_perm

router = APIRouter(prefix="/api/permission", tags=["权限"])


@router.get("/roles")
@require_perm("roles_mgmt")
def list_roles(request: Request, db: Session = Depends(get_db)):
    """列出所有角色权限配置"""
    u = getattr(request.state, "user", {})
    rows = db.query(RolePermission).filter(RolePermission.tenant_id == u["tenant_id"]).all()
    return [{
        "id": r.id, "role": r.role, "role_name": r.role_name,
        "overview": r.overview, "width": r.width, "potential": r.potential,
        "users_mgmt": r.users_mgmt, "roles_mgmt": r.roles_mgmt,
        "products_mgmt": r.products_mgmt, "audit_log": r.audit_log,
        "backup": r.backup, "import_data": r.import_data, "export_data": r.export_data,
        "data_scope": r.data_scope
    } for r in rows]


@router.put("/roles/{role}")
@require_perm("roles_mgmt")
def update_role(role: str, req: dict, request: Request, db: Session = Depends(get_db)):
    """更新角色权限"""
    u = getattr(request.state, "user", {})
    row = db.query(RolePermission).filter(
        RolePermission.role == role,
        RolePermission.tenant_id == u["tenant_id"]
    ).first()
    if not row:
        raise HTTPException(404, f"角色 {role} 不存在")
    for k in ["overview", "width", "potential", "users_mgmt", "roles_mgmt",
              "products_mgmt", "audit_log", "backup", "import_data", "export_data", "data_scope"]:
        if k in req:
            setattr(row, k, req[k])
    db.commit()
    return {"ok": True, "message": "权限已更新"}


@router.get("/matrix")
def get_matrix(request: Request, db: Session = Depends(get_db)):
    """角色权限矩阵（前端展示用）"""
    u = getattr(request.state, "user", {})
    if u.get("role") not in ("admin", "gm"):
        raise HTTPException(403, "仅管理员/总经理可查看权限矩阵")
    rows = db.query(RolePermission).filter(RolePermission.tenant_id == u["tenant_id"]).all()
    return [...]


@router.get("/my-perms")
def get_my_perms(request: Request, db: Session = Depends(get_db)):
    """当前登录用户的权限（前端初始化用）"""
    u = getattr(request.state, "user", {})
    role = u.get("role", "")
    row = db.query(RolePermission).filter(RolePermission.role == role).first()
    if not row:
        return {"role": role, "data_scope": "self", "perms": {}}
    return {
        "role": role,
        "data_scope": row.data_scope,
        "perms": {
            "overview": row.overview, "width": row.width, "potential": row.potential,
            "users_mgmt": row.users_mgmt, "roles_mgmt": row.roles_mgmt,
            "products_mgmt": row.products_mgmt, "audit_log": row.audit_log,
            "backup": row.backup, "import_data": row.import_data, "export_data": row.export_data
        }
    }

═══════════════════════════════════════
五、种子数据：初始化所有角色权限（src/backend/seed.py）
═══════════════════════════════════════

def seed_role_permissions():
    from models.permission import RolePermission
    from database import SessionLocal
    db = SessionLocal()
    configs = [
        ("admin", "管理员", True, True, True, True, True, True, True, True, True, True, "all"),
        ("gm", "总经理", True, True, True, False, False, False, True, False, True, True, "all"),
        ("operation", "运营", True, True, True, False, False, False, True, True, True, True, "all"),
        ("director", "总监", True, True, True, False, False, False, False, False, True, True, "dept"),
        ("manager", "主管", True, True, True, False, False, False, False, False, True, True, "group"),
        ("interface", "接口人", True, True, True, False, False, False, False, False, False, False, "dept"),
        ("sales", "一线销售", True, True, True, False, False, False, False, False, False, False, "self"),
    ]
    for role, role_name, overview, width, potential, users_mgmt, roles_mgmt, products_mgmt, audit_log, backup, import_data, export_data, data_scope in configs:
        existing = db.query(RolePermission).filter(RolePermission.role == role).first()
        if existing:
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
                data_scope=data_scope
            ))
    db.commit()
    db.close()
    print("✓ 角色权限配置已初始化")

调用：在 seed() 末尾追加 seed_role_permissions()

═══════════════════════════════════════
六、前端 — 权限工具函数（src/frontend/js/app.js 末尾）
═══════════════════════════════════════

【A】App.hasPerm(perm) — 查 RolePermission 表
  App.hasPerm = function(perm) {
    if (!App.loggedInUser) return false;
    return App.myPerms && App.myPerms[perm] === true;
  };

【B】App.getDataScope() — 取当前用户数据范围
  App.getDataScope = function() {
    if (!App.loggedInUser) return 'self';
    return App.myPerms && App.myPerms.data_scope || 'self';
  };

【C】App.bootstrapPermissions() — 登录后初始化
  App.bootstrapPermissions = function() {
    // 1. 拉取 /api/permission/my-perms，存到 App.myPerms
    fetch('/api/permission/my-perms', { headers: { 'Authorization': 'Bearer ' + (sessionStorage.getItem('pa_token') || '') }})
      .then(r => r.json())
      .then(d => { App.myPerms = d.perms; App.myDataScope = d.data_scope; })
      .then(function() {
        // 2. 隐藏无权限菜单
        var menuMap = {
          'users_mgmt': 'menu-users',
          'roles_mgmt': 'menu-roles',
          'audit_log': 'menu-audit',
          'backup': 'menu-backup',
          'products_mgmt': 'menu-products',
          'import_data': 'btn-import',
          'export_data': 'btn-export'
        };
        Object.keys(menuMap).forEach(function(k) {
          var el = document.getElementById(menuMap[k]);
          if (el && !App.hasPerm(k)) el.style.display = 'none';
        });

        // 3. 锁定顶部下拉（按数据范围）
        var role = App.loggedInUser.role;
        var user = App.loggedInUser;
        var teamSel = document.querySelector('#page-potential .filter-dept');
        var groupSel = document.querySelector('#page-potential .filter-group-sel');
        var personSel = document.querySelector('#page-potential .filter-person');
        if (role === 'manager') {
          if (teamSel) { teamSel.value = user.dept; teamSel.disabled = true; }
          if (groupSel) { groupSel.value = user.group; groupSel.disabled = true; }
        }
        if (role === 'director' || role === 'interface') {
          if (teamSel) { teamSel.value = user.dept; teamSel.disabled = true; }
        }
        if (role === 'sales') {
          if (teamSel) teamSel.disabled = true;
          if (groupSel) groupSel.disabled = true;
          if (personSel) personSel.value = user.username;
        }
      });
  };

【D】App.guardRoute(pageId) — 路由守卫
  App.guardRoute = function(pageId) {
    var required = {
      'page-users': 'users_mgmt',
      'page-roles': 'roles_mgmt',
      'page-audit': 'audit_log',
      'page-backup': 'backup',
      'page-products': 'products_mgmt'
    };
    var perm = required[pageId];
    if (perm && !App.hasPerm(perm)) {
      App.toast('🚫 无权访问：' + pageId);
      return false;
    }
    return true;
  };

  在所有 showPage() 入口加判断：
    if (App.guardRoute(pageId)) { ...show page... }

【E】前端 getFilteredPotData 加数据范围（CustRAW/UserRAW 二次过滤）
  src/frontend/js/app.js:9376-9390 处的 getFilteredPotData：

  App.getFilteredPotData = function(type) {
    var raw = (type === 'cust')
      ? (App.ImportPotential.CustRAW || []).slice()
      : (App.ImportPotential.UserRAW || []).slice();
    var user = App.loggedInUser;
    var scope = App.getDataScope();

    // 第 1 层：数据范围硬过滤
    if (scope === 'dept') {
      raw = raw.filter(function(r) { return r.dept3 === user.dept || r.dept4 === user.dept; });
    } else if (scope === 'group') {
      raw = raw.filter(function(r) { return r.dept3 === user.dept && r.dept5 === user.group; });
    } else if (scope === 'self') {
      raw = raw.filter(function(r) { return r.sales === user.username; });
    }

    // 原有月份 + 顶部筛选 + 搜索逻辑保留
    ...
    return raw;
  };

【F】登录成功后调用 bootstrapPermissions
  app.js:35 login 成功的 then 末尾加：
    App.bootstrapPermissions();

【G】所有删除/编辑按钮级守卫
  删除按钮示例：
    <button onclick="App.deleteUser({{id}})" 
            style="display:{{App.hasPerm('users_mgmt') ? '' : 'none'}}">
      删除
    </button>

═══════════════════════════════════════
七、用户管理 UI 改造（src/frontend/js/app.js:7102 开始）
═══════════════════════════════════════

根据截图 1 实现用户管理列表：
- 顶部筛选：用户名/账号 + 角色 + 状态
- 搜索 + 重置按钮
- 表格列：用户名 / 姓名 / 角色(彩色 chip) / 角色代码 / 部门 / 所属组 / 操作
- 操作列：角色编辑按钮 + 删除按钮（仅 users_mgmt 权限可见）
- "+ 新增用户" 按钮（仅 users_mgmt 权限可见）
- 所有数据来自后端 /api/admin/users，已按权限过滤

═══════════════════════════════════════
八、角色权限矩阵 UI 改造（src/frontend/js/app.js 找到角色权限渲染）
═══════════════════════════════════════

根据截图 2 实现权限矩阵：
- 顶部指令：勾选模块权限，修改后点击保存
- 表格列：角色 / 名称 / 数据总览 / 产品宽度 / 潜力产品 / 用户管理 / 角色权限 / 审计日志 / 数据备份 / 数据导出 / 数据导入 / 数据范围
- 每个单元格是 checkbox（蓝色打勾）
- 数据范围列：显示"全部数据/本部门/本小组/本人"（不可点击，仅展示）
- 顶部"保存"按钮：调用 PUT /api/permission/roles/{role}
- 底部说明：每个角色名下的"全选/导出"是可选提示文字

═══════════════════════════════════════
九、完整的测试用例（4 个账号 × 5 个验证维度）
═══════════════════════════════════════

1. 登录 admin（admin, admin123）
   ✓ 看到所有菜单（用户管理、角色权限、审计日志、数据备份等）
   ✓ 看到所有页面、所有数据
   ✓ 看到所有按钮（导入、导出、删除、新增用户、改权限）
   ✓ 顶部"部门/小组/个人"下拉可任意切换
   ✓ 右上角 role badge 显示"管理员"

2. 登录 liquanchang（director, 客户销售二部）
   ✓ 看不到"用户管理/角色权限/数据备份/审计日志"菜单
   ✓ 看到"产品宽度/潜力产品/数据总览"页面
   ✓ 看不到"用户管理 STG"按钮
   ✓ 顶部"部门"下拉锁死"客户销售二部"
   ✓ 顶部"小组"下拉可改（但只能改成客户销售二部下的组）
   ✓ 表格只能看到客户销售二部的数据（共 9 个客户）
   ✓ 切换到 director 看客户销售一部的数据 → 表格为空

3. 登录 gaowei（director, 客户销售一部）
   ✓ 顶部"部门"锁死"客户销售一部"
   ✓ 表格只能看到客户销售一部的 5 个客户
   ✓ 看不到 director 的客户销售一部客户（这块可能和上面有重叠，检查）

4. 登录 wenghuanzhi（interface, 客户销售一部）
   ✓ 顶部"部门"锁死"客户销售一部"
   ✓ 表格只看客户销售一部
   ✓ 没有"导入/导出"按钮
   ✓ 没有"用户管理"菜单

5. 登录 liyongzheng（sales, 客户销售二部）
   ✓ 顶部"部门/小组"全部 disabled
   ✓ 顶部"个人"锁死"liyongzheng"
   ✓ 表格只能看到自己接的 7 个客户
   ✓ 看不到其他销售的客户
   ✓ 直接 POST /api/admin/users → 403
   ✓ 直接 GET /api/admin/roles → 403

═══════════════════════════════════════
十、修改清单
═══════════════════════════════════════

【后端】
1. src/backend/utils/scope.py（新建）—— scope 工具函数
2. src/backend/main.py —— 修复 JWTAuthMiddleware（缺 token 返 401）
3. src/backend/routers/admin.py —— 加 @require_perm 和 scope 过滤
4. src/backend/routers/backup.py —— 加 @require_perm("backup")
5. src/backend/routers/potential_import.py —— 加 scope 过滤 + @require_perm("import_data")
6. src/backend/routers/data_import.py —— 同上
7. src/backend/routers/potential_query.py —— 加 scope 过滤
8. src/backend/routers/audit.py —— 加 @require_perm("audit_log")
9. src/backend/routers/permission.py（新建）—— 角色权限管理 API
10. src/backend/services/data_service.py —— 所有 get_* 加 user_info + scope
11. src/backend/services/analytics_service.py —— 同上
12. src/backend/services/backup_service.py —— 加审计日志写入
13. src/backend/seed.py —— seed_role_permissions() 初始化

【前端】
1. src/frontend/js/app.js —— App.hasPerm / App.bootstrapPermissions / App.guardRoute
2. src/frontend/js/app.js:9376 —— getFilteredPotData 加数据范围过滤
3. src/frontend/js/app.js:7102-7275 —— 用户管理 UI 改造（按截图 1）
4. src/frontend/js/app.js —— 角色权限矩阵 UI 改造（按截图 2）
5. src/frontend/js/app.js —— 所有删除/编辑按钮加 display 控制
6. src/frontend/js/app.js —— 登录成功后调用 bootstrapPermissions

═══════════════════
】
一句话总结
模块	改动
后端 scope	utils/scope.py + 每条 query 加 filter_by_scope()
后端 RBAC	@require_perm(perm) 装饰器 + @require_data_scope()
后端权限 API	/api/permission/{list,matrix,update,my-perms}
前端 RBAC	App.hasPerm() / bootstrapPermissions() / guardRoute()
前端数据范围	getFilteredPotData 加 4 档 scope 过滤
前端 UI	用户管理 + 角色权限矩阵按截图重做
测试	4 个账号 × 5 个验证维度