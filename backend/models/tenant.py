"""
backend/models/tenant.py
"""
from sqlalchemy import Column, Integer, String, DateTime, func
from database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="租户名称")
    code = Column(String(50), unique=True, nullable=False, comment="租户编码")
    status = Column(String(20), default="active", comment="active/disabled")
    created_at = Column(DateTime, server_default=func.now())
