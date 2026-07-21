"""
backend/models/import_record.py
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from database import Base


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, comment="租户ID")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_name = Column(String(200), nullable=False)
    data_type = Column(String(50), nullable=False, comment="width_user/width_cust/potential_user/potential_cust")
    data_source = Column(String(50), comment="数据源名称")
    row_count = Column(Integer, default=0)
    status = Column(String(20), default="success", comment="success/failed")
    created_at = Column(DateTime, server_default=func.now())
