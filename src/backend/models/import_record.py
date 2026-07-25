"""SQLAlchemy 2.0 — ImportRecord + Period models"""
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class ImportRecord(Base):
    __tablename__ = "import_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    file_name: Mapped[str] = mapped_column(String(200))
    data_type: Mapped[str] = mapped_column(String(50), comment="width_user/width_cust/potential_user/potential_cust")
    data_source: Mapped[str | None] = mapped_column(String(50), default=None, comment="数据源名称")
    target_table: Mapped[str] = mapped_column(String(50), default="", comment="写入的目标表")
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="success")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Period(Base):
    __tablename__ = "periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    period: Mapped[str] = mapped_column(String(7), unique=True, comment="期间 如 2026-07")
    label: Mapped[str | None] = mapped_column(String(50), default=None, comment="显示名")
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
