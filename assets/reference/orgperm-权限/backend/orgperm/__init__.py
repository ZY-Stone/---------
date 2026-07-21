"""orgperm — 可复用的组织部门与权限管理模块

集成方式：
    from fastapi import FastAPI
    from orgperm import create_orgperm_app

    app = FastAPI()
    org_app = create_orgperm_app()
    app.mount("/api", org_app)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal, init_db


def create_orgperm_app(
    auto_seed: bool = True,
    cors_origins: list = None,
) -> FastAPI:
    """创建 orgperm FastAPI 应用实例

    Args:
        auto_seed: 是否自动初始化种子数据（角色、权限、管理员、演示组织架构）
        cors_origins: CORS 允许的来源列表，默认 ["*"]

    Returns:
        FastAPI 实例，已注册所有路由

    配置方式：通过环境变量覆盖默认值
        ORGPERM_DB_URL      — 数据库连接 URL（默认 sqlite:///./orgperm.db）
        ORGPERM_JWT_SECRET  — JWT 签名密钥
    """
    # 初始化数据库表
    init_db()

    app = FastAPI(title="OrgPerm — 组织与权限管理", version="1.0.0")

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    from .routers import auth, users, departments, groups, roles
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(departments.router)
    app.include_router(groups.router)
    app.include_router(roles.router)

    # 种子数据（在第一个请求时初始化）
    if auto_seed:
        @app.on_event("startup")
        def _seed():
            from .seed import seed_all, seed_demo_org
            db = SessionLocal()
            try:
                seed_all(db)
                seed_demo_org(db)
            finally:
                db.close()

    return app
