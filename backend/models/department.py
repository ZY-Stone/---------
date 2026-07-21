"""
backend/models/department.py
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    name = Column(String(100), nullable=False, comment="部门名称")
    leader = Column(String(50), comment="负责人")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
