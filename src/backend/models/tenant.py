"""SQLAlchemy 2.0 — Tenant model"""
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), comment="租户名称")
    code: Mapped[str] = mapped_column(String(50), unique=True, comment="租户编码")
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
