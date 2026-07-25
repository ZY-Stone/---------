"""潜力产品导入 API — 写入 potential_cust / potential_user 表"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models.sales_data import PotentialCust, PotentialUser
from models.product_dict import ProductDict

router = APIRouter(prefix="/api/import", tags=["潜力产品导入"])

@router.post("/potential-cust")
async def import_potential_cust(request: Request, db: Session = Depends(get_db)):
    """批量导入客户维度数据"""
    body = await request.json()
    rows = body.get("rows", [])
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}

    # 构建产品名→ID 映射
    products = {p.name: p.id for p in db.query(ProductDict).filter(ProductDict.is_potential == True).all()}

    count = 0
    for r in rows:
        rec = PotentialCust(
            tenant_id=1,
            period=r.get("period", "2026-07"),
            dept2=r.get("dept2", ""),
            dept3=r.get("dept3", ""),
            dept4=r.get("dept4", ""),
            dept5=r.get("dept5", ""),
            group_name=r.get("group", ""),
            dept_name=r.get("dept", ""),
            sales=r.get("sales", ""),
            contact=r.get("contact", ""),
            product=r.get("product", ""),
            product_id=products.get(r.get("product", ""), None),
            cust_name=r.get("custName", ""),
            user_name=r.get("userName"),
            amount=float(r.get("amount", 0)),
            amount_prev=float(r.get("amountPrev", 0)),
            yoy=str(r.get("yoy", "")) if r.get("yoy") is not None else None,
            qty=int(r.get("qty", 0)),
            qty_prev=int(r.get("qtyPrev", 0)),
            qty_yoy=str(r.get("qtyYoy", "")) if r.get("qtyYoy") is not None else None,
            opps=int(r.get("opps", 0)),
            opps_prev=int(r.get("oppsPrev", 0)),
            opps_yoy=str(r.get("oppsYoy", "")) if r.get("oppsYoy") is not None else None,
            users=int(r.get("users", 0)),
            users_prev=int(r.get("usersPrev", 0)),
            users_yoy=str(r.get("usersYoy", "")) if r.get("usersYoy") is not None else None,
        )
        db.add(rec)
        count += 1

    db.commit()
    return {"ok": True, "count": count, "message": f"导入 {count} 条客户维度数据"}


@router.post("/potential-user")
async def import_potential_user(request: Request, db: Session = Depends(get_db)):
    """批量导入用户维度数据"""
    body = await request.json()
    rows = body.get("rows", [])
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}

    products = {p.name: p.id for p in db.query(ProductDict).filter(ProductDict.is_potential == True).all()}

    count = 0
    for r in rows:
        rec = PotentialUser(
            tenant_id=1,
            period=r.get("period", "2026-07"),
            center=r.get("center", ""),
            dept3=r.get("dept3", ""),
            dept4=r.get("dept4", ""),
            dept5=r.get("dept5", ""),
            group_name=r.get("group", ""),
            dept_name=r.get("dept", ""),
            contact=r.get("contact", ""),
            user_name=r.get("userName", ""),
            industry=r.get("industry", ""),
            product=r.get("product", ""),
            product_id=products.get(r.get("product", ""), None),
            out_amt=float(r.get("outAmt", 0)),
            out_amt_prev=float(r.get("outAmtPrev", 0)),
            out_yoy=float(r.get("outYoy", 0)),
            out_qty=int(r.get("outQty", 0)),
            out_qty_prev=int(r.get("outQtyPrev", 0)),
            out_qty_yoy=float(r.get("outQtyYoy", 0)),
            opps=int(r.get("opps", 0)),
            opps_prev=int(r.get("oppsPrev", 0)),
            opps_yoy=float(r.get("oppsYoy", 0)),
            users=int(r.get("users", 0)),
            users_prev=int(r.get("usersPrev", 0)),
            users_yoy=float(r.get("usersYoy", 0)),
            custs=int(r.get("custs", 0)),
            custs_prev=int(r.get("custsPrev", 0)),
            custs_yoy=float(r.get("custsYoy", 0)),
        )
        db.add(rec)
        count += 1

    db.commit()
    return {"ok": True, "count": count, "message": f"导入 {count} 条用户维度数据"}


from models.sales_data import WidthRecord

@router.post("/width-records")
async def import_width_records(request: Request, db: Session = Depends(get_db)):
    """批量导入产品宽度数据（用户+客户）"""
    body = await request.json()
    rows = body.get("rows", [])
    record_type = body.get("type", "user")
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}

    count = 0
    for r in rows:
        rec = WidthRecord(
            tenant_id=1,
            record_type=record_type,
            siebel=r.get("siebel", ""),
            industry=r.get("industry", ""),
            name=r.get("user") or r.get("name", ""),
            sales=r.get("sales", ""),
            dept=r.get("dept", ""),
            guishang=r.get("guishang", "否"),
            width=int(r.get("width", 0)),
            prods_json=str(r.get("prods", {})),
            contact=r.get("contact", ""),
            level=r.get("level", ""),
        )
        db.add(rec)
        count += 1

    db.commit()
    return {"ok": True, "count": count, "message": f"导入 {count} 条产品宽度数据"}
