"""Application configuration"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'data.db'}"
SECRET_KEY = "pa-platform-secret-key-2026!@#$%"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
CORS_ORIGINS = ["*"]
BACKUP_DIR = str(BASE_DIR / "backups")
PAGE_SIZE_DEFAULT = 50
