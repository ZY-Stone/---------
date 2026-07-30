# JWT 鉴权中间件 — FastAPI

> Starlette `BaseHTTPMiddleware`，从 `Authorization: Bearer <token>` 解析 JWT 并注入 `request.state.user`。
> 来源：`src/backend/main.py` JWTAuthMiddleware

---

## 🗣 大白话

### 这是什么？

一个"自动签到"程序。用户登录后拿到一串 token（就像一张门禁卡），之后每次请求 API 都带着它。这个中间件在所有接口执行之前自动读取 token，解析出"你是谁、什么角色、哪个部门"，存到 `request.state.user` 里。后面的接口代码直接 `request.state.user.role` 就能知道当前是谁在访问。

### 什么时候用？

- 系统需要登录才能用
- 不同人登录看到的内容不一样，需要知道当前是谁
- 不想在每个接口里写"取 token → 解析 → 查用户"的重复代码

### 流程

```
浏览器请求 → 中间件截获 → 读 header 里的 token → 
解析出 {user_id, role, dept, data_scope} → 
存入 request.state.user → 传给后面的接口代码直接用
```

---

## 代码

### 1. JWT 工具函数 (`utils/security.py`)

```python
"""utils/security.py — JWT + bcrypt"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import bcrypt

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
```

### 2. 中间件 (`main.py` 或独立文件)

```python
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from utils.security import decode_access_token


class JWTAuthMiddleware(BaseHTTPMiddleware):
    # 无需鉴权的路径
    SKIP_PATHS = {"/api/auth/login", "/docs", "/openapi.json", "/", "/health"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 白名单放行
        if path in self.SKIP_PATHS or path.startswith("/css/") or path.startswith("/js/"):
            return await call_next(request)

        # OPTIONS 预检放行
        if request.method == "OPTIONS":
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            payload = decode_access_token(token)
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
```

### 3. 注册 (`main.py`)

```python
app = FastAPI()
app.add_middleware(CORSMiddleware, ...)     # CORS 必须最先
app.add_middleware(JWTAuthMiddleware)        # JWT 第二
```

### 4. 生成 Token 时注入字段 (`services/auth_service.py`)

```python
token = create_access_token({
    "sub": user.username,
    "user_id": user.id,
    "tenant_id": user.tenant_id,
    "role": user.role,
    "dept_id": user.dept_id,
    "group_id": user.group_id,
    "data_scope": data_scope,       # 从 RolePermission 表查
})
```

## 关键设计

- **不拦截无 token 请求** — 中间件设置空 `{}` 而非 401，由路由层的 `require_perm` 负责拒绝
- **白名单路径** — 登录、文档、静态文件跳过鉴权
- **OPTIONS 放行** — CORS 预检请求不需要鉴权
- **中间件顺序** — CORS → JWT → 路由，顺序不能错
