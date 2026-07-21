"""
OrgPerm 后端集成示例

启动方式：
    cd orgperm
    pip install -r requirements.txt
    python example/app.py

访问：
    API 文档 → http://localhost:8000/docs
    前端 Demo → 打开 example/index.html
"""
import sys
import os

# 将 backend 目录加入路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from orgperm import create_orgperm_app
from orgperm.config import JWT_SECRET

# 创建 orgperm 子应用
orgperm_app = create_orgperm_app(auto_seed=True)

# 主应用
app = FastAPI(title="OrgPerm 集成示例", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载 orgperm 到 /api 路径
app.mount("/api", orgperm_app)

# 可选：挂载前端静态文件（方便直接用浏览器打开）
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir, html=True), name="static")


@app.get("/")
def root():
    return {
        "app": "OrgPerm 集成示例",
        "api_docs": "/docs",
        "api_base": "/api",
        "default_admin": "admin / admin123",
    }


if __name__ == "__main__":
    import uvicorn
    print(f"🔑 默认管理员账号: admin / admin123")
    print(f"📖 API 文档: http://localhost:8000/docs")
    print(f"🔐 JWT Secret: {JWT_SECRET[:20]}...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
