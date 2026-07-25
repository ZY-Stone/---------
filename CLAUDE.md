# CLAUDE.md — AI 开发规范

你是一个全栈产品分析工具开发者。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Tailwind CSS + ECharts |
| 状态管理 | Zustand |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| 数据库 | SQLite（开发）→ PostgreSQL + ClickHouse（生产） |
| 迁移 | Alembic |
| 分析 | SQL 预聚合 → Pandas 深度计算 |

## 规范

- 所有 Python 函数必须有类型注解
- 所有 API 接口必须有 Pydantic request/response schema
- 每个分析函数必须配 pytest 测试
- SQL 只做预聚合，复杂计算交给 Pandas
- ECharts 图表统一用 option JSON 配置，禁止 Chart.js
- 数据库迁移只用 Alembic，不手写 DDL
- 前端组件用 Tailwind CSS，不手写 CSS 文件
- 组件禁止写死模拟数据，必须从 Zustand Store 读取
- Store getter 依赖 filterStore → 筛选变化自动重算
- 导入 Excel 后直接写入 Store → 所有组件自动响应式更新

## 项目结构

```
src/
├── frontend/           # React 18 + TypeScript + Tailwind + ECharts
│   └── src/
│       ├── components/ # 可复用组件
│       ├── pages/      # 页面组件（Overview/Width/Potential/Admin）
│       ├── stores/     # Zustand (auth/filter/width/potential)
│       ├── types/      # TypeScript 类型定义
│       └── utils/      # Excel解析、字段映射
├── frontend-v1/        # 旧版 Vanilla JS（参考，不再维护）
└── backend/            # FastAPI + SQLAlchemy + Pydantic v2
    └── app/
        ├── api/        # 路由层
        ├── models/     # ORM 模型
        ├── schemas/    # Pydantic 请求/响应
        ├── services/   # 业务逻辑
        └── core/       # 配置/安全/依赖注入
```
