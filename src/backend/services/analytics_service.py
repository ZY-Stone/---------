"""Analytics service — all field names aligned with frontend Zustand Store"""
import json
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from models.sales_data import WidthRecord, PotentialCust, PotentialUser

# ==================== 产品宽度 ====================

def get_width_kpi(db: Session, dept: str = "") -> dict:
    q = db.query(WidthRecord)
    if dept: q = q.filter(WidthRecord.dept == dept)
    all_rows = q.all()

    # ── 规上过滤：Excel「是否规上」列标注为「是」 ──
    regulated = [r for r in all_rows if r.guishang == '是']

    # 去重计数
    reg_users = set(r.name for r in regulated if r.record_type == 'user')
    reg_custs = set(r.name for r in regulated if r.record_type == 'cust')
    all_custs = set(r.name for r in all_rows if r.record_type == 'cust')

    total_width = sum(r.width or 0 for r in regulated if r.record_type == 'user')
    scaleUsers = len(reg_users)
    scaleCustomers = len(reg_custs)
    totalCustomers = len(all_custs)

    # KPI
    avgWidth = round(total_width / max(scaleUsers, 1), 2)
    coverage = round(scaleCustomers / max(totalCustomers, 1) * 100, 1) if totalCustomers else 0

    # Product coverage (规上客户)
    prods_cover = {}
    for r in regulated:
        if r.record_type != 'cust': continue
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        for p, v in prods.items():
            if v: prods_cover[p] = prods_cover.get(p, 0) + 1
    productCoverage = sorted(
        [{"product": p, "covered": cnt, "rate": str(round(cnt / max(scaleCustomers, 1) * 100, 1))}
         for p, cnt in prods_cover.items()],
        key=lambda x: float(x["rate"]), reverse=True
    )

    return {
        "avgWidth": avgWidth,
        "scaleUsers": scaleUsers,
        "scaleCustomers": scaleCustomers,
        "coverage": str(coverage),
        "widthYoY": "-",
        "customersMoM": 0,
        "coverageYoY": "-",
        "totalRecords": len(all_rows),
        "productCoverage": productCoverage,
    }


def get_width_distribution(db: Session, dept: str = "") -> dict:
    """人均产品宽度分布 — 前端 widthDistribution"""
    q = db.query(WidthRecord)
    if dept: q = q.filter(WidthRecord.dept == dept)
    buckets = {"0": 0, "1-3": 0, "4-6": 0, "7-10": 0, "11-15": 0, "16+": 0}
    for r in q.all():
        w = r.width or 0
        if w == 0: buckets["0"] += 1
        elif w <= 3: buckets["1-3"] += 1
        elif w <= 6: buckets["4-6"] += 1
        elif w <= 10: buckets["7-10"] += 1
        elif w <= 15: buckets["11-15"] += 1
        else: buckets["16+"] += 1
    labels = ["0", "1-3", "4-6", "7-10", "11-15", "16+"]
    return {"labels": labels, "data": [buckets[k] for k in labels]}


def get_width_team(db: Session, dept: str = "") -> dict:
    q = db.query(WidthRecord)
    if dept: q = q.filter(WidthRecord.dept == dept)
    teams = {}
    for r in q.all():
        t = r.dept or "未知"
        if t not in teams: teams[t] = {"total": 0, "count": 0}
        teams[t]["total"] += r.width or 0
        teams[t]["count"] += 1
    ranking = [
        {"dept": t, "avgWidth": str(round(v["total"] / max(v["count"], 1), 2)), "count": v["count"]}
        for t, v in sorted(teams.items(), key=lambda x: x[1]["total"] / max(x[1]["count"], 1), reverse=True)
    ]
    return {"teamWidthRank": ranking}


def get_width_customer_analysis(db: Session) -> dict:
    """客户维度 Top20 / Bottom20（规上客户）"""
    rows = db.query(WidthRecord).filter(
        WidthRecord.record_type == 'cust',
        WidthRecord.guishang == '是',
    ).all()
    sorted_rows = sorted(rows, key=lambda r: r.width or 0, reverse=True)
    good = sorted_rows[:20]
    bad = list(reversed(sorted_rows[-20:])) if len(sorted_rows) >= 20 else list(reversed(sorted_rows))
    def fmt(r):
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        return {
            "name": r.name, "avgW": r.width or 0,
            "soldCnt": sum(1 for v in prods.values() if v), "sold": r.sales or "-"
        }
    return {
        "custGood": [fmt(r) for r in good],
        "custBad": [fmt(r) for r in bad],
    }


