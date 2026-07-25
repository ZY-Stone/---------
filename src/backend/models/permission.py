"""SQLAlchemy 2.0 — 权限 + 操作日志"""
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class RolePermission(Base):
    """角色权限配置 — 可动态调整每个角色的模块访问权限"""
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    role: Mapped[str] = mapped_column(String(30), unique=True, comment="admin/gm/operation/director/manager/interface/sales")
    role_name: Mapped[str] = mapped_column(String(50), comment="角色名称")
    overview: Mapped[bool] = mapped_column(Boolean, default=True, comment="数据总览")
    width: Mapped[bool] = mapped_column(Boolean, default=True, comment="产品宽度分析")
    potential: Mapped[bool] = mapped_column(Boolean, default=True, comment="潜力产品分析")
    users_mgmt: Mapped[bool] = mapped_column(Boolean, default=False, comment="用户管理")
    roles_mgmt: Mapped[bool] = mapped_column(Boolean, default=False, comment="角色权限管理")
    products_mgmt: Mapped[bool] = mapped_column(Boolean, default=False, comment="产品字典管理")
    audit_log: Mapped[bool] = mapped_column(Boolean, default=False, comment="审计日志查看")
    backup: Mapped[bool] = mapped_column(Boolean, default=False, comment="备份导出")
    import_data: Mapped[bool] = mapped_column(Boolean, default=False, comment="数据导入")
    export_data: Mapped[bool] = mapped_column(Boolean, default=False, comment="数据导出")
    data_scope: Mapped[str] = mapped_column(String(20), default="self", comment="数据范围: all/dept/group/self")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OperationLog(Base):
    """操作日志 — 记录所有关键操作"""
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), comment="租户ID")
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    username: Mapped[str] = mapped_column(String(50), default="", comment="操作用户名")
    action: Mapped[str] = mapped_column(String(50), comment="操作类型: login/import/query/export/update/delete/create")
    module: Mapped[str] = mapped_column(String(50), default="", comment="操作模块: width/potential/admin/auth")
    target: Mapped[str] = mapped_column(String(200), default="", comment="操作目标")
    detail: Mapped[str | None] = mapped_column(String(500), default=None, comment="详情")
    ip: Mapped[str] = mapped_column(String(50), default="", comment="IP地址")
    status: Mapped[str] = mapped_column(String(20), default="success", comment="success/failed")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
