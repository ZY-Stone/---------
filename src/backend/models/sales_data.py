"""SQLAlchemy 2.0 — 潜力产品 + 产品宽度 销售数据"""
from datetime import datetime
from sqlalchemy import Integer, String, Float, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class WidthRecord(Base):
    """产品宽度（14字段，对齐导入模板）"""
    __tablename__ = "width_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    record_type: Mapped[str] = mapped_column(String(10), default="user", comment="user/cust")
    siebel: Mapped[str] = mapped_column(String(50), default="", comment="siebel编码")
    industry: Mapped[str] = mapped_column(String(100), default="", comment="用户行业(user独有)")
    name: Mapped[str] = mapped_column(String(200), comment="用户名称(user)/客户名称(cust)")
    sales: Mapped[str] = mapped_column(String(50), default="", comment="销售")
    dept: Mapped[str] = mapped_column(String(100), default="", comment="部门（从组自动推导）")
    group_name: Mapped[str] = mapped_column(String(100), default="", comment="组名")
    guishang: Mapped[str] = mapped_column(String(5), default="否", comment="是否规上")
    width: Mapped[int] = mapped_column(Integer, default=0, comment="产品线合计")
    prods_json: Mapped[str | None] = mapped_column(String, default=None, comment="27产品 0/1 JSON")
    contact: Mapped[str] = mapped_column(String(50), default="", comment="接口人")
    level: Mapped[str] = mapped_column(String(50), default="", comment="用户/客户等级")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PotentialCust(Base):
    """潜力产品-客户维度（21字段，对齐导入模板）"""
    __tablename__ = "potential_cust"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    period: Mapped[str] = mapped_column(String(7), comment="期间")
    dept2: Mapped[str] = mapped_column(String(100), default="", comment="二级部门/业务中心")
    dept3: Mapped[str] = mapped_column(String(100), default="", comment="三级部门/大部门")
    dept4: Mapped[str] = mapped_column(String(100), default="", comment="四级部门/团队小组")
    dept5: Mapped[str] = mapped_column(String(100), default="", comment="五级部门")
    group_name: Mapped[str] = mapped_column(String(100), default="", comment="解析后的组名")
    dept_name: Mapped[str] = mapped_column(String(100), default="", comment="解析后的部门名")
    sales: Mapped[str] = mapped_column(String(50), default="", comment="销售雇员")
    contact: Mapped[str] = mapped_column(String(50), default="", comment="对接人")
    product: Mapped[str] = mapped_column(String(100), comment="潜力产品")
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True, comment="FK→产品字典")
    cust_name: Mapped[str] = mapped_column(String(200), default="", comment="售达方名称")
    user_name: Mapped[str | None] = mapped_column(String(200), default=None, comment="最终用户")
    amount: Mapped[float] = mapped_column(Float, default=0, comment="销售额(万)")
    amount_prev: Mapped[float] = mapped_column(Float, default=0, comment="同期销售额(万)")
    yoy: Mapped[str | None] = mapped_column(String(20), default=None, comment="同比")
    qty: Mapped[int] = mapped_column(Integer, default=0, comment="销售数量")
    qty_prev: Mapped[int] = mapped_column(Integer, default=0, comment="同期销售数量")
    qty_yoy: Mapped[str | None] = mapped_column(String(20), default=None, comment="销售数量同比")
    opps: Mapped[int] = mapped_column(Integer, default=0, comment="交易商机数")
    opps_prev: Mapped[int] = mapped_column(Integer, default=0, comment="交易商机数同期")
    opps_yoy: Mapped[str | None] = mapped_column(String(20), default=None, comment="交易商机数同比")
    users: Mapped[int] = mapped_column(Integer, default=0, comment="交易用户数")
    users_prev: Mapped[int] = mapped_column(Integer, default=0, comment="交易用户数同期")
    users_yoy: Mapped[str | None] = mapped_column(String(20), default=None, comment="用户数同比")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PotentialUser(Base):
    """潜力产品-用户维度（23字段，对齐导入模板）"""
    __tablename__ = "potential_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    period: Mapped[str] = mapped_column(String(7), comment="期间")
    center: Mapped[str] = mapped_column(String(100), default="", comment="业务中心")
    dept3: Mapped[str] = mapped_column(String(100), default="", comment="部门(三级)")
    dept4: Mapped[str] = mapped_column(String(100), default="", comment="团队小组(四级部门)")
    dept5: Mapped[str] = mapped_column(String(100), default="", comment="四级部门(五级等效)")
    group_name: Mapped[str] = mapped_column(String(100), default="", comment="解析后的组名")
    dept_name: Mapped[str] = mapped_column(String(100), default="", comment="解析后的部门名")
    sales: Mapped[str] = mapped_column(String(50), default="", comment="负责销售")
    contact: Mapped[str] = mapped_column(String(50), default="", comment="对接人")
    user_name: Mapped[str] = mapped_column(String(200), comment="最终用户名称")
    industry: Mapped[str] = mapped_column(String(50), default="", comment="行业")
    product: Mapped[str] = mapped_column(String(100), comment="潜力产品")
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True, comment="FK→产品字典")
    out_amt: Mapped[float] = mapped_column(Float, default=0, comment="产品出库额(万)")
    out_amt_prev: Mapped[float] = mapped_column(Float, default=0, comment="产品出库额同期")
    out_yoy: Mapped[float] = mapped_column(Float, default=0, comment="产品出库额同比")
    out_qty: Mapped[int] = mapped_column(Integer, default=0, comment="销售数量")
    out_qty_prev: Mapped[int] = mapped_column(Integer, default=0, comment="销售数量同期")
    out_qty_yoy: Mapped[float] = mapped_column(Float, default=0, comment="销售数量同比")
    opps: Mapped[int] = mapped_column(Integer, default=0, comment="交易商机数")
    opps_prev: Mapped[int] = mapped_column(Integer, default=0, comment="交易商机数同期")
    opps_yoy: Mapped[float] = mapped_column(Float, default=0, comment="交易商机数同比")
    users: Mapped[int] = mapped_column(Integer, default=0, comment="交易用户数")
    users_prev: Mapped[int] = mapped_column(Integer, default=0, comment="交易用户数同期")
    users_yoy: Mapped[float] = mapped_column(Float, default=0, comment="交易用户数同比")
    custs: Mapped[int] = mapped_column(Integer, default=0, comment="交易客户数")
    custs_prev: Mapped[int] = mapped_column(Integer, default=0, comment="交易客户数同期")
    custs_yoy: Mapped[float] = mapped_column(Float, default=0, comment="交易客户数同比")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


