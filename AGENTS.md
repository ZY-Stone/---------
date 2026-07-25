# AGENTS.md — AI 开发助手指南

本文档为 AI 开发助手提供项目结构、技术架构与开发规范。

---

## 1. 技术架构

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS — 禁止手写 CSS 文件 |
| 图表 | ECharts — 统一用 option JSON 配置，禁止 Chart.js |
| 后端 | Python FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.0 (Mapped + mapped_column) |
| 迁移 | Alembic — 禁止手写 DDL |
| 数据库(dev) | SQLite |
| 数据库(prod) | PostgreSQL (OLTP) + ClickHouse (OLAP) |
| 分析 | SQL 预聚合 → Pandas 深度计算 |
| 构建 | Vite |

---

## 2. 项目结构

| 目录 | 用途 |
|------|------|
| `CLAUDE.md` | AI 开发规范（本文件） |
| `README.md` | 项目说明 |
| `前后端架构设计-V3.md` | 完整架构文档 |
| `docs/` | 产品文档（PRD、决策记录） |
| `assets/` | 静态资源（design/bug/reference） |
| `notes/` | 学习笔记、踩坑记录 |
| `src/frontend/` | React 前端代码 |
| `src/frontend-v1/` | 旧版 Vanilla JS（参考，不再维护） |
| `src/backend/` | FastAPI 后端代码 |

### 前端目录

```
src/frontend/src/
├── components/
│   ├── layout/TopBar.tsx
│   └── common/FilterBar.tsx, KpiCard.tsx
├── pages/
│   ├── Overview.tsx
│   ├── Width/index.tsx, WidthImport.tsx
│   ├── Potential/index.tsx, PotentialImport.tsx
│   └── Admin.tsx
├── stores/
│   ├── authStore.ts       # 认证 + 组织架构
│   ├── filterStore.ts     # 全局筛选联动（核心）
│   ├── widthStore.ts      # 产品宽度数据 + KPI
│   └── potentialStore.ts  # 潜力产品数据 + 聚合
├── types/common.ts
├── App.tsx
└── main.tsx
```

### 后端目录

```
src/backend/
├── main.py
├── config.py, database.py, seed.py
├── models/          # SQLAlchemy 2.0 ORM
├── schemas/         # Pydantic v2
├── services/        # 业务逻辑（聚合计算）
├── routers/         # API 路由
├── utils/security.py
└── alembic/         # 数据库迁移
```

---

## 3. 开发规范

### 所有 Python 函数必须有类型注解

```python
def compute_kpi(cust_data: list[dict]) -> dict[str, float]: ...
def apply_data_scope(query, user) -> Query: ...
```

### 所有 API 接口必须有 Pydantic schema

```python
class LoginRequest(BaseModel):
    model_config = {"extra": "forbid"}
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)
```

### 数据库迁移只用 Alembic

```bash
alembic revision --autogenerate -m "add column"
alembic upgrade head
```

### 前端核心规则

- 组件禁止写死模拟数据，必须从 Zustand Store 读取
- Store getter 依赖 filterStore → 筛选变化自动重算
- ECharts 统一用 option JSON 配置
- Tailwind CSS 写样式，不手写 CSS 文件
- 导入 Excel → 直接写 Store → 自动响应式刷新

### 数据流

```
Excel 上传 → xlsx 解析 → POST /api/import → 写入 DB + Store
筛选变化 → filterStore.setDept() → 级联重置 → getter 重算 → 组件刷新
```

---

## 4. 给 AI 助手的提示

- 写前端代码前，先查 `src/frontend/src/types/common.ts`
- 写后端接口前，先查对应的 Pydantic schema
- 新增图表用 ECharts，不要引入其他图表库
- 修改数据模型必须同步 Alembic 迁移
- 数据计算放后端 services 层，前端只做展示
- 本文件不可删除或修改结构
