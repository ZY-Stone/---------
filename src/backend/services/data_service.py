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

def get_width_summary(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """产品宽度总览 — 从 WidthRecord 聚合，dept 为空则按角色权限"""
    tid = _tenant(db, user_info)
    base = db.query(WidthRecord).filter(WidthRecord.tenant_id == tid)

    # 部门筛选：dept 优先，否则按角色
    if dept and dept != 'all':
        base = base.filter(WidthRecord.dept == dept)
    else:
        role = user_info.get("role", "")
        if role not in ROLE_SCOPE_ALL:
            dept_name = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
            if dept_name:
                base = base.filter(WidthRecord.dept == dept_name)

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


def get_heatmap_data(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """27 产品 × 覆盖率热力图"""
    tid = _tenant(db, user_info)
    cust_q = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid,
        WidthRecord.record_type == 'cust',
    )
    if dept and dept != 'all':
        cust_q = cust_q.filter(WidthRecord.dept == dept)
    else:
        role = user_info.get("role", "")
        if role not in ROLE_SCOPE_ALL:
            dept_name = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
            if dept_name:
                cust_q = cust_q.filter(WidthRecord.dept == dept_name)
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


# ──────────────────── 宽度分桶 ────────────────────

from collections import OrderedDict

WIDTH_BUCKETS = OrderedDict([
    ('0',     lambda w: w <= 0),
    ('1-3',   lambda w: 1 <= w <= 3),
    ('4-6',   lambda w: 4 <= w <= 6),
    ('7-10',  lambda w: 7 <= w <= 10),
    ('11-15', lambda w: 11 <= w <= 15),
    ('16+',   lambda w: w >= 16),
])


def _width_role_filter(q, user_info: dict):
    """对 WidthRecord 查询应用租户 + 角色权限过滤"""
    tid = _tenant(db=None, user_info=user_info)
    q = q.filter(WidthRecord.tenant_id == tid)
    role = user_info.get("role", "")
    if role in ROLE_SCOPE_ALL:
        return q
    dept_name = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
    if dept_name:
        q = q.filter(WidthRecord.dept == dept_name)
    return q


def _customer_width_subquery(db: Session, user_info: dict, dept: str | None = None) -> any:
    """按客户聚合宽度子查询 — 每个客户有一条 width"""
    q = db.query(
        WidthRecord.name.label("customer_name"),
        WidthRecord.dept.label("dept_name"),
        WidthRecord.group_name.label("grp_name"),
        WidthRecord.sales.label("owner_name"),
        func.max(WidthRecord.width).label("width")
    ).filter(WidthRecord.record_type == 'cust')
    q = _width_role_filter(q, user_info)
    # 前端传了具体部门则覆盖角色范围
    if dept and dept != 'all':
        q = q.filter(WidthRecord.dept == dept)
    return q.group_by(WidthRecord.name).subquery()


def get_width_distribution(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """容器 1：产品宽度分布（按客户的 width 分 6 桶）"""
    sub = _customer_width_subquery(db, user_info, dept).alias("cw")
    rows = db.query(sub.c.width).all()
    bucket_counts = {k: 0 for k in WIDTH_BUCKETS.keys()}
    total = 0
    for (w,) in rows:
        if w is None:
            continue
        total += 1
        for k, pred in WIDTH_BUCKETS.items():
            if pred(w):
                bucket_counts[k] += 1
                break
    return {
        "labels": list(WIDTH_BUCKETS.keys()),
        "values": [bucket_counts[k] for k in WIDTH_BUCKETS.keys()],
        "total_customers": total,
    }


def get_team_avg(db: Session, user_info: dict, dept: str | None = None) -> list:
    """容器 2：各组平均产品宽度 — 合并客户+用户数据取 width 字段均值"""
    from models.group import Group
    from models.department import Department
    tid = _tenant(db, user_info)
    groups = db.query(Group, Department).outerjoin(
        Department, Group.dept_id == Department.id
    ).filter(Group.tenant_id == tid).all()

    base_q = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid
    )
    # 角色权限过滤
    if dept and dept != 'all':
        base_q = base_q.filter(WidthRecord.dept == dept)
    else:
        role = user_info.get("role", "")
        if role not in ROLE_SCOPE_ALL:
            dept_name = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
            if dept_name:
                base_q = base_q.filter(WidthRecord.dept == dept_name)

    result = []
    for g, d in groups:
        cw_q = base_q.with_entities(
            WidthRecord.name,
            func.avg(WidthRecord.width).label("aw")
        ).filter(WidthRecord.group_name == g.name).group_by(WidthRecord.name).all()
        if not cw_q:
            continue
        total_w = sum(r.aw or 0 for r in cw_q)
        avg = round(total_w / len(cw_q), 1) if cw_q else 0
        result.append({
            "team": g.name,
            "dept": d.name if d else "",
            "avg": avg,
            "count": len(cw_q),
        })
    result.sort(key=lambda x: x["avg"], reverse=True)
    return result


def get_prod_top_coverage(db: Session, user_info: dict, dept: str | None = None, top_n: int = 15) -> list:
    """容器 3+4 复用：产品覆盖率（与热力图同源）"""
    return get_heatmap_data(db, user_info, dept)


def get_width_distribution_drill(db: Session, user_info: dict, bucket: str, dept: str | None = None, limit: int = 50) -> list:
    """宽度分桶下钻：返回该桶内的客户明细"""
    sub = _customer_width_subquery(db, user_info, dept).alias("cw")
    pred = WIDTH_BUCKETS.get(bucket)
    if not pred:
        return []
    rows = db.query(sub.c.customer_name, sub.c.width).all()
    matched = [(n, w) for (n, w) in rows if w is not None and pred(w)]
    matched.sort(key=lambda x: x[1], reverse=True)
    return [{"name": n, "width": w} for n, w in matched[:limit]]


def get_width_trend(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """产品宽度历史趋势 — 按 created_at 月份聚合 avg width"""
    from sqlalchemy import extract
    tid = _tenant(db, user_info)
    base = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid,
        WidthRecord.record_type == 'cust'
    )
    if dept and dept != 'all':
        base = base.filter(WidthRecord.dept == dept)
    else:
        role = user_info.get("role", "")
        if role not in ROLE_SCOPE_ALL:
            dn = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
            if dn:
                base = base.filter(WidthRecord.dept == dn)
    rows = base.with_entities(
        extract('month', WidthRecord.created_at).label('m'),
        func.avg(WidthRecord.width).label('avg')
    ).group_by('m').order_by('m').all()
    months = [str(int(r.m)).zfill(2) for r in rows]
    avgs = [round(float(r.avg), 2) for r in rows]
    return {"labels": months or ['01'], "values": avgs or [0],
            "label": f"产品宽度趋势 {'(' + dept + ')' if dept and dept != 'all' else ''}"}


def get_width_low_analysis(db: Session, user_info: dict, dept: str | None = None,
                            rtype: str = "cust", threshold: int = 3) -> dict:
    """低宽度分析 — 宽度 < threshold 的客户/用户统计"""
    tid = _tenant(db, user_info)
    base = db.query(WidthRecord).filter(
        WidthRecord.tenant_id == tid,
        WidthRecord.record_type == rtype
    )
    if dept and dept != 'all':
        base = base.filter(WidthRecord.dept == dept)
    else:
        role = user_info.get("role", "")
        if role not in ROLE_SCOPE_ALL:
            dn = user_info.get("dept_name") or db_departments.get(user_info.get("dept_id", 0), "")
            if dn:
                base = base.filter(WidthRecord.dept == dn)
    total = base.with_entities(func.count(func.distinct(WidthRecord.name))).scalar() or 1
    low_q = base.filter(WidthRecord.width < threshold)
    low_count = low_q.with_entities(func.count(func.distinct(WidthRecord.name))).scalar() or 0
    avg_all = base.with_entities(func.avg(WidthRecord.width)).scalar() or 0
    avg_low = low_q.with_entities(func.avg(WidthRecord.width)).scalar() or 0
    # 缺失品类
    records = low_q.all()
    missing = {}
    for r in records:
        try:
            prods = json.loads(r.prods_json) if isinstance(r.prods_json, str) else (r.prods_json or {})
        except Exception:
            prods = {}
        for p, v in prods.items():
            if v != 1 and v != '1':
                missing[p] = missing.get(p, 0) + 1
    top_missing = sorted(missing.items(), key=lambda x: x[1], reverse=True)[:5]
    return {
        "total": total, "low_count": low_count,
        "low_rate": round(low_count / total * 100, 1),
        "avg_all": round(avg_all, 2),
        "avg_low": round(avg_low, 2),
        "gap": round(avg_all - avg_low, 2),
        "upsell": low_count,  # 宽度≥2 可快速提升
        "threshold": threshold,
        "top_missing": [{"product": p, "count": c} for p, c in top_missing],
    }


# ──────────────────── 潜力产品 ────────────────────

def get_potential_summary(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """潜力产品总览 — dept 为空则按角色权限"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)

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


def get_dept_ranking(db: Session, user_info: dict, dept: str | None = None) -> list:
    """潜力产品部门排名 — dept 为空则全量"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)

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


def get_team_matrix(db: Session, user_info: dict, dept: str | None = None) -> list:
    """团队 × 潜力产品矩阵 — 从 PotentialCust 聚合"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)

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


def get_potential_composition(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """潜力产品销售额构成 — 按产品分组"""
    tid = _tenant(db, user_info)
    q = db.query(
        PotentialCust.product,
        func.sum(PotentialCust.amount).label("total")
    ).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)
    rows = q.group_by(PotentialCust.product).order_by(func.sum(PotentialCust.amount).desc()).all()
    return {
        "labels": [r.product for r in rows],
        "values": [round(float(r.total), 1) for r in rows],
        "label": f"潜力产品销售额构成 {'(' + dept + ')' if dept and dept != 'all' else ''}"
    }


def get_potential_trend(db: Session, user_info: dict, dept: str | None = None) -> dict:
    """潜力产品近12月销售额趋势"""
    from sqlalchemy import extract
    tid = _tenant(db, user_info)
    q = db.query(
        extract('month', PotentialCust.created_at).label('m'),
        func.sum(PotentialCust.amount).label("total")
    ).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)
    rows = q.group_by('m').order_by('m').all()
    return {
        "labels": [str(int(r.m)).zfill(2) for r in rows] or ['01'],
        "values": [round(float(r.total), 1) for r in rows] or [0],
        "label": f"潜力产品销售额趋势 {'(' + dept + ')' if dept and dept != 'all' else ''}"
    }


def get_potential_quadrant(db: Session, user_info: dict, dept: str | None = None) -> list:
    """量价四象限 — 每个产品的金额同比 × 数量同比"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)
    prods = q.with_entities(PotentialCust.product).distinct().all()
    result = []
    for (pn,) in prods:
        if not pn:
            continue
        amt = q.filter(PotentialCust.product == pn).with_entities(
            func.sum(PotentialCust.amount)).scalar() or 0
        amt_prev = q.filter(PotentialCust.product == pn).with_entities(
            func.sum(PotentialCust.amount_prev)).scalar() or 0
        qty = q.filter(PotentialCust.product == pn).with_entities(
            func.sum(PotentialCust.qty)).scalar() or 0
        qty_prev = q.filter(PotentialCust.product == pn).with_entities(
            func.sum(PotentialCust.qty_prev)).scalar() or 0
        amt_yoy = round(((amt - amt_prev) / amt_prev * 100), 1) if amt_prev > 0 else 0
        qty_yoy = round(((qty - qty_prev) / qty_prev * 100), 1) if qty_prev > 0 else 0
        result.append({"product": pn, "x": qty_yoy, "y": amt_yoy,
                       "amount": round(amt, 0), "qty": qty})
    return result


def get_potential_scorecard(db: Session, user_info: dict, dept: str | None = None,
                             dim: str = "dept", metric: str = "sales") -> list:
    """差距看板 — 按维度排名"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)
    col = {"dept": PotentialCust.dept3, "group": PotentialCust.dept4, "person": PotentialCust.sales}.get(dim, PotentialCust.dept3)
    groups = q.with_entities(col).distinct().all()
    result = []
    for (gn,) in groups:
        if not gn:
            continue
        gq = q.filter(col == gn)
        sales = gq.with_entities(func.sum(PotentialCust.amount)).scalar() or 0
        sales_prev = gq.with_entities(func.sum(PotentialCust.amount_prev)).scalar() or 0
        custs = gq.with_entities(func.count(func.distinct(PotentialCust.cust_name))).scalar() or 0
        prods = gq.with_entities(func.count(func.distinct(PotentialCust.product))).scalar() or 0
        yoy = round(((sales - sales_prev) / sales_prev * 100), 1) if sales_prev > 0 else 0
        result.append({
            "name": gn, "sales": round(sales, 0), "sales_prev": round(sales_prev, 0),
            "yoy": yoy, "customers": custs, "products": prods,
        })
    result.sort(key=lambda x: x[metric] if metric in x else x["sales"], reverse=True)
    return result


def get_potential_customer_link(db: Session, user_info: dict, dept: str | None = None) -> list:
    """客户×产品关联 — 每个客户在每个产品上的销售额"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialCust).filter(PotentialCust.tenant_id == tid)
    q = q.filter(~PotentialCust.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialCust.dept3 == dept)
    rows = q.all()
    custs = {}
    for r in rows:
        c = r.cust_name
        if c not in custs:
            custs[c] = {"name": c, "dept": r.dept3 or "", "total": 0, "products": {}}
        custs[c]["total"] += r.amount or 0
        custs[c]["products"][r.product] = (custs[c]["products"].get(r.product, 0) + (r.amount or 0))
    result = sorted(custs.values(), key=lambda x: x["total"], reverse=True)[:50]
    return result


def get_potential_user_link(db: Session, user_info: dict, dept: str | None = None) -> list:
    """用户×产品关联"""
    tid = _tenant(db, user_info)
    q = db.query(PotentialUser).filter(PotentialUser.tenant_id == tid)
    q = q.filter(~PotentialUser.dept3.in_(EXCLUDED_DEPTS))
    if dept and dept != 'all':
        q = q.filter(PotentialUser.dept3 == dept)
    rows = q.all()
    users = {}
    for r in rows:
        u = r.user_name
        if u not in users:
            users[u] = {"name": u, "dept": r.dept3 or "", "total": 0, "products": {}}
        users[u]["total"] += r.out_amt or 0
        users[u]["products"][r.product] = (users[u]["products"].get(r.product, 0) + (r.out_amt or 0))
    result = sorted(users.values(), key=lambda x: x["total"], reverse=True)[:50]
    return result