# ===== 旧模型（保持后端服务兼容）=====
class SalesWidth(Base):
    __tablename__ = "sales_width"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"))
    period: Mapped[str] = mapped_column(String(7))
    customer_name: Mapped[str] = mapped_column(String(200))
    user_name: Mapped[str | None] = mapped_column(String(200), default=None)
    dept_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"))
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id"))
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"))
    amount: Mapped[float] = mapped_column(Float, default=0)
    amount_prev: Mapped[float] = mapped_column(Float, default=0)
    qty: Mapped[float] = mapped_column(Float, default=0)
    qty_prev: Mapped[float] = mapped_column(Float, default=0)
    is_regulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

class SalesPotential(Base):
    __tablename__ = "sales_potential"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"))
    period: Mapped[str] = mapped_column(String(7))
    customer_name: Mapped[str] = mapped_column(String(200))
    user_name: Mapped[str | None] = mapped_column(String(200), default=None)
    dept_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"))
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id"))
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"))
    amount: Mapped[float] = mapped_column(Float, default=0)
    amount_prev: Mapped[float] = mapped_column(Float, default=0)
    qty: Mapped[float] = mapped_column(Float, default=0)
    qty_prev: Mapped[float] = mapped_column(Float, default=0)
    opps: Mapped[int] = mapped_column(Integer, default=0)
    opps_prev: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
