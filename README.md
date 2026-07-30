# 产品分析一体化平台

> 面向产品分析场景的一体化平台，整合产品宽度分析、潜力产品分析、数据导入与决策支持，含完整 RBAC 权限和数据隔离。

---

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | Vanilla JS SPA（index.html + app.js + ECharts） |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| 数据库 | SQLite（开发）→ PostgreSQL + ClickHouse（生产） |
| 分析引擎 | SQL 预聚合 → Pandas 深度计算 |

---

## 快速启动

```bash
# 后端
cd src/backend
pip install -r requirements.txt
python main.py              # → http://localhost:8800
                            # 前端通过 http://localhost:8800/app 访问
```

---

## 项目结构

```
src/
├── frontend/               # Vanilla JS SPA
│   ├── index.html          # 4 个页面：总览/宽度/潜力/管理
│   ├── js/
│   │   ├── app.js          # 主逻辑（SPA路由、筛选联动、图表渲染、用户CRUD、角色矩阵）
│   │   ├── core/api.js     # 后端 API 封装（自动 token + mock fallback）
│   │   ├── data/models.js  # 组织架构、角色权限矩阵、MOCK数据
│   │   └── ui/sidebar.js   # 侧边栏导航
│   └── css/                # 样式文件
└── backend/                # FastAPI
    ├── main.py             # 入口 + JWT 中间件 + 静态文件托管
    ├── config.py           # 密钥 / 数据库 / CORS
    ├── database.py         # SQLAlchemy engine + 自修复加列
    ├── seed.py             # 虚拟数据 + 角色权限初始化
    ├── models/             # 9 个 ORM 模型
    ├── routers/            # 13 个路由模块
    ├── services/           # 5 个业务服务
    ├── schemas/            # Pydantic 请求/响应
    └── utils/              # scope.py(RBAC) + security.py(JWT)
```

---

## 核心模块

| 模块 | 前端 Tab | 后端 API |
|------|----------|----------|
| 数据总览 | KPI卡片 + 趋势图 | `/api/dashboard` `/api/analytics` |
| 产品宽度分析 | 总览/产品/团队/客户/用户/对比/导入/AI | `/api/width` `/api/analytics/width/*` |
| 潜力产品分析 | 总览/产品/团队/客户/用户/缺口/导入/AI | `/api/potential` `/api/analytics/potential/*` |
| 账号管理 | 用户管理/角色权限/审计日志 | `/api/admin` `/api/permission` `/api/audit` |
| 数据备份 | 备份/恢复/下载 | `/api/backup` |
| 导入导出 | Excel 导入/导出 | `/api/import` `/api/export` |

---

## RBAC 权限系统

### 角色（7个）

`admin` → `gm` → `operation` → `director` → `manager` → `interface` → `sales`

### 模块权限（10个）

`overview` `width` `potential` `users_mgmt` `roles_mgmt` `products_mgmt` `audit_log` `backup` `import_data` `export_data`

### 数据范围（4级）

| 范围 | 谁可见 | 适用角色 |
|------|--------|----------|
| `all` | 全部数据 | admin / gm / operation |
| `dept` | 本部门 | director / interface |
| `group` | 本小组 | manager |
| `self` | 本人 | sales |

### 前端筛选自动锁定

`populateDeptDropdown` / `populateGrpDropdown` / `populatePersonDropdown` 内置角色判断：
- admin/gm/operation → 全部可选
- director/interface → 部门锁定，组内可选
- manager → 部门+小组锁定，组内人员可选
- sales → 全部锁定为本人

---

## 数据库表（15个）

| 表 | 用途 |
|----|------|
| `tenants` | 租户 |
| `departments` | 部门组织 |
| `groups` | 小组组织 |
| `users` | 用户（含 role / dept_id / group_id） |
| `products` | 产品字典 |
| `role_permissions` | 角色权限配置（7角色 × 10模块） |
| `operation_logs` | 操作日志 |
| `width_records` | 产品宽度（14字段） |
| `potential_cust` | 潜力产品-客户维度（21字段） |
| `potential_user` | 潜力产品-用户维度（23字段） |
| `sales_width` | 旧版宽度（兼容） |
| `sales_potential` | 旧版潜力（兼容） |
| `import_records` | 导入记录 |
| `periods` | 数据期间 |
| `audit_logs` | 审计日志 |

---

## 测试账号

| 账号 | 密码 | 角色 | 数据范围 |
|------|------|------|----------|
| `admin` | `123456` | 管理员 | 全部 |
| `guchengcheng` | `123456` | 总经理 | 全部 |
| `gaowei` | `123456` | 总监 | 客户销售一部 |
| `wuzhenghao` | `123456` | 总监 | 客户销售二部 |
| `zhangdongzhu` | `123456` | 主管 | 客户销售一组 |
| `wenghuanzhi` | `123456` | 接口人 | 客户销售一部 |
| `liyongzheng` | `123456` | 销售 | 本人 |
