"""SQLAlchemy 2.0 — User model"""
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    username: Mapped[str] = mapped_column(String(50), unique=True, comment="登录账号")
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(50), comment="姓名")
    role: Mapped[str] = mapped_column(String(30), comment="admin/gm/operation/director/manager/sales")
    dept_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    group_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("groups.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    must_change_pwd: Mapped[bool] = mapped_column(Boolean, default=True, comment="首次登录必须修改密码")
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
