"""
backend/models/sales_data.py
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func
from database import Base


class SalesWidth(Base):
    """产品宽度销售数据"""
    __tablename__ = "sales_width"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    period = Column(String(7), nullable=False, comment="期间，如 2026-07")
    customer_name = Column(String(200), nullable=False, comment="客户名称(售达方)")
    user_name = Column(String(200), comment="最终用户名称")
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="负责销售")
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    amount = Column(Float, default=0, comment="销售额(万)")
    amount_prev = Column(Float, default=0, comment="同期销售额(万)")
    qty = Column(Float, default=0, comment="数量")
    qty_prev = Column(Float, default=0, comment="同期数量")
    is_regulated = Column(Boolean, default=False, comment="是否规上客户")
    created_at = Column(DateTime, server_default=func.now())


class SalesPotential(Base):
    """潜力产品销售数据"""
    __tablename__ = "sales_potential"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    period = Column(String(7), nullable=False, comment="期间")
    customer_name = Column(String(200), nullable=False, comment="客户名称")
    user_name = Column(String(200), comment="最终用户")
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    amount = Column(Float, default=0, comment="销售额(万)")
    amount_prev = Column(Float, default=0, comment="同期销售额(万)")
    qty = Column(Float, default=0)
    qty_prev = Column(Float, default=0)
    opps = Column(Integer, default=0, comment="商机数")
    opps_prev = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
