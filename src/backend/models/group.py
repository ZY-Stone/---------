"""SQLAlchemy 2.0 — Group model"""
from datetime import datetime
from sqlalchemy import Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    name: Mapped[str] = mapped_column(String(100), comment="小组名称")
    dept_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"), comment="所属部门")
    leader: Mapped[str | None] = mapped_column(String(50), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    dept = relationship("Department", foreign_keys=[dept_id], lazy="joined")
