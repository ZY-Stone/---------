"""
backend/main.py — FastAPI 主入口
启动: cd backend && python main.py
文档: http://localhost:8800/docs
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from database import init_db
from utils.security import decode_access_token
from seed import seed
from config import CORS_ORIGINS

# 前端静态文件路径
SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FRONTEND_DIR = os.path.join(SRC_DIR, "frontend-v1")  # 旧版 Vanilla JS

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    yield


# ── JWT 鉴权中间件 ──
class JWTAuthMiddleware(BaseHTTPMiddleware):
    """从 Authorization Header 解析 JWT，注入 request.state.user"""
    async def dispatch(self, request: Request, call_next):
        # 跳过登录接口
        skip_paths = ("/api/auth/login", "/docs", "/openapi.json", "/", "/health", "/app")
        if request.url.path in skip_paths or request.url.path.startswith("/css/") or request.url.path.startswith("/js/"):
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
                }
            else:
                request.state.user = {}
        else:
            request.state.user = {}

        return await call_next(request)


# ── 创建应用 ──
app = FastAPI(
    title="产品分析一体化平台 API",
    version="2.0",
    description="销售分析一体化平台后端服务 — 数据总览 / 产品宽度 / 潜力产品 / 权限管理 / 备份导出",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 中间件
app.add_middleware(JWTAuthMiddleware)


# ── 健康检查 ──
@app.get("/health")
def health():
    return {"status": "ok", "service": "产品分析一体化平台 API v2.0"}


# ── 前端页面 ──
@app.get("/")
@app.get("/app")
def serve_frontend():
    """托管前端 SPA 页面"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "前端文件未找到，请检查 frontend/index.html", "service": "产品分析一体化平台 API v2.0"}


# ── 注册路由 ──
from routers.auth import router as auth_router
from routers.admin import router as admin_router
from routers.dashboard import router as dashboard_router
from routers.width import router as width_router
from routers.potential import router as potential_router
from routers.export import router as export_router
from routers.backup import router as backup_router
from routers.data_import import router as data_import_router
from routers.potential_import import router as potential_import_router
from routers.potential_query import router as potential_query_router

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(width_router)
app.include_router(potential_router)
app.include_router(export_router)
app.include_router(backup_router)
app.include_router(data_import_router)
app.include_router(potential_import_router)
app.include_router(potential_query_router)

# ── 静态文件托管（最后注册，确保 API 路由优先） ──
if os.path.isdir(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
    print(f"[init] 前端静态文件: {FRONTEND_DIR}")


# ── 直接运行入口 ──
if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("  产品分析一体化平台 API Server")
    print("  http://localhost:8800")
    print("  http://localhost:8800/docs")
    print("=" * 50)
    uvicorn.run("main:app", host="0.0.0.0", port=8800, reload=False)
