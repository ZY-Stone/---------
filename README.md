# 产品分析一体化平台

> 面向产品分析场景的一体化平台，整合产品宽度分析、潜力产品分析、数据导入与决策支持。

---

## 技术架构

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS + ECharts | ECharts 一个 option 对象搞定所有图表类型（折线、漏斗、热力图、双Y轴），AI 生成 JSON 配置比写 React 组件树可靠得多 |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic | 类型安全、自动 OpenAPI 文档、AI 对 Python 代码生成一致性最高 |
| 状态管理 | Zustand | 轻量、TS 友好、无 boilerplate |
| 数据库（开发） | SQLite | 零配置起步，单文件部署 |
| 数据库（生产） | PostgreSQL（OLTP）+ ClickHouse（OLAP） | PG 管业务数据，CK 管海量事件聚合查询 |
| 分析引擎 | SQL 预聚合 → Pandas 深度计算 | SQL 做 COUNT/DISTINCT/分组，Pandas 做留存矩阵、漏斗、趋势预测 |
| 构建工具 | Vite | 快速 HMR，TypeScript 原生支持 |

---

## 快速启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd 产品分析一体化平台

# 2. 后端
cd src/backend
pip install -r requirements.txt
alembic upgrade head
python main.py              # → http://localhost:8800

# 3. 前端
cd src/frontend
npm install
npm run dev                 # → http://localhost:5173
```

---

## 项目结构

```
产品分析一体化平台/
├── AGENTS.md                   # AI 开发助手指南
├── README.md                   # 项目说明（本文件）
├── docs/                       # 产品文档
│   ├── decisions/              # 关键决策记录（ADR）
│   │   └── 2026-07-25-技术架构选型.md
│   ├── prd/                    # 产品需求文档
│   └── requirements.md         # 需求总览
├── assets/                     # 静态资源
│   ├── design/                 # 设计效果图、UI 参考
│   ├── bug/                    # 测试报错截图
│   └── reference/              # 参考图、灵感收集
├── notes/                      # 学习笔记、踩坑记录
└── src/
    ├── frontend/               # React 18 + TypeScript + Tailwind + ECharts
    │   ├── src/
    │   │   ├── components/     # 可复用组件（FilterBar, KpiCard, ChartPanel...）
    │   │   ├── pages/          # 页面级组件
    │   │   │   ├── Overview/       # 数据总览
    │   │   │   ├── Width/          # 产品宽度分析
    │   │   │   ├── Potential/      # 潜力产品分析
    │   │   │   └── Admin/          # 账号管理
    │   │   ├── hooks/          # 自定义 Hooks（useFilter, useChart...）
    │   │   ├── stores/         # Zustand 状态管理
    │   │   ├── api/            # API 请求层（axios + React Query）
    │   │   ├── types/          # TypeScript 类型定义
    │   │   └── utils/          # 工具函数（Excel 解析、字段映射...）
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   └── tailwind.config.js
    └── backend/                # FastAPI + SQLAlchemy + Pydantic v2
        ├── app/
        │   ├── api/            # 路由层（auth, dashboard, width, potential, admin...）
        │   ├── models/         # SQLAlchemy ORM 模型
        │   ├── schemas/        # Pydantic 请求/响应模型
        │   ├── services/       # 业务逻辑层（聚合计算、导入解析、导出...）
        │   ├── core/           # 核心配置（config, security, deps...）
        │   └── utils/          # 工具函数
        ├── alembic/            # 数据库迁移
        ├── requirements.txt
        └── main.py             # FastAPI 入口
```

---

## 核心模块

| 模块 | 功能 | 前端路由 | 后端 API 前缀 |
|------|------|----------|---------------|
| 数据总览 | KPI 卡片 + 产品宽度/潜力产品趋势图 | `/overview` | `/api/dashboard` |
| 产品宽度分析 | 7 个维度：总览/产品/团队/客户/用户/分组对比/导入 | `/width` | `/api/width` |
| 潜力产品分析 | 8 个维度：总览/产品/团队/客户/用户/缺口/导入/AI | `/potential` | `/api/potential` |
| 账号管理 | 用户/角色/产品字典/审计日志/备份导出 | `/admin` | `/api/admin` |

## 数据库表设计

| 表 | 用途 | 存储引擎 |
|----|------|----------|
| `tenants` | 租户信息 | PG |
| `departments` | 部门组织 | PG |
| `groups` | 小组组织 | PG |
| `users` | 用户账号 | PG |
| `products` | 产品字典 | PG |
| `sales_width` | 产品宽度销售明细 | PG / CK |
| `sales_potential` | 潜力产品销售明细 | PG / CK |
| `import_records` | 导入记录 | PG |
| `audit_logs` | 审计日志 | PG |

## 数据流

```
Excel 上传 → 前端解析（xlsx）→ API 批量写入 → SQLite/PostgreSQL
    → 后端 services 层预聚合（SQL COUNT/DISTINCT/GROUP BY）
    → 前端 ECharts 渲染（option 对象）
    → 筛选器变化 → React Query 重新请求 → ECharts 增量更新
```

## 开发规范

详见 [AGENTS.md](./AGENTS.md)。核心原则：

- **代码隔离** — 前后端分离，`src/frontend/` 和 `src/backend/` 独立构建部署
- **文档先行** — 功能开发前先写 PRD / 迭代记录
- **类型安全** — 前后端均使用 TypeScript / Pydantic 强类型约束
- **笔记沉淀** — 踩坑必记录，一坑一文
