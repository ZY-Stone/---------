"""
backend/models/product_dict.py
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func
from database import Base


class ProductDict(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    name = Column(String(100), nullable=False, comment="产品名称")
    alias = Column(String(100), comment="别名")
    category = Column(String(50), comment="分类")
    is_potential = Column(Boolean, default=False, comment="是否为潜力产品")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
