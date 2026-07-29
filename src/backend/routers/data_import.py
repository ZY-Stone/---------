"""
backend/routers/data_import.py — 批量数据导入 API（含 RBAC 权限）
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.sales_data import SalesWidth, SalesPotential
from models.import_record import ImportRecord
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from utils.scope import require_perm

router = APIRouter(prefix="/api/import", tags=["数据导入"])

class WidthRow(BaseModel):
    period: str
    customer_name: str
    user_name: Optional[str] = ""
    dept_id: int
    group_id: int
    owner_id: int
    product_id: int
    amount: float = 0
    amount_prev: float = 0
    qty: float = 0
    qty_prev: float = 0
    is_regulated: bool = False

class PotentialRow(BaseModel):
    period: str
    customer_name: str
    user_name: Optional[str] = ""
    dept_id: int
    group_id: int
    owner_id: int
    product_id: int
    amount: float = 0
    amount_prev: float = 0
    qty: float = 0
    qty_prev: float = 0
    source_type: Optional[str] = "customer"

def _user(request: Request) -> dict:
    return getattr(request.state, "user", {})

@router.post("/width")
@require_perm("import_data")
def import_width(data: List[WidthRow], request: Request, db: Session = Depends(get_db)):
    u = _user(request)
    tenant_id = u.get("tenant_id", 1)
    period = data[0].period if data else datetime.now().strftime("%Y-%m")

    # 删除该期间旧数据
    db.query(SalesWidth).filter(
        SalesWidth.tenant_id == tenant_id,
        SalesWidth.period == period
    ).delete()

    count = 0
    for row in data:
        db.add(SalesWidth(
            tenant_id=tenant_id, period=row.period or period,
            customer_name=row.customer_name, user_name=row.user_name or "",
            dept_id=row.dept_id, group_id=row.group_id, owner_id=row.owner_id,
            product_id=row.product_id, amount=row.amount, amount_prev=row.amount_prev,
            qty=row.qty, qty_prev=row.qty_prev, is_regulated=row.is_regulated
        ))
        count += 1

    # 记录导入日志
    db.add(ImportRecord(tenant_id=tenant_id, user_id=u.get("user_id", 1),
                        file_name=f"width_{period}", data_type="width_cust",
                        data_source=f"bulk_import_{period}", row_count=count))
    db.commit()
    # 返回数据集的列信息（Schema），供前端动态映射
    columns = [
        {"name": "period", "type": "string", "label": "期间"},
        {"name": "customer_name", "type": "string", "label": "客户名称"},
        {"name": "user_name", "type": "string", "label": "用户名称"},
        {"name": "dept_id", "type": "integer", "label": "部门ID"},
        {"name": "group_id", "type": "integer", "label": "小组ID"},
        {"name": "owner_id", "type": "integer", "label": "负责人ID"},
        {"name": "product_id", "type": "integer", "label": "产品ID"},
        {"name": "amount", "type": "float", "label": "销售额(万)"},
        {"name": "amount_prev", "type": "float", "label": "同期销售额(万)"},
        {"name": "qty", "type": "float", "label": "数量"},
        {"name": "qty_prev", "type": "float", "label": "同期数量"},
        {"name": "is_regulated", "type": "boolean", "label": "是否规上"},
    ]
    return {"status": "ok", "count": count, "period": period, "columns": columns}

@router.post("/potential")
@require_perm("import_data")
def import_potential(data: List[PotentialRow], request: Request, db: Session = Depends(get_db)):
    u = _user(request)
    tenant_id = u.get("tenant_id", 1)
    period = data[0].period if data else datetime.now().strftime("%Y-%m")

    # 删除该期间旧数据
    db.query(SalesPotential).filter(
        SalesPotential.tenant_id == tenant_id,
        SalesPotential.period == period
    ).delete()

    count = 0
    for row in data:
        db.add(SalesPotential(
            tenant_id=tenant_id, period=row.period or period,
            customer_name=row.customer_name, user_name=row.user_name or "",
            dept_id=row.dept_id, group_id=row.group_id, owner_id=row.owner_id,
            product_id=row.product_id, amount=row.amount, amount_prev=row.amount_prev,
            qty=row.qty, qty_prev=row.qty_prev, source_type=row.source_type or "customer"
        ))
        count += 1

    db.add(ImportRecord(tenant_id=tenant_id, user_id=u.get("user_id", 1),
                        file_name=f"potential_{period}", data_type="potential_cust",
                        data_source=f"bulk_import_{period}", row_count=count))
    db.commit()
    # 返回数据集的列信息（Schema），供前端动态映射
    columns = [
        {"name": "period", "type": "string", "label": "期间"},
        {"name": "customer_name", "type": "string", "label": "客户名称"},
        {"name": "user_name", "type": "string", "label": "用户名称"},
        {"name": "dept_id", "type": "integer", "label": "部门ID"},
        {"name": "group_id", "type": "integer", "label": "小组ID"},
        {"name": "owner_id", "type": "integer", "label": "负责人ID"},
        {"name": "product_id", "type": "integer", "label": "产品ID"},
        {"name": "amount", "type": "float", "label": "销售额(万)"},
        {"name": "amount_prev", "type": "float", "label": "同期销售额(万)"},
        {"name": "qty", "type": "float", "label": "数量"},
        {"name": "qty_prev", "type": "float", "label": "同期数量"},
        {"name": "is_regulated", "type": "boolean", "label": "是否规上"},
    ]
    return {"status": "ok", "count": count, "period": period, "columns": columns}

@router.get("/periods/{data_type}")
def list_periods(data_type: str, request: Request, db: Session = Depends(get_db)):
    u = _user(request)
    tenant_id = u.get("tenant_id", 1)
    model = SalesWidth if data_type == "width" else SalesPotential
    periods = db.query(model.period).filter(
        model.tenant_id == tenant_id
    ).distinct().order_by(model.period.desc()).all()
    return {"periods": [p[0] for p in periods]}
