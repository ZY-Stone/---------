"""
backend/config.py — 全局配置
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 数据库
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'data.db')}"

# JWT
SECRET_KEY = "pa-platform-secret-key-2026!@#$%"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 小时

# CORS
CORS_ORIGINS = ["*"]

# 备份
BACKUP_DIR = os.path.join(BASE_DIR, "backups")

# 分页
PAGE_SIZE_DEFAULT = 50
