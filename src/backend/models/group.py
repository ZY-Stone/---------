"""
backend/models/group.py
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    name = Column(String(100), nullable=False, comment="小组名称")
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=False, comment="所属部门")
    leader = Column(String(50), comment="组长")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
