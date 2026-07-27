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
        ├── api/        # 路由层（routers/）
        ├── models/     # ORM 模型
        ├── schemas/    # Pydantic 请求/响应
        ├── services/   # 业务逻辑
        └── core/       # 配置/安全/依赖注入

## 7 轮结构化开发流程（通用方法论）

适用于前后端分离项目，从需求到联调的全流程。

### 第 1 轮：投喂材料 → 让 AI 理解全貌
- 提供 PRD 文档、数据库模型、前端页面截图/代码
- 提供导入模板 Excel、字段映射说明
- 明确技术栈和硬性约束
- **输出**: AI 确认理解，提出待澄清问题

### 第 2 轮：数据映射分析
- 让 AI 读取前端 Store/类型定义 + 后端模型/API
- 对比前端期望格式 vs 后端实际返回格式
- **输出**: 《前后端数据格式映射表》(字段映射、计算字段、联表需求、类型转换)
- **关键**: 只分析不写代码，确认后再动手

### 第 3 轮：开发基础 CRUD（逐个接口）
- 一次只写一个接口，写完验证通过再下一个
- 每个接口标注: 前端对应页面/组件、返回示例、N+1 检查
- 统一错误处理（404/400/500）+ Pydantic Schema 校验
- **关键**: 返回 JSON 结构必须与前端 mock data 格式兼容

### 第 4 轮：开发高级分析 API
- 趋势分析、聚合统计、联表查询
- 缺失数据补零、粒度聚合（日/周/月）
- **输出**: 返回 ECharts/Recharts 兼容的时间序列格式

### 第 5 轮：数据导入功能
- 支持 .xlsx/.csv multipart 上传
- Upsert 逻辑（存在更新、不存在插入）
- 数据校验（必填、类型、范围）+ 错误报告（哪行哪个字段出错）
- 批量写入 + 事务保护

### 第 6 轮：前端对接层改造
- 只修改 API 调用层（api/client.ts），不改组件/页面/图表
- 统一错误处理、loading 状态
- 保留 mock 开关（环境变量控制），后端不可用时自动回退
- Store 新增 `refreshFromAPI()` 方法，原有逻辑保持不变

### 第 7 轮：联调与验证
- 编写自动化验证脚本，覆盖:
  - 认证、数据查询一致性、趋势正确性、导入功能
  - 全部 API 端点、管理功能、备份
  - 性能（列表 <500ms、分析 <2s）
- **输出**: PASS/FAIL 统计 + 错误排查指南
- 脚本可反复运行，回归验证
```
