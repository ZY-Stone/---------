"""SQLAlchemy 2.0 — ProductDict model"""
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class ProductDict(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    name: Mapped[str] = mapped_column(String(100), comment="产品名称")
    alias: Mapped[str | None] = mapped_column(String(100), default=None)
    category: Mapped[str | None] = mapped_column(String(50), default=None)
    is_potential: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
