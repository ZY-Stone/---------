"""潜力产品导入 API — 写入 potential_cust / potential_user 表"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models.sales_data import PotentialCust, PotentialUser
from models.product_dict import ProductDict
from models.group import Group

router = APIRouter(prefix="/api/import", tags=["潜力产品导入"])

# 无下属小组的部门（组=部门自身）
NO_GROUP_DEPTS = {'场景数字化销售部', '大客户销售部'}

# 运营部门：不参与任何数据统计
EXCLUDED_DEPTS = {'管理部', '深圳业务中心', '运营部'}

def resolve_dept_group(db: Session, dept3: str, dept4: str, dept5: str) -> tuple[str, str]:
    """从部门层级推导 部门名 和 组名"""
    # 1. 先用五级/四级查找 GROUPS 表
    group_name = (dept5 or dept4 or '').strip()
    if group_name and group_name != '未分配':
        g = db.query(Group).filter(Group.name == group_name).first()
        if g:
            return (g.dept.name if g.dept else group_name), group_name
    # 2. 无下属小组的部门：组=部门
    if dept3 in NO_GROUP_DEPTS:
        return dept3, dept3
    # 3. 默认：部门=dept3，组=dept4 或 dept3
    return (dept3 or dept4 or ''), (dept4 or dept3 or '')

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
        dept_name, group_name = resolve_dept_group(
            db, r.get('dept3', ''), r.get('dept4', ''), r.get('dept5', '')
        )
        # 跳过运营部门数据
        if dept_name in EXCLUDED_DEPTS:
            continue
        rec = PotentialCust(
            tenant_id=1,
            period=r.get("period", "2026-07"),
            dept2=r.get("dept2", ""),
            dept3=r.get("dept3", ""),
            dept4=r.get("dept4", ""),
            dept5=r.get("dept5", ""),
            group_name=group_name,
            dept_name=dept_name,
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
        dept_name = r.get("dept3", "")
        # 跳过运营部门数据
        if dept_name in EXCLUDED_DEPTS:
            continue
        group_name = r.get("dept4", "") or r.get("dept5", "") or dept_name
        rec = PotentialUser(
            tenant_id=1,
            period=r.get("period", "2026-07"),
            center=r.get("center", ""),
            dept3=r.get("dept3", ""),
            dept4=r.get("dept4", ""),
            dept5=r.get("dept5", ""),
            group_name=group_name,
            dept_name=dept_name,
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
from models.group import Group

# 无下属小组的部门
WIDTH_NO_GROUP_DEPTS = {'场景数字化销售部', '大客户销售部'}

def resolve_width_dept_group(db: Session, raw_group: str) -> tuple[str, str]:
    """从模板的销售部门(实际为组名)推导部门名和组名"""
    if not raw_group:
        return "", ""
    # 查找 GROUPS 表
    g = db.query(Group).filter(Group.name == raw_group).first()
    if g and g.dept:
        return g.dept.name, raw_group
    # 无下属组的部门
    if raw_group in WIDTH_NO_GROUP_DEPTS:
        return raw_group, raw_group
    # 未匹配 → 保留原值
    return raw_group, raw_group

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
        raw_group = r.get("dept", "")  # 模板的"销售部门"实际存的是组名
        dept_name, group_name = resolve_width_dept_group(db, raw_group)
        # 跳过运营部门数据
        if dept_name in EXCLUDED_DEPTS:
            continue
        rec = WidthRecord(
            tenant_id=1,
            record_type=record_type,
            siebel=r.get("siebel", ""),
            industry=r.get("industry", ""),
            name=r.get("user") or r.get("name", ""),
            sales=r.get("sales", ""),
            dept=dept_name,
            group_name=group_name,
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
