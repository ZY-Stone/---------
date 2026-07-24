"""
backend/models/audit_log.py
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False, comment="操作类型")
    target = Column(String(200), comment="操作对象")
    detail = Column(String(500), comment="详情")
    ip = Column(String(50), default="127.0.0.1")
    created_at = Column(DateTime, server_default=func.now())
