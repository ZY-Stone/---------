"""
backend/services/backup_service.py — 数据备份与恢复（三种类型）
"""
import json
import os
from datetime import datetime
from sqlalchemy.orm import Session
from config import BACKUP_DIR
from models.tenant import Tenant
from models.user import User
from models.department import Department
from models.group import Group
from models.product_dict import ProductDict
from models.sales_data import SalesWidth, SalesPotential, WidthRecord, PotentialCust, PotentialUser
from models.import_record import ImportRecord
from models.audit_log import AuditLog

os.makedirs(BACKUP_DIR, exist_ok=True)

# 备份类型定义
ACCOUNT_MODELS = [Tenant, Department, Group, User]                             # 账号备份
DATA_MODELS    = [ProductDict, WidthRecord, SalesWidth, PotentialCust, PotentialUser, SalesPotential, ImportRecord]  # 数据备份
ALL_MODELS     = ACCOUNT_MODELS + DATA_MODELS + [AuditLog]                     # 全量备份

TYPE_LABELS = {
    "accounts": "账号备份",
    "data": "数据备份",
    "full": "全量备份",
}
TYPE_PREFIX = {"accounts": "acct", "data": "data", "full": "full"}


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def _get_models(btype: str) -> list:
    if btype == "accounts":
        return ACCOUNT_MODELS
    elif btype == "data":
        return DATA_MODELS
    else:
        return ALL_MODELS


def create_backup(db: Session, tenant_id: int, user_id: int, btype: str = "full") -> dict:
    """创建指定类型的备份"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = TYPE_PREFIX.get(btype, "full")
    filename = f"backup_{prefix}_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)
    models = _get_models(btype)

    data = {
        "meta": {
            "backup_type": btype,
            "type_label": TYPE_LABELS.get(btype, "全量备份"),
            "created_at": timestamp,
            "tenant_id": tenant_id,
            "user_id": user_id,
        },
    }
    for model in models:
        key = model.__tablename__
        # Tenant 表用 id，其他表用 tenant_id
        if key == "tenants":
            rows = db.query(model).filter(model.id == tenant_id).all()
        else:
            rows = db.query(model).filter(model.tenant_id == tenant_id).all()
        data[key] = [_row_to_dict(r) for r in rows]

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(filepath)
    return {"filename": filename, "path": filepath, "size_bytes": size, "type": btype}


def list_backups() -> list:
    """列出所有备份文件"""
    files = []
    if not os.path.isdir(BACKUP_DIR):
        return files
    for f in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if f.endswith(".json"):
            fp = os.path.join(BACKUP_DIR, f)
            btype = "full"
            for key, prefix in TYPE_PREFIX.items():
                if f.startswith(f"backup_{prefix}_"):
                    btype = key
                    break
            files.append({
                "filename": f,
                "size_bytes": os.path.getsize(fp),
                "created_at": f.rsplit("_", 1)[-1].replace(".json", "") if "_" in f else "",
                "type": btype,
                "type_label": TYPE_LABELS.get(btype, "全量备份"),
            })
    return files


def restore_backup(db: Session, filename: str, btype: str = "full") -> bool:
    """恢复指定类型的备份数据"""
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.isfile(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    tenant_id = data.get("meta", {}).get("tenant_id", 1)
    # 使用备份文件中记录的类型
    actual_type = data.get("meta", {}).get("backup_type", btype)
    models = _get_models(actual_type)

    # 清空该类型的现有数据
    for model in reversed(models):
        try:
            if model.__tablename__ == "tenants":
                pass  # 不删除租户记录
            elif model.__tablename__ == "audit_logs":
                db.query(model).filter(model.tenant_id == tenant_id).delete()
            elif hasattr(model, 'tenant_id'):
                db.query(model).filter(model.tenant_id == tenant_id).delete()
            else:
                pass  # 没有 tenant_id 的表跳过
        except Exception:
            pass
    db.commit()

    # 恢复数据
    for model in models:
        key = model.__tablename__
        for row_dict in data.get(key, []):
            _insert_from_dict(db, model, row_dict)

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
            if k in ("created_at",):
                continue
            setattr(obj, k, v)
    db.add(obj)