def get_width_user_analysis(db: Session) -> dict:
    """用户维度 Top10 / Bottom10（规上用户）"""
    rows = db.query(WidthRecord).filter(
        WidthRecord.record_type == 'user',
        WidthRecord.guishang == '是',
    ).all()
    sorted_rows = sorted(rows, key=lambda r: r.width or 0, reverse=True)
    good = sorted_rows[:10]
    bad = list(reversed(sorted_rows[-10:])) if len(sorted_rows) >= 10 else list(reversed(sorted_rows))
    def fmt(r):
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        return {
            "name": r.name, "avgW": r.width or 0,
            "soldCnt": sum(1 for v in prods.values() if v),
        }
    return {
        "userGood": [fmt(r) for r in good],
        "userBad": [fmt(r) for r in bad],
    }


def get_width_heatmap(db: Session, dept: str = "") -> dict:
    q = db.query(WidthRecord).filter(
        WidthRecord.record_type == 'cust',
        WidthRecord.guishang == '是',
    )
    if dept: q = q.filter(WidthRecord.dept == dept)
    rows = q.all()
    total = len(rows) or 1
    prods_cover = {}
    for r in rows:
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        for p, v in prods.items():
            if v: prods_cover[p] = prods_cover.get(p, 0) + 1
    return {
        "total": total,
        "products": [
            {"name": p, "rate": str(round(cnt / total * 100, 1)), "count": cnt}
            for p, cnt in sorted(prods_cover.items(), key=lambda x: x[1], reverse=True)
        ]
    }


def get_width_cross_sell(db: Session, limit: int = 10) -> dict:
    rows = db.query(WidthRecord).all()
    prod_freq = {}
    for r in rows:
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        for p, v in prods.items():
            if v: prod_freq[p] = prod_freq.get(p, 0) + 1
    top_prods = [p for p, _ in sorted(prod_freq.items(), key=lambda x: x[1], reverse=True)[:limit]]
    n = len(top_prods); total = len(rows) or 1
    matrix = [[0.0] * n for _ in range(n)]
    for r in rows:
        try: prods = json.loads(r.prods_json) if r.prods_json else {}
        except: prods = {}
        active = [i for i, p in enumerate(top_prods) if prods.get(p, 0) > 0]
        for a in active:
            for b in active:
                if a != b: matrix[a][b] += 1
    for i in range(n):
        for j in range(n):
            if i != j: matrix[i][j] = round(matrix[i][j] / total, 3)
            else: matrix[i][j] = 1.0
    return {"prods": top_prods, "matrix": [[{"rate": matrix[i][j], "count": int(matrix[i][j] * total)} for j in range(n)] for i in range(n)]}


# ==================== 潜力产品 ====================

def get_potential_kpi(db: Session, dept: str = "") -> dict:
    q = db.query(PotentialCust)
    if dept: q = q.filter(PotentialCust.dept3 == dept)
    sales = q.with_entities(func.sum(PotentialCust.amount)).scalar() or 0
    prev = q.with_entities(func.sum(PotentialCust.amount_prev)).scalar() or 0
    productCount = q.with_entities(func.count(func.distinct(PotentialCust.product))).scalar() or 0
    customerCount = q.with_entities(func.count(func.distinct(PotentialCust.cust_name))).scalar() or 0
    upCount = q.filter(PotentialCust.amount > PotentialCust.amount_prev).count() or 0
    downCount = q.filter(PotentialCust.amount < PotentialCust.amount_prev).count() or 0
    newCount = q.filter(PotentialCust.amount_prev == 0, PotentialCust.amount > 0).count() or 0
    return {
        "totalSales": round(sales, 1), "totalPrev": round(prev, 1),
        "yoyGrowth": round((sales - prev) / max(prev, 1) * 100, 1),
        "productCount": productCount, "customerCount": customerCount,
        "avgPrice": round(sales / max(customerCount, 1), 1),
        "upCount": upCount, "downCount": downCount, "newCount": newCount,
    }


def get_potential_product_ranking(db: Session, dept: str = "") -> list:
    q = db.query(PotentialCust)
    if dept: q = q.filter(PotentialCust.dept3 == dept)
    rows = q.with_entities(
        PotentialCust.product,
        func.sum(PotentialCust.amount).label("sales"),
        func.sum(PotentialCust.amount_prev).label("prev"),
        func.sum(PotentialCust.qty).label("qty"),
    ).group_by(PotentialCust.product).all()
    return [{
        "product": r.product, "sales": round(r.sales or 0, 1), "prev": round(r.prev or 0, 1),
        "yoy": round((r.sales - (r.prev or 0)) / max(r.prev or 1, 1) * 100, 1),
        "type": _classify(r.sales or 0, r.prev or 0),
    } for r in sorted(rows, key=lambda x: x.sales or 0, reverse=True)]


def get_potential_dept_ranking(db: Session) -> list:
    rows = db.query(
        PotentialCust.dept3,
        func.sum(PotentialCust.amount).label("sales"),
        func.sum(PotentialCust.amount_prev).label("prev"),
        func.count(func.distinct(PotentialCust.product)).label("prodCnt"),
    ).group_by(PotentialCust.dept3).all()
    return [{
        "name": r.dept3 or "未知", "sales": round(r.sales or 0, 1),
        "prev": round(r.prev or 0, 1),
        "yoy": round((r.sales - (r.prev or 0)) / max(r.prev or 1, 1) * 100, 1),
        "productCount": r.prodCnt,
    } for r in sorted(rows, key=lambda x: x.sales or 0, reverse=True)]


