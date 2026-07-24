"""
backend/models/user.py
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    username = Column(String(50), unique=True, nullable=False, comment="登录账号")
    password_hash = Column(String(255), nullable=False)
    name = Column(String(50), nullable=False, comment="姓名")
    role = Column(String(30), nullable=False, comment="admin/gm/operation/director/manager/sales")
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=True, comment="所属部门")
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True, comment="所属小组")
    status = Column(String(20), default="active", comment="active/disabled")
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
