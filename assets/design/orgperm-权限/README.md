# OrgPerm — 组织与权限管理模块

从"商机预测管理平台"中提取的独立、可复用的组织架构和权限管理模块。

## ✨ 功能

- 🔐 **用户认证** — 登录/登出、JWT Token、修改密码
- 👥 **用户管理** — 用户 CRUD、角色分配、部门/组关联
- 🏢 **组织架构** — 部门 + 组 二级结构，CRUD 管理
- 🔑 **角色管理** — 自定义角色、权限分配、数据范围控制
- 🛡️ **数据权限隔离** — all / dept / group / self 四级数据可见范围
- 🎨 **纯原生 JS** — 无框架依赖，可直接放入任何 HTML 页面
- 🔄 **双模式运行** — API 模式（对接后端） + Mock 模式（独立 Demo）

## 📦 目录结构

```
orgperm/
├── backend/orgperm/        # Python FastAPI 后端包
│   ├── config.py           # 配置项（JWT、DB、角色定义）
│   ├── database.py         # SQLAlchemy 数据库
│   ├── dependencies.py     # 认证依赖（JWT、角色、权限）
│   ├── models/             # 数据模型
│   ├── schemas/            # Pydantic Schema
│   ├── routers/            # API 路由
│   ├── services/           # 业务逻辑
│   ├── utils/security.py   # 密码哈希、JWT 生成
│   └── seed.py             # 种子数据
├── frontend/
│   ├── css/orgperm.css     # 样式表
│   └── js/                 # JS 模块
│       ├── orgperm-core.js    # 初始化、事件总线
│       ├── orgperm-api.js     # HTTP 客户端 + Mock 存储
│       ├── orgperm-auth.js    # 登录/登出/用户头像
│       ├── orgperm-users.js   # 用户管理 CRUD
│       ├── orgperm-orgs.js    # 部门/组管理
│       ├── orgperm-roles.js   # 角色/权限管理
│       └── orgperm-filter.js  # 数据权限过滤
├── orgperm.js              # 入口加载器
├── example/
│   ├── index.html          # 独立前端 Demo
│   └── app.py              # FastAPI 集成示例
└── README.md
```

## 🚀 快速开始

### 前端 Demo（无需后端）

直接用浏览器打开 `example/index.html`，默认 Mock 模式运行。

管理员账号：`admin` / `admin123`

### 后端 + 前端

```bash
# 1. 安装依赖
cd orgperm
pip install fastapi uvicorn sqlalchemy bcrypt pyjwt

# 2. 启动后端
python example/app.py

# 3. 打开前端
# 浏览器打开 example/index.html
# 或访问 http://localhost:8000/docs 查看 API 文档
```

## 📖 使用方法

### 前端集成

```html
<!-- 1. 引入 CSS -->
<link rel="stylesheet" href="orgperm/frontend/css/orgperm.css">

<!-- 2. 引入 JS（按顺序） -->
<script src="orgperm/frontend/js/orgperm-core.js"></script>
<script src="orgperm/frontend/js/orgperm-api.js"></script>
<script src="orgperm/frontend/js/orgperm-auth.js"></script>
<script src="orgperm/frontend/js/orgperm-filter.js"></script>
<script src="orgperm/frontend/js/orgperm-users.js"></script>
<script src="orgperm/frontend/js/orgperm-orgs.js"></script>
<script src="orgperm/frontend/js/orgperm-roles.js"></script>

<!-- 3. 初始化 -->
<script>
OrgPerm.init({
  apiBase: '/api',
  useApi: false,                    // true = 对接后端，false = Mock 模式
  appTitle: '我的应用',
  onLogin: function(user) {
    console.log('用户登录:', user);
  },
  onLogout: function() {
    console.log('用户登出');
  }
});

// 渲染 UI
OrgPerm.renderLoginOverlay();
OrgPerm.renderUserHeader(document.getElementById('header-right'));
</script>
```

### 后端集成

```python
from fastapi import FastAPI
from orgperm import create_orgperm_app

app = FastAPI()

# 方式1：挂载为子应用
org_app = create_orgperm_app(auto_seed=True)
app.mount("/api", org_app)

# 方式2：手动注册路由
from orgperm.routers import auth, users, departments, groups, roles
app.include_router(auth.router, prefix="/api")
# ...
```

### 配置

通过环境变量覆盖默认配置：

```bash
export ORGPERM_DB_URL=sqlite:///myapp.db    # 数据库路径
export ORGPERM_JWT_SECRET=my-secret-key      # JWT 签名密钥
```

或修改 `backend/orgperm/config.py`。

## 🔌 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/change-password` | 修改密码 |
| GET | `/api/auth/me` | 当前用户信息 + 权限 |
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 创建用户 |
| PUT | `/api/users/{id}` | 更新用户 |
| DELETE | `/api/users/{id}` | 删除用户 |
| GET | `/api/departments` | 部门列表 |
| POST | `/api/departments` | 创建部门 |
| PUT | `/api/departments/{id}` | 更新部门 |
| DELETE | `/api/departments/{id}` | 删除部门 |
| GET | `/api/groups` | 组列表 |
| POST | `/api/groups` | 创建组 |
| PUT | `/api/groups/{id}` | 更新组 |
| DELETE | `/api/groups/{id}` | 删除组 |
| GET | `/api/roles` | 角色列表 |
| POST | `/api/roles` | 创建角色 |
| PUT | `/api/roles/{id}` | 更新角色 |
| DELETE | `/api/roles/{id}` | 删除角色 |
| GET | `/api/roles/permissions/list` | 权限码列表 |
| GET | `/api/roles/{id}/permissions` | 获取角色权限 |
| PUT | `/api/roles/{id}/permissions` | 设置角色权限 |

## 🎯 数据权限模型

角色通过 `scope` 字段控制数据可见范围：

| Scope | 描述 | 可见数据 |
|-------|------|---------|
| `all` | 全局 | 所有部门、所有组、所有人员 |
| `dept` | 部门级 | 仅本部门及下属组 |
| `group` | 组级 | 仅本组 |
| `self` | 个人 | 仅自己 |

## 📝 License

MIT
