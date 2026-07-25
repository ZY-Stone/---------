"""SQLAlchemy 2.0 — Department model"""
from datetime import datetime
from sqlalchemy import Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    name: Mapped[str] = mapped_column(String(100), comment="部门名称")
    leader: Mapped[str | None] = mapped_column(String(50), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
