# FastAPI 项目骨架 — Python

> 可直接复制使用的 FastAPI 项目目录结构和启动模板。
> 来源：`src/backend/`

---

## 🗣 大白话

### 这是什么？

一个"快递盒子"。新项目不用从零搭框架，直接把这个目录结构和 main.py 复制过去，删掉不需要的部分，就能跑了。

包含：建表、JWT 中间件、路由注册、静态文件托管、启动自修复、种子数据初始化。

### 什么时候用？

- 新开一个 FastAPI 项目，不想从空白文件开始
- 想要一个经过验证的、能直接跑起来的后端骨架

---

## 目录结构

```
backend/
├── main.py              # 入口 + lifespan + 中间件 + 路由注册 + 静态文件托管
├── config.py            # SECRET_KEY / DATABASE_URL / CORS / BACKUP_DIR
├── database.py          # engine + SessionLocal + Base + init_db + 自动加列
├── seed.py              # 虚拟数据生成 + 权限配置初始化
├── requirements.txt
├── models/              # SQLAlchemy ORM 模型
│   ├── __init__.py
│   ├── tenant.py / user.py / department.py / group.py
│   ├── permission.py    # 角色权限 + 操作日志
│   ├── sales_data.py    # 销售数据（宽度/潜力/客户/用户）
│   └── ...
├── routers/             # API 路由（一个模块一个文件）
│   ├── auth.py          # 登录/修改密码
│   ├── admin.py         # 用户管理
│   ├── permission.py    # 角色权限管理
│   └── ...
├── services/            # 业务逻辑层
├── schemas/             # Pydantic 请求/响应
└── utils/               # scope.py(RBAC) + security.py(JWT)
```

## main.py 模板

```python
"""FastAPI 主入口"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import CORS_ORIGINS
from database import init_db
from seed import seed, seed_role_permissions
from utils.security import decode_access_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    seed_role_permissions()
    yield


class JWTAuthMiddleware(BaseHTTPMiddleware):
    SKIP = {"/api/auth/login", "/docs", "/openapi.json", "/", "/health", "/app"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP or request.url.path.startswith("/css/") or request.url.path.startswith("/js/"):
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = decode_access_token(auth[7:])
            if payload:
                request.state.user = {
                    "user_id": payload.get("user_id"),
                    "tenant_id": payload.get("tenant_id"),
                    "role": payload.get("role"),
                    "dept_id": payload.get("dept_id"),
                    "group_id": payload.get("group_id"),
                    "username": payload.get("sub"),
                    "data_scope": payload.get("data_scope", "all"),
                }
            else:
                request.state.user = {}
        else:
            request.state.user = {}
        return await call_next(request)


app = FastAPI(title="My API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(JWTAuthMiddleware)

# 路由注册（按需添加）
# from routers.auth import router as auth_router
# app.include_router(auth_router)

# 静态文件（可选）
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

@app.get("/")
@app.get("/app")
def serve_frontend():
    index = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(index) if os.path.isfile(index) else {"message": "前端未找到"}

@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8800, reload=False)
```

## requirements.txt

```
fastapi>=0.110
uvicorn[standard]
sqlalchemy>=2.0
pydantic>=2.0
python-jose[cryptography]
bcrypt>=4.0
python-multipart
openpyxl
pandas
```
