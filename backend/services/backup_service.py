"""
backend/services/backup_service.py — 数据备份与恢复
"""
import json
import os
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from config import BACKUP_DIR
from models.tenant import Tenant
from models.user import User
from models.department import Department
from models.group import Group
from models.product_dict import ProductDict
from models.sales_data import SalesWidth, SalesPotential
from models.import_record import ImportRecord
from models.audit_log import AuditLog

os.makedirs(BACKUP_DIR, exist_ok=True)


def create_backup(db: Session, tenant_id: int, user_id: int) -> dict:
    """创建全量备份（JSON dump）"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    def row_to_dict(row):
        d = {}
        for col in row.__table__.columns:
            val = getattr(row, col.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            d[col.name] = val
        return d

    data = {
        "meta": {
            "created_at": timestamp,
            "tenant_id": tenant_id,
            "user_id": user_id,
        },
        "tenants": [row_to_dict(r) for r in db.query(Tenant).filter(Tenant.id == tenant_id).all()],
        "departments": [row_to_dict(r) for r in db.query(Department).filter(Department.tenant_id == tenant_id).all()],
        "groups": [row_to_dict(r) for r in db.query(Group).filter(Group.tenant_id == tenant_id).all()],
        "users": [row_to_dict(r) for r in db.query(User).filter(User.tenant_id == tenant_id).all()],
        "products": [row_to_dict(r) for r in db.query(ProductDict).filter(ProductDict.tenant_id == tenant_id).all()],
        "sales_width": [row_to_dict(r) for r in db.query(SalesWidth).filter(SalesWidth.tenant_id == tenant_id).all()],
        "sales_potential": [row_to_dict(r) for r in db.query(SalesPotential).filter(SalesPotential.tenant_id == tenant_id).all()],
        "import_records": [row_to_dict(r) for r in db.query(ImportRecord).filter(ImportRecord.tenant_id == tenant_id).all()],
        "audit_logs": [row_to_dict(r) for r in db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).all()],
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(filepath)
    return {"filename": filename, "path": filepath, "size_bytes": size}


def list_backups() -> list:
    """列出所有备份文件"""
    files = []
    if not os.path.isdir(BACKUP_DIR):
        return files
    for f in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if f.endswith(".json"):
            fp = os.path.join(BACKUP_DIR, f)
            files.append({
                "filename": f,
                "size_bytes": os.path.getsize(fp),
                "created_at": f.replace("backup_", "").replace(".json", ""),
            })
    return files


def restore_backup(db: Session, filename: str) -> bool:
    """从备份恢复数据"""
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.isfile(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 清空现有数据（按租户）
    tenant_id = data["meta"].get("tenant_id", 1)
    for model in [SalesPotential, SalesWidth, ImportRecord, AuditLog]:
        db.query(model).filter(model.tenant_id == tenant_id).delete()
    db.query(ProductDict).filter(ProductDict.tenant_id == tenant_id).delete()
    db.query(Group).filter(Group.tenant_id == tenant_id).delete()
    db.query(Department).filter(Department.tenant_id == tenant_id).delete()
    db.query(User).filter(User.tenant_id == tenant_id).delete()
    db.commit()

    # 恢复数据
    for row_dict in data.get("departments", []):
        _insert_from_dict(db, Department, row_dict)
    for row_dict in data.get("groups", []):
        _insert_from_dict(db, Group, row_dict)
    for row_dict in data.get("users", []):
        _insert_from_dict(db, User, row_dict)
    for row_dict in data.get("products", []):
        _insert_from_dict(db, ProductDict, row_dict)
    for row_dict in data.get("sales_width", []):
        _insert_from_dict(db, SalesWidth, row_dict)
    for row_dict in data.get("sales_potential", []):
        _insert_from_dict(db, SalesPotential, row_dict)
    for row_dict in data.get("import_records", []):
        _insert_from_dict(db, ImportRecord, row_dict)
    for row_dict in data.get("audit_logs", []):
        _insert_from_dict(db, AuditLog, row_dict)

    db.commit()
    return True


def delete_backup(filename: str) -> bool:
    """删除备份文件"""
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.isfile(filepath):
        os.remove(filepath)
        return True
    return False


def _insert_from_dict(db: Session, model, d: dict):
    """从字典创建记录，保留原始 ID"""
    obj = model()
    for k, v in d.items():
        if hasattr(obj, k):
            # 跳过 server_default 字段
            if k in ("created_at",):
                continue
            setattr(obj, k, v)
    db.add(obj)
