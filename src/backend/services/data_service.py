"""
backend/services/data_service.py — 数据查询 + 租户/部门/组隔离
基于新模型: WidthRecord / PotentialCust / PotentialUser
"""
import json
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.sales_data import WidthRecord, PotentialCust, PotentialUser
from models.product_dict import ProductDict
from models.department import Department

ROLE_SCOPE_ALL = {"admin", "gm", "operation"}

# 27 个产品品类（与前端 PRODS 对齐）
WIDTH_PRODUCTS = [
    'IPC','球机','专用摄像机','服务器','网络产品','PC产品','NVR','存储',
    'LED拼控','LCD解码','智能交通','移动终端产品','出入口停车','门禁','对讲',
    '人员通道','报警','音频产品','传感产品','智慧屏与视频会议','通用软件',
    '行业软件','基础软件','新业务(热成像/睿影/消防等)','网络安全','综合布线与机柜机房','智能计算'
]

# 运营部门（不参与统计）
EXCLUDED_DEPTS = {'管理部', '深圳业务中心', '运营部'}


def _tenant(db: Session, user_info: dict) -> int:
    return user_info.get("tenant_id", 1)


def _dept_filter(user_info: dict) -> list[str] | None:
    """角色数据范围 → 部门名称列表；None 表示全量"""
    role = user_info.get("role", "")
    if role in ROLE_SCOPE_ALL:
        return None
    dept_id = user_info.get("dept_id")
    if dept_id:
        d = user_info.get("dept_name")  # JWT 注入
        if not d:
            d = db_departments.get(dept_id, "")
        return [d] if d else None
    return []


# 部门 ID → 名称缓存（模块加载时从 DB 读取一次）
_db_session = None


def _get_db():
    global _db_session
    if _db_session is None:
        from database import SessionLocal
        _db_session = SessionLocal()
    return _db_session


db_departments: dict[int, str] = {}


def _init_dept_cache():
    global db_departments
    if db_departments:
        return
    try:
        db = _get_db()
        for d in db.query(Department).all():
            db_departments[d.id] = d.name
    except Exception:
        pass


_init_dept_cache()

# ──────────────────── 产品宽度 ────────────────────

def get_width_summary(db: Session, user_info: dict) -> dict:
    """产品宽度总览 — 从 WidthRecord 聚合"""
    tid = _tenant(db, user_info)
    base = db.query(WidthRecord).filter(WidthRecord.tenant_id == tid)

    # 规上客户 (record_type='cust' AND guishang='是')
    cust_q = base.filter(WidthRecord.record_type == 'cust')
    total_cust = cust_q.with_entities(func.count(func.distinct(WidthRecord.name))).scalar() or 0
    reg_cust = cust_q.filter(WidthRecord.guishang == '是').with_entities(
        func.count(func.distinct(WidthRecord.name))).scalar() or 0

    # 规上用户
    user_q = base.filter(WidthRecord.record_type == 'user')
    total_user = user_q.with_entities(func.count(func.distinct(WidthRecord.name))).scalar() or 0

    # 平均宽度
    avg_width = cust_q.with_entities(func.avg(WidthRecord.width)).scalar() or 0

    # 产品覆盖率（从 prods_json 统计哪些产品有人覆盖）
    records = base.all()
    covered = set()
    for r in records:
        try:
            prods = json.loads(r.prods_json) if isinstance(r.prods_json, str) else (r.prods_json or {})
        except (json.JSONDecodeError, TypeError):
            prods = {}
        for k, v in prods.items():
            if v == 1 or v == '1':
                covered.add(k)
    total_prods = len(WIDTH_PRODUCTS)
    cov_pct = round(len(covered) / total_prods * 100, 1) if total_prods else 0

    return {
        "total_customers": total_cust,
        "total_users": total_user,
        "avg_width": round(avg_width, 2),
        "product_coverage_pct": cov_pct,
        "regulated_customers": reg_cust,
        "regulated_rate": round(reg_cust / total_cust * 100, 1) if total_cust else 0,
    }


def get_heatmap_data(db: Session, user_info: dict) -> dict:
    """27 产品 × 覆盖率热力图"""
    tid = _tenant(db, user_info)
    cust_q = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid,
        WidthRecord.record_type == 'cust',
    )
    total = cust_q.with_entities(func.count(func.distinct(WidthRecord.name))).scalar() or 1

    records = cust_q.all()
    prod_custs: dict[str, set] = {p: set() for p in WIDTH_PRODUCTS}
    for r in records:
        try:
            prods = json.loads(r.prods_json) if isinstance(r.prods_json, str) else (r.prods_json or {})
        except (json.JSONDecodeError, TypeError):
            prods = {}
        for p in WIDTH_PRODUCTS:
            if prods.get(p) == 1 or prods.get(p) == '1':
                prod_custs[p].add(r.name)

    products = []
    for p in WIDTH_PRODUCTS:
        cnt = len(prod_custs.get(p, set()))
        products.append({
            "name": p,
            "rate": round(cnt / total * 100, 1),
            "count": cnt,
        })
    return {"products": products, "total_customers": total}


