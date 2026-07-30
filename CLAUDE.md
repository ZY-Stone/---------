# CLAUDE.md — AI 开发规范

你是一个全栈产品分析工具开发者。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vanilla JS SPA（index.html + app.js + ECharts + Chart.js） |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| 数据库 | SQLite（开发）→ PostgreSQL + ClickHouse（生产） |
| 迁移 | Alembic + 启动自修复（`_ensure_columns()`） |
| 分析 | SQL 预聚合 → Pandas 深度计算 |

## 项目结构（实际）

```
src/
├── frontend/              # Vanilla JS SPA（单页应用）
│   ├── index.html         # 主页面 + 4 个 page div
│   ├── js/
│   │   ├── app.js         # 主逻辑（SPA路由、筛选、图表、CRUD、角色权限）
│   │   ├── core/
│   │   │   ├── api.js     # 后端 API 封装（自动 token、fallback mock）
│   │   │   └── config.js  # 字段映射配置
│   │   ├── data/
│   │   │   └── models.js  # 组织架构、角色权限、业务参数
│   │   └── ui/
│   │       └── sidebar.js # 侧边栏导航
│   └── css/               # 样式文件
└── backend/               # FastAPI + SQLAlchemy + Pydantic v2
    ├── main.py            # FastAPI 入口 + JWT中间件 + 静态文件托管
    ├── config.py          # SECRET_KEY / DATABASE_URL / CORS
    ├── database.py        # SQLAlchemy engine + init_db + 自动加列
    ├── seed.py            # 虚拟数据生成 + seed_role_permissions()
    ├── models/            # ORM 模型（9个）
    ├── routers/           # API 路由（13个）
    ├── services/          # 业务逻辑（5个）
    ├── schemas/           # Pydantic 请求/响应
    └── utils/             # scope.py（RBAC）+ security.py（JWT）
```

## 规范

- 所有 Python 函数必须有类型注解
- 所有 API 接口必须有 Pydantic request/response schema
- SQL 只做预聚合，复杂计算交给 Pandas
- ECharts 图表统一用 option JSON 配置
- 数据库迁移用 Alembic + `_ensure_columns()` 自修复
- 前端禁止写死数据，后端不可用时 fallback 到 `App.MOCK_USERS` / `App.ROLE_PERMISSIONS`
- 导入 Excel 后先写 localStorage 再同步后端

## RBAC 权限系统

### 角色（7个）
`admin` | `gm` | `operation` | `director` | `manager` | `interface` | `sales`

### 模块权限（10个）
`overview` `width` `potential` `users_mgmt` `roles_mgmt` `products_mgmt` `audit_log` `backup` `import_data` `export_data`

### 数据范围（4级）
`all`（全部）→ `dept`（本部门）→ `group`（本小组）→ `self`（本人）

### 后端实现
- `utils/scope.py` — `require_perm(perm)` 装饰器 + `filter_by_scope(query, model, user)` + `_check_perm()` 缓存
- `routers/permission.py` — `GET/PUT /api/permission/roles` + `GET /api/permission/my-perms`
- JWT 中间件注入 `request.state.user`（含 `data_scope`）
- 每个受保护路由加 `@require_perm("xxx")`

### 前端实现
- `App.myPerms` / `App.myDataScope` — 从 `GET /api/permission/my-perms` 加载
- `App.hasPerm(perm)` — 优先后端数据，fallback `App.PERM_MATRIX`
- `App.bootstrapPermissions()` — 登录后异步加载权限 → 隐藏无权限菜单/按钮 → 锁定筛选下拉
- `populateDeptDropdown / populateGrpDropdown / populatePersonDropdown` — 内置角色锁定逻辑
- `App.guardRoute(pageId)` → `showPage()` 入口校验

## 路由清单

| 模块 | 前缀 | 文件 |
|------|------|------|
| 认证 | `/api/auth` | `routers/auth.py` |
| 管理 | `/api/admin` | `routers/admin.py` |
| 总览 | `/api/dashboard` | `routers/dashboard.py` |
| 产品宽度 | `/api/width` | `routers/width.py` |
| 潜力产品 | `/api/potential` | `routers/potential.py` |
| 潜力查询 | `/api/potential` | `routers/potential_query.py` |
| 分析 | `/api/analytics` | `routers/analytics.py` |
| 导入 | `/api/import` | `routers/potential_import.py` + `data_import.py` |
| 导出 | `/api/export` | `routers/export.py` |
| 备份 | `/api/backup` | `routers/backup.py` |
| 审计 | `/api/audit` | `routers/audit.py` |
| 产品字典 | `/api/products` | `routers/products.py` |
| 权限管理 | `/api/permission` | `routers/permission.py` |

## 数据库表（15个）

| 表 | 文件 | 用途 |
|----|------|------|
| `tenants` | `models/tenant.py` | 租户 |
| `departments` | `models/department.py` | 部门 |
| `groups` | `models/group.py` | 小组 |
| `users` | `models/user.py` | 用户（含 role/dept_id/group_id） |
| `products` | `models/product_dict.py` | 产品字典 |
| `role_permissions` | `models/permission.py` | 角色权限配置 |
| `operation_logs` | `models/permission.py` | 操作日志 |
| `width_records` | `models/sales_data.py` | 产品宽度（14字段） |
| `potential_cust` | `models/sales_data.py` | 潜力产品-客户（21字段） |
| `potential_user` | `models/sales_data.py` | 潜力产品-用户（23字段） |
| `sales_width` | `models/sales_data.py` | 旧版宽度（兼容） |
| `sales_potential` | `models/sales_data.py` | 旧版潜力（兼容） |
| `import_records` | `models/import_record.py` | 导入记录 |
| `periods` | `models/import_record.py` | 数据期间 |
| `audit_logs` | `models/audit_log.py` | 审计日志 |