def get_potential_cust_segments(db: Session, limit: int = 30) -> list:
    rows = db.query(
        PotentialCust.cust_name,
        func.sum(PotentialCust.amount).label("sales"),
        func.count(func.distinct(PotentialCust.product)).label("prodCnt"),
    ).group_by(PotentialCust.cust_name).order_by(func.sum(PotentialCust.amount).desc()).limit(limit).all()
    return [{"name": r.cust_name or "未知", "sales": round(r.sales or 0, 1), "productCount": r.prodCnt} for r in rows]


def get_potential_quadrant(db: Session) -> list:
    """四象限数据"""
    rows = db.query(PotentialCust).all()
    agg = {}
    for r in rows:
        p = r.product
        if p not in agg: agg[p] = {"sales": 0, "prev": 0, "qty": 0, "qtyPrev": 0}
        agg[p]["sales"] += r.amount or 0
        agg[p]["prev"] += r.amount_prev or 0
        agg[p]["qty"] += r.qty or 0
    result = []
    for p, v in agg.items():
        qtyYoy = ((v["qty"] - v.get("qtyPrev", 0)) / max(v.get("qtyPrev", 1), 1) * 100) if v.get("qtyPrev") else (100 if v["qty"] > 0 else 0)
        amtYoy = ((v["sales"] - v["prev"]) / max(v["prev"], 1) * 100) if v["prev"] else (100 if v["sales"] > 0 else 0)
        result.append({
            "product": p, "x": round(qtyYoy, 1), "y": round(amtYoy, 1),
            "amount": round(v["sales"], 1),
            "quadrant": _classify(v["sales"], v["prev"]),
        })
    return result


def get_potential_team_matrix(db: Session) -> dict:
    rows = db.query(PotentialCust).all()
    teams = {}; products = set()
    for r in rows:
        t = r.dept_name or r.dept3 or r.dept4 or "未知"
        p = r.product; products.add(p)
        if t not in teams: teams[t] = {}
        teams[t][p] = teams[t].get(p, 0) + (r.amount or 0)
    prod_list = sorted(products)
    return {
        "products": prod_list,
        "teams": [{"team": t, "data": [round(teams[t].get(p, 0), 1) for p in prod_list]} for t in sorted(teams.keys())]
    }


def get_potential_user_promotion(db: Session) -> list:
    rows = db.query(PotentialUser).all()
    if not rows:
        rows_cust = db.query(PotentialCust).all()
        if not rows_cust: return []
        user_map = {}
        for r in rows_cust:
            un = r.user_name or r.cust_name or ""
            if not un: continue
            if un not in user_map: user_map[un] = {"amt": 0, "products": set(), "custs": set()}
            user_map[un]["amt"] += r.amount or 0
            if r.product: user_map[un]["products"].add(r.product)
            if r.cust_name: user_map[un]["custs"].add(r.cust_name)
        return sorted([
            {"user": u, "amount": round(v["amt"], 1), "productCount": len(v["products"]), "custCount": len(v["custs"])}
            for u, v in user_map.items()
        ], key=lambda x: x["amount"], reverse=True)
    user_map = {}
    for r in rows:
        un = r.user_name or ""
        if not un: continue
        if un not in user_map: user_map[un] = {"amt": 0, "products": set(), "custs": set()}
        user_map[un]["amt"] += r.out_amt or 0
        if r.product: user_map[un]["products"].add(r.product)
        if r.custs: user_map[un]["custs"].add(str(r.custs))
    return sorted([
        {"user": u, "amount": round(v["amt"], 1), "productCount": len(v["products"]), "custCount": len(v["custs"])}
        for u, v in user_map.items()
    ], key=lambda x: x["amount"], reverse=True)


def get_potential_user_cust_details(db: Session) -> list:
    """用户关联客户明细"""
    rows = db.query(PotentialCust).all()
    if not rows: return []
    uc_map = {}
    for r in rows:
        un = r.user_name or ""; cn = r.cust_name or ""
        if not un or not cn: continue
        if un not in uc_map: uc_map[un] = {}
        uc_map[un][cn] = uc_map[un].get(cn, 0) + (r.amount or 0)
    result = []
    for un, custs in list(uc_map.items())[:8]:
        for cn, amt in list(custs.items())[:5]:
            result.append({"user": un, "cust": cn, "amount": round(amt, 1)})
    return result


def _classify(sales: float, prev: float) -> str:
    if prev == 0 and sales > 0: return "新增"
    return "量价齐升" if sales >= prev else "量价齐跌"