def get_customer_list(db: Session, user_info: dict, limit: int = 20) -> list:
    """客户维度产品覆盖列表"""
    tid = _tenant(db, user_info)
    records = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid,
        WidthRecord.record_type == 'cust',
    ).all()

    cust_map: dict[str, dict] = {}
    for r in records:
        if r.name not in cust_map:
            cust_map[r.name] = {"name": r.name, "width": 0, "products": set(), "dept": r.dept or ""}
        cust_map[r.name]["width"] = max(cust_map[r.name]["width"], r.width or 0)
        try:
            prods = json.loads(r.prods_json) if isinstance(r.prods_json, str) else (r.prods_json or {})
        except (json.JSONDecodeError, TypeError):
            prods = {}
        for k, v in prods.items():
            if v == 1 or v == '1':
                cust_map[r.name]["products"].add(k)

    result = sorted(cust_map.values(), key=lambda x: x["width"], reverse=True)
    return [{"name": c["name"], "width": c["width"],
             "product_count": len(c["products"]), "dept": c["dept"]}
            for c in result[:limit]]


# ──────────────────── 潜力产品 ────────────────────

def get_potential_summary(db: Session, user_info: dict) -> dict:
    """潜力产品总览"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    # 排除运营部门
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))

    total_amt = q.with_entities(func.sum(PotentialCust.amount)).scalar() or 0
    total_prev = q.with_entities(func.sum(PotentialCust.amount_prev)).scalar() or 0
    total_cust = q.with_entities(func.count(func.distinct(PotentialCust.cust_name))).scalar() or 0
    total_prods = q.with_entities(func.count(func.distinct(PotentialCust.product))).scalar() or 0
    yoy = ((total_amt - total_prev) / total_prev * 100) if total_prev > 0 else 0

    return {
        "total_amount": round(total_amt, 1),
        "total_amount_prev": round(total_prev, 1),
        "yoy_pct": round(yoy, 1),
        "total_customers": total_cust,
        "total_products": total_prods,
        "avg_customer_amount": round(total_amt / total_cust, 1) if total_cust else 0,
    }


def get_dept_ranking(db: Session, user_info: dict) -> list:
    """潜力产品部门排名"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))

    depts = q.with_entities(PotentialCust.dept3).distinct().all()
    result = []
    for (dn,) in depts:
        if not dn or dn in EXCLUDED_DEPTS:
            continue
        dq = q.filter(PotentialCust.dept3 == dn)
        sales = dq.with_entities(func.sum(PotentialCust.amount)).scalar() or 0
        sales_prev = dq.with_entities(func.sum(PotentialCust.amount_prev)).scalar() or 0
        yoy = ((sales - sales_prev) / sales_prev * 100) if sales_prev > 0 else 0
        covered = dq.with_entities(func.count(func.distinct(PotentialCust.product))).scalar() or 0
        result.append({
            "dept": dn, "sales": round(sales, 0), "sales_prev": round(sales_prev, 0),
            "yoy": round(yoy, 1), "coverage_pct": round(covered / 11 * 100, 1),
        })
    result.sort(key=lambda x: x["sales"], reverse=True)
    return result


def get_team_matrix(db: Session, user_info: dict) -> list:
    """团队 × 潜力产品矩阵 — 从 PotentialCust 聚合"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))

    # 按 dept4 (团队小组) 维度聚合
    groups = q.with_entities(PotentialCust.dept4, PotentialCust.dept3).distinct().all()
    prods = q.with_entities(PotentialCust.product).distinct().all()

    result = []
    for (gn, dept_n) in groups:
        if not gn:
            continue
        row = {"team": gn, "dept": dept_n or "", "products": {}}
        for (pn,) in prods:
            if not pn:
                continue
            amt = q.filter(PotentialCust.dept4 == gn, PotentialCust.product == pn).with_entities(
                func.sum(PotentialCust.amount)).scalar() or 0
            amt_prev = q.filter(PotentialCust.dept4 == gn, PotentialCust.product == pn).with_entities(
                func.sum(PotentialCust.amount_prev)).scalar() or 0
            row["products"][pn] = {"amount": round(amt, 0), "amount_prev": round(amt_prev, 0)}
        result.append(row)
    return result
