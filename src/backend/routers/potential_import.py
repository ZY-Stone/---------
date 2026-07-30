"""潜力产品导入 API — 写入 potential_cust / potential_user 表（含 RBAC 权限 + 数据隔离）"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import json
from database import get_db
from models.sales_data import PotentialCust, PotentialUser, SalesPotential
from models.product_dict import ProductDict
from models.group import Group
from models.audit_log import AuditLog
from utils.scope import scope_user_from_request, require_perm, filter_by_scope, scope_data_scope

router = APIRouter(prefix="/api/import", tags=["潜力产品导入"])

# 无下属小组的部门（组=部门自身）
NO_GROUP_DEPTS = {'场景数字化销售部', '大客户销售部'}

# 运营部门：不参与任何数据统计
EXCLUDED_DEPTS = {'管理部', '深圳业务中心', '运营部'}

def _write_audit(db: Session, action: str, target: str, detail: str, user_id: int = 1, tenant_id: int = 1):
    """写入审计日志"""
    try:
        db.add(AuditLog(
            tenant_id=tenant_id, user_id=user_id,
            action=action, target=target, detail=detail, ip="127.0.0.1"
        ))
        db.commit()
    except Exception:
        pass  # 审计日志写入失败不影响主流程


def parse_yoy(val) -> float:
    """解析同比字符串: '+25%' → 25.0, '-8.5%' → -8.5, '新增' → 0, 0.15 → 0.15"""
    if val is None: return 0.0
    if isinstance(val, (int, float)): return float(val)
    s = str(val).strip()
    if s == '新增' or s == '': return 0.0
    s = s.replace('%', '')
    try: return float(s)
    except ValueError: return 0.0

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
@require_perm("import_data")
async def import_potential_cust(request: Request, db: Session = Depends(get_db)):
    """批量导入客户维度数据"""
    body = await request.json()
    rows = body.get("rows", [])
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}
    snapshot = body.get("snapshotPeriod", "") or body.get("snapshot_period", "")

    # 构建产品名→ID 映射
    products = {p.name: p.id for p in db.query(ProductDict).filter(ProductDict.is_potential == True).all()}

    count, updated = 0, 0
    for r in rows:
        dept_name, group_name = resolve_dept_group(
            db, r.get('dept3', ''), r.get('dept4', ''), r.get('dept5', '')
        )
        # 跳过运营部门数据
        if dept_name in EXCLUDED_DEPTS:
            continue
        cust_name = r.get("custName", "")
        product = r.get("product", "")
        period_val = r.get("snapshotPeriod", "") or r.get("period", "") or snapshot
        # 按 售达方名称 + 产品 + 月份 去重（同客户同产品同月=更新，不同月=新增）
        existing = db.query(PotentialCust).filter(
            PotentialCust.cust_name == cust_name,
            PotentialCust.product == product,
            PotentialCust.period == period_val,
            PotentialCust.tenant_id == 1
        ).first() if cust_name else None
        if existing:
            existing.dept2 = r.get("dept2", existing.dept2 or "")
            existing.dept3 = r.get("dept3", existing.dept3 or "")
            existing.dept4 = r.get("dept4", existing.dept4 or "")
            existing.dept5 = r.get("dept5", existing.dept5 or "")
            existing.group_name = group_name
            existing.dept_name = dept_name
            existing.sales = r.get("sales", existing.sales or "")
            existing.contact = r.get("contact", existing.contact or "")
            existing.user_name = r.get("userName", existing.user_name)
            existing.product_id = products.get(product, None)
            existing.amount = float(r.get("amount", 0))
            existing.amount_prev = float(r.get("amountPrev", 0))
            existing.yoy = str(r.get("yoy", "")) if r.get("yoy") is not None else None
            existing.qty = int(r.get("qty", 0))
            existing.qty_prev = int(r.get("qtyPrev", 0))
            existing.qty_yoy = str(r.get("qtyYoy", "")) if r.get("qtyYoy") is not None else None
            existing.opps = int(r.get("opps", 0))
            existing.opps_prev = int(r.get("oppsPrev", 0))
            existing.opps_yoy = str(r.get("oppsYoy", "")) if r.get("oppsYoy") is not None else None
            existing.users = int(r.get("users", 0))
            existing.users_prev = int(r.get("usersPrev", 0))
            existing.users_yoy = str(r.get("usersYoy", "")) if r.get("usersYoy") is not None else None
            existing.period = period_val or existing.period
            updated += 1
        else:
            rec = PotentialCust(
                tenant_id=1, period=period_val or "2026-07",
                dept2=r.get("dept2", ""), dept3=r.get("dept3", ""),
                dept4=r.get("dept4", ""), dept5=r.get("dept5", ""),
                group_name=group_name, dept_name=dept_name,
                sales=r.get("sales", ""), contact=r.get("contact", ""),
                product=product, product_id=products.get(product, None),
                cust_name=cust_name, user_name=r.get("userName"),
                amount=float(r.get("amount", 0)), amount_prev=float(r.get("amountPrev", 0)),
                yoy=str(r.get("yoy", "")) if r.get("yoy") is not None else None,
                qty=int(r.get("qty", 0)), qty_prev=int(r.get("qtyPrev", 0)),
                qty_yoy=str(r.get("qtyYoy", "")) if r.get("qtyYoy") is not None else None,
                opps=int(r.get("opps", 0)), opps_prev=int(r.get("oppsPrev", 0)),
                opps_yoy=str(r.get("oppsYoy", "")) if r.get("oppsYoy") is not None else None,
                users=int(r.get("users", 0)), users_prev=int(r.get("usersPrev", 0)),
                users_yoy=str(r.get("usersYoy", "")) if r.get("usersYoy") is not None else None,
            )
            db.add(rec)
            db.flush()
            count += 1

    db.commit()
    total = count + updated
    if total > 0:
        _write_audit(db, "数据导入", "潜力产品-客户", f"新增 {count} / 更新 {updated} 条客户维度数据")
    return {"ok": True, "count": count, "updated": updated,
            "message": f"新增 {count} / 更新 {updated} 条客户维度数据"}


@router.post("/potential-user")
@require_perm("import_data")
async def import_potential_user(request: Request, db: Session = Depends(get_db)):
    """批量导入用户维度数据 v2 — parse_yoy 版本"""
    body = await request.json()
    rows = body.get("rows", [])
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}
    snapshot = body.get("snapshotPeriod", "") or body.get("snapshot_period", "")

    products = {p.name: p.id for p in db.query(ProductDict).filter(ProductDict.is_potential == True).all()}

    count, updated = 0, 0
    for r in rows:
        dept_name = r.get("dept3", "")
        if dept_name in EXCLUDED_DEPTS:
            continue
        group_name = r.get("dept4", "") or r.get("dept5", "") or dept_name
        user_name = r.get("userName", "")
        product = r.get("product", "")
        period_val2 = r.get("snapshotPeriod", "") or r.get("period", "") or snapshot
        # 按 最终用户名称 + 产品 + 月份 去重（同用户同产品同月=更新，不同月=新增）
        existing = db.query(PotentialUser).filter(
            PotentialUser.user_name == user_name,
            PotentialUser.product == product,
            PotentialUser.period == period_val2,
            PotentialUser.tenant_id == 1
        ).first() if user_name else None
        if existing:
            existing.center = r.get("center", existing.center or "")
            existing.dept3 = r.get("dept3", existing.dept3 or "")
            existing.dept4 = r.get("dept4", existing.dept4 or "")
            existing.dept5 = r.get("dept5", existing.dept5 or "")
            existing.group_name = group_name
            existing.dept_name = dept_name
            existing.sales = r.get("sales", existing.sales or "")
            existing.contact = r.get("contact", existing.contact or "")
            existing.industry = r.get("industry", existing.industry or "")
            existing.product_id = products.get(product, None)
            existing.out_amt = float(r.get("outAmt", 0))
            existing.out_amt_prev = float(r.get("outAmtPrev", 0))
            existing.out_yoy = parse_yoy(r.get("outYoy"))
            existing.out_qty = int(r.get("outQty", 0))
            existing.out_qty_prev = int(r.get("outQtyPrev", 0))
            existing.out_qty_yoy = parse_yoy(r.get("outQtyYoy"))
            existing.opps = int(r.get("opps", 0))
            existing.opps_prev = int(r.get("oppsPrev", 0))
            existing.opps_yoy = parse_yoy(r.get("oppsYoy"))
            existing.users = int(r.get("users", 0))
            existing.users_prev = int(r.get("usersPrev", 0))
            existing.users_yoy = parse_yoy(r.get("usersYoy"))
            existing.custs = int(r.get("custs", 0))
            existing.custs_prev = int(r.get("custsPrev", 0))
            existing.custs_yoy = parse_yoy(r.get("custsYoy"))
            existing.period = period_val2 or existing.period
            updated += 1
        else:
            rec = PotentialUser(
                tenant_id=1, period=period_val2 or "2026-07",
                center=r.get("center", ""), dept3=r.get("dept3", ""),
                dept4=r.get("dept4", ""), dept5=r.get("dept5", ""),
                group_name=group_name, dept_name=dept_name,
                sales=r.get("sales", ""), contact=r.get("contact", ""),
                user_name=user_name, industry=r.get("industry", ""),
                product=product, product_id=products.get(product, None),
                out_amt=float(r.get("outAmt", 0)), out_amt_prev=float(r.get("outAmtPrev", 0)),
                out_yoy=parse_yoy(r.get("outYoy")),
                out_qty=int(r.get("outQty", 0)), out_qty_prev=int(r.get("outQtyPrev", 0)),
                out_qty_yoy=parse_yoy(r.get("outQtyYoy")),
                opps=int(r.get("opps", 0)), opps_prev=int(r.get("oppsPrev", 0)),
                opps_yoy=parse_yoy(r.get("oppsYoy")),
                users=int(r.get("users", 0)), users_prev=int(r.get("usersPrev", 0)),
                users_yoy=parse_yoy(r.get("usersYoy")),
                custs=int(r.get("custs", 0)), custs_prev=int(r.get("custsPrev", 0)),
                custs_yoy=parse_yoy(r.get("custsYoy")),
            )
            db.add(rec)
            db.flush()
            count += 1

    db.commit()
    total = count + updated
    if total > 0:
        _write_audit(db, "数据导入", "潜力产品-用户", f"新增 {count} / 更新 {updated} 条用户维度数据")
    return {"ok": True, "count": count, "updated": updated,
            "message": f"新增 {count} / 更新 {updated} 条用户维度数据"}


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
@require_perm("import_data")
async def import_width_records(request: Request, db: Session = Depends(get_db)):
    """批量导入产品宽度数据（用户+客户）"""
    body = await request.json()
    rows = body.get("rows", [])
    record_type = body.get("type", "user")
    if not rows:
        return {"ok": False, "message": "无数据", "count": 0}

    count, updated = 0, 0
    snapshot = body.get("snapshotPeriod", "") or body.get("snapshot_period", "")
    for r in rows:
        raw_group = r.get("dept", "")  # 模板的"销售部门"实际存的是组名
        dept_name, group_name = resolve_width_dept_group(db, raw_group)
        # 跳过运营部门数据
        if dept_name in EXCLUDED_DEPTS:
            continue
        siebel = r.get("siebel", "")
        name = r.get("user") or r.get("name", "")
        # 按 siebel + record_type + snapshot_period 去重（同编码同月=更新，不同月=新增）
        existing = db.query(WidthRecord).filter(
            WidthRecord.siebel == siebel,
            WidthRecord.record_type == record_type,
            WidthRecord.snapshot_period == snapshot,
            WidthRecord.tenant_id == 1
        ).first() if siebel else None
        if existing:
            existing.industry = r.get("industry", existing.industry or "")
            existing.name = name or existing.name
            existing.sales = r.get("sales", existing.sales or "")
            existing.dept = dept_name
            existing.group_name = group_name
            existing.guishang = r.get("guishang", existing.guishang or "否")
            existing.width = int(r.get("width", existing.width or 0))
            existing.prods_json = json.dumps(r.get("prods", {}), ensure_ascii=False)
            existing.contact = r.get("contact", existing.contact or "")
            existing.level = r.get("level", existing.level or "")
            existing.snapshot_period = snapshot or existing.snapshot_period
            updated += 1
        else:
            rec = WidthRecord(
                tenant_id=1, record_type=record_type,
                siebel=siebel, industry=r.get("industry", ""),
                name=name, sales=r.get("sales", ""),
                dept=dept_name, group_name=group_name,
                guishang=r.get("guishang", "否"), width=int(r.get("width", 0)),
                prods_json=json.dumps(r.get("prods", {}), ensure_ascii=False),
                contact=r.get("contact", ""), level=r.get("level", ""),
                snapshot_period=snapshot,
            )
            db.add(rec)
            db.flush()  # 确保同批次后续去重能查到
            count += 1

    db.commit()
    total = count + updated
    if total > 0:
        _write_audit(db, "数据导入", "产品宽度", f"新增 {count} / 更新 {updated} 条产品宽度数据 ({record_type})")
    return {"ok": True, "count": count, "updated": updated,
            "message": f"新增 {count} / 更新 {updated} 条产品宽度数据"}


# ── 数据查询：前端从后端拉取已导入数据 ──

def _width_row_to_dict(r: WidthRecord) -> dict:
    return {
        "id": r.id,
        "siebel": r.siebel or "", "industry": r.industry or "",
        "name": r.name or "", "sales": r.sales or "",
        "dept": r.dept or "", "group": r.group_name or "",
        "guishang": r.guishang or "否", "width": r.width or 0,
        "prods": json.loads(r.prods_json) if r.prods_json else {},
        "contact": r.contact or "", "level": r.level or "",
        "type": r.record_type or "user",
        "snapshotPeriod": r.snapshot_period or "",
    }


@router.get("/width-records")
def get_width_records(type: str = "", request: Request = None, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    tid = u.get("tenant_id", 1)
    q = db.query(WidthRecord).filter(WidthRecord.tenant_id == tid)
    q = filter_by_scope(q, WidthRecord, u, dept_field="dept", group_field="group_name", sales_field="sales")
    if type:
        q = q.filter(WidthRecord.record_type == type)
    rows = q.all()
    return {"rows": [_width_row_to_dict(r) for r in rows]}


@router.get("/potential-cust")
def get_potential_cust(request: Request = None, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    tid = u.get("tenant_id", 1)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = filter_by_scope(q, PotentialCust, u)
    rows = q.all()
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "dept2": r.dept2 or "", "dept3": r.dept3 or "", "dept4": r.dept4 or "", "dept5": r.dept5 or "",
            "sales": r.sales or "", "contact": r.contact or "",
            "product": r.product or "", "custName": r.cust_name or "", "userName": r.user_name or "",
            "amount": r.amount or 0, "amountPrev": r.amount_prev or 0, "yoy": r.yoy or "",
            "qty": r.qty or 0, "qtyPrev": r.qty_prev or 0, "qtyYoy": r.qty_yoy or "",
            "opps": r.opps or 0, "oppsPrev": r.opps_prev or 0, "oppsYoy": r.opps_yoy or "",
            "users": r.users or 0, "usersPrev": r.users_prev or 0, "usersYoy": r.users_yoy or "",
            "snapshotPeriod": r.period or "",
        })
    return {"rows": result}


@router.get("/potential-user")
def get_potential_user(request: Request = None, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    tid = u.get("tenant_id", 1)
    q = db.query(PotentialUser).filter(PotentialUser.tenant_id == tid)
    q = filter_by_scope(q, PotentialUser, u)
    rows = q.all()
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "center": r.center or "", "dept3": r.dept3 or "", "dept4": r.dept4 or "",
            "sales": r.sales or "", "contact": r.contact or "",
            "userName": r.user_name or "", "industry": r.industry or "",
            "product": r.product or "",
            "outAmt": r.out_amt or 0, "outAmtPrev": r.out_amt_prev or 0, "outYoy": r.out_yoy or 0,
            "outQty": r.out_qty or 0, "outQtyPrev": r.out_qty_prev or 0, "outQtyYoy": r.out_qty_yoy or 0,
            "opps": r.opps or 0, "oppsPrev": r.opps_prev or 0, "oppsYoy": r.opps_yoy or 0,
            "users": r.users or 0, "usersPrev": r.users_prev or 0, "usersYoy": r.users_yoy or 0,
            "custs": r.custs or 0, "custsPrev": r.custs_prev or 0, "custsYoy": r.custs_yoy or 0,
            "snapshotPeriod": r.period or "",
        })
    return {"rows": result}


# ── 数据清空：resetAll 调用，清空后端数据库 ──

@router.delete("/width-records")
def delete_width_records(type: str = "", db: Session = Depends(get_db)):
    q = db.query(WidthRecord).filter(WidthRecord.tenant_id == 1)
    if type and type != "all":
        q = q.filter(WidthRecord.record_type == type)
    deleted = q.delete()
    db.commit()
    if deleted > 0:
        _write_audit(db, "数据删除", "产品宽度", f"删除 {deleted} 条产品宽度数据 ({type or '全部'})")
    return {"ok": True, "deleted": deleted}


@router.delete("/potential-cust")
def delete_potential_cust(db: Session = Depends(get_db)):
    deleted = db.query(PotentialCust).filter(PotentialCust.tenant_id == 1).delete()
    # 同步清理旧版 sales_potential 表残留数据
    deleted_old = db.query(SalesPotential).filter(SalesPotential.tenant_id == 1).delete()
    db.commit()
    total = deleted + deleted_old
    if total > 0:
        _write_audit(db, "数据删除", "潜力产品-客户", f"删除 {deleted} 条客户维度数据 + {deleted_old} 条旧版数据")
    return {"ok": True, "deleted": deleted, "deleted_old": deleted_old}


@router.delete("/potential-user")
def delete_potential_user(db: Session = Depends(get_db)):
    deleted = db.query(PotentialUser).filter(PotentialUser.tenant_id == 1).delete()
    # 同步清理旧版 sales_potential 表残留数据（与 potential-cust 共享旧表，防止单边删除遗漏）
    deleted_old = db.query(SalesPotential).filter(SalesPotential.tenant_id == 1).delete()
    db.commit()
    total = deleted + deleted_old
    if total > 0:
        _write_audit(db, "数据删除", "潜力产品-用户", f"删除 {deleted} 条用户维度数据 + {deleted_old} 条旧版数据")
    return {"ok": True, "deleted": deleted, "deleted_old": deleted_old}


# ═══════════════════════════════════════════
# 单行 CRUD API：支持前端增删改查持久化到数据库
# ═══════════════════════════════════════════

# ── WidthRecord 单行 CRUD ──

@router.put("/width-records/{record_id}")
@require_perm("import_data")
async def update_width_record(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    rec = db.query(WidthRecord).filter(
        WidthRecord.id == record_id,
        WidthRecord.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    for key in ("name", "siebel", "sales", "dept", "group_name", "guishang",
                "width", "contact", "level", "snapshot_period", "industry"):
        if key in body:
            setattr(rec, key, body.get(key))
    if "prods" in body:
        rec.prods_json = json.dumps(body["prods"], ensure_ascii=False)
    db.commit()
    _write_audit(db, "数据编辑", "产品宽度", f"更新记录 #{rec.id}")
    return {"ok": True, "id": rec.id}


@router.delete("/width-records/{record_id}")
@require_perm("import_data")
def delete_width_record(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    rec = db.query(WidthRecord).filter(
        WidthRecord.id == record_id,
        WidthRecord.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    db.delete(rec)
    db.commit()
    _write_audit(db, "数据删除", "产品宽度", f"删除记录 #{record_id}")
    return {"ok": True, "message": "已删除"}


@router.post("/width-records/batch-delete")
@require_perm("import_data")
async def batch_delete_width_records(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(400, "ids 不能为空")
    deleted = db.query(WidthRecord).filter(
        WidthRecord.id.in_(ids),
        WidthRecord.tenant_id == u.get("tenant_id", 1)
    ).delete(synchronize_session=False)
    db.commit()
    _write_audit(db, "批量删除", "产品宽度", f"删除 {deleted} 条记录")
    return {"ok": True, "deleted": deleted}


# ── PotentialCust 单行 CRUD ──

@router.put("/potential-cust/{record_id}")
@require_perm("import_data")
async def update_potential_cust(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    rec = db.query(PotentialCust).filter(
        PotentialCust.id == record_id,
        PotentialCust.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    for key in ("dept2", "dept3", "dept4", "dept5", "sales", "contact", "product",
                "cust_name", "user_name", "amount", "amount_prev", "yoy",
                "qty", "qty_prev", "qty_yoy", "opps", "opps_prev", "opps_yoy",
                "users", "users_prev", "users_yoy", "period"):
        if key in body:
            setattr(rec, key, body.get(key))
    db.commit()
    _write_audit(db, "数据编辑", "潜力产品-客户", f"更新记录 #{rec.id}")
    return {"ok": True, "id": rec.id}


@router.delete("/potential-cust/{record_id}")
@require_perm("import_data")
def delete_potential_cust_row(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    rec = db.query(PotentialCust).filter(
        PotentialCust.id == record_id,
        PotentialCust.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    db.delete(rec)
    db.commit()
    _write_audit(db, "数据删除", "潜力产品-客户", f"删除记录 #{record_id}")
    return {"ok": True, "message": "已删除"}


@router.post("/potential-cust/batch-delete")
@require_perm("import_data")
async def batch_delete_potential_cust(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(400, "ids 不能为空")
    deleted = db.query(PotentialCust).filter(
        PotentialCust.id.in_(ids),
        PotentialCust.tenant_id == u.get("tenant_id", 1)
    ).delete(synchronize_session=False)
    db.commit()
    _write_audit(db, "批量删除", "潜力产品-客户", f"删除 {deleted} 条记录")
    return {"ok": True, "deleted": deleted}


# ── PotentialUser 单行 CRUD ──

@router.put("/potential-user/{record_id}")
@require_perm("import_data")
async def update_potential_user(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    rec = db.query(PotentialUser).filter(
        PotentialUser.id == record_id,
        PotentialUser.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    for key in ("center", "dept3", "dept4", "dept5", "sales", "contact",
                "user_name", "industry", "product",
                "out_amt", "out_amt_prev", "out_yoy",
                "out_qty", "out_qty_prev", "out_qty_yoy",
                "opps", "opps_prev", "opps_yoy",
                "users", "users_prev", "users_yoy",
                "custs", "custs_prev", "custs_yoy", "period"):
        if key in body:
            setattr(rec, key, body.get(key))
    db.commit()
    _write_audit(db, "数据编辑", "潜力产品-用户", f"更新记录 #{rec.id}")
    return {"ok": True, "id": rec.id}


@router.delete("/potential-user/{record_id}")
@require_perm("import_data")
def delete_potential_user_row(record_id: int, request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    rec = db.query(PotentialUser).filter(
        PotentialUser.id == record_id,
        PotentialUser.tenant_id == u.get("tenant_id", 1)
    ).first()
    if not rec:
        raise HTTPException(404, "记录不存在")
    db.delete(rec)
    db.commit()
    _write_audit(db, "数据删除", "潜力产品-用户", f"删除记录 #{record_id}")
    return {"ok": True, "message": "已删除"}


@router.post("/potential-user/batch-delete")
@require_perm("import_data")
async def batch_delete_potential_user(request: Request, db: Session = Depends(get_db)):
    u = scope_user_from_request(request)
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(400, "ids 不能为空")
    deleted = db.query(PotentialUser).filter(
        PotentialUser.id.in_(ids),
        PotentialUser.tenant_id == u.get("tenant_id", 1)
    ).delete(synchronize_session=False)
    db.commit()
    _write_audit(db, "批量删除", "潜力产品-用户", f"删除 {deleted} 条记录")
    return {"ok": True, "deleted": deleted}
