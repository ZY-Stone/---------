"""
backend/services/data_service.py — 数据查询 + 租户/部门/组隔离
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models.sales_data import SalesWidth, SalesPotential
from models.product_dict import ProductDict
from models.department import Department
from models.group import Group
from models.user import User


# ── 角色 → 数据范围过滤 ──
ROLE_SCOPE_ALL = {"admin", "gm", "operation"}


def _apply_scope(query, model, user_info: dict):
    """在 query 上应用数据隔离条件。返回修饰后的 query。"""
    role = user_info.get("role", "")
    tenant_id = user_info.get("tenant_id", 1)

    # 租户隔离：强制
    query = query.filter(model.tenant_id == tenant_id)

    if role in ROLE_SCOPE_ALL:
        return query

    dept_id = user_info.get("dept_id")
    group_id = user_info.get("group_id")

    if role == "director" and dept_id:
        query = query.filter(model.dept_id == dept_id)
    elif role == "manager" and group_id:
        query = query.filter(model.group_id == group_id)
    elif role == "sales":
        user_id = user_info.get("user_id")
        query = query.filter(model.owner_id == user_id)

    return query


def get_width_summary(db: Session, user_info: dict) -> dict:
    """产品宽度总览数据"""
    query = _apply_scope(db.query(SalesWidth), SalesWidth, user_info)

    total_customers = query.with_entities(func.count(func.distinct(SalesWidth.customer_name))).scalar() or 0
    total_users = query.with_entities(func.count(func.distinct(SalesWidth.user_name))).scalar() or 0
    total_amount = query.with_entities(func.sum(SalesWidth.amount)).scalar() or 0
    total_amount_prev = query.with_entities(func.sum(SalesWidth.amount_prev)).scalar() or 0

    # 产品覆盖率
    total_products = db.query(ProductDict).filter(ProductDict.tenant_id == user_info.get("tenant_id", 1)).count()
    covered_products = query.with_entities(func.count(func.distinct(SalesWidth.product_id))).scalar() or 0

    # 规上客户
    regulated = query.filter(SalesWidth.is_regulated == True).with_entities(
        func.count(func.distinct(SalesWidth.customer_name))).scalar() or 0

    yoy = ((total_amount - total_amount_prev) / total_amount_prev * 100) if total_amount_prev > 0 else 0

    return {
        "total_customers": total_customers,
        "total_users": total_users,
        "total_amount": round(total_amount, 1),
        "total_amount_prev": round(total_amount_prev, 1),
        "yoy_pct": round(yoy, 1),
        "product_coverage_pct": round(covered_products / total_products * 100, 1) if total_products else 0,
        "regulated_customers": regulated,
        "regulated_rate": round(regulated / total_customers * 100, 1) if total_customers else 0,
    }


def get_potential_summary(db: Session, user_info: dict) -> dict:
    """潜力产品总览数据"""
    query = _apply_scope(db.query(SalesPotential), SalesPotential, user_info)

    total_amount = query.with_entities(func.sum(SalesPotential.amount)).scalar() or 0
    total_amount_prev = query.with_entities(func.sum(SalesPotential.amount_prev)).scalar() or 0
    total_customers = query.with_entities(func.count(func.distinct(SalesPotential.customer_name))).scalar() or 0
    total_products = query.with_entities(func.count(func.distinct(SalesPotential.product_id))).scalar() or 0
    yoy = ((total_amount - total_amount_prev) / total_amount_prev * 100) if total_amount_prev > 0 else 0

    return {
        "total_amount": round(total_amount, 1),
        "total_amount_prev": round(total_amount_prev, 1),
        "yoy_pct": round(yoy, 1),
        "total_customers": total_customers,
        "total_products": total_products,
        "avg_customer_amount": round(total_amount / total_customers, 1) if total_customers else 0,
    }


def get_dept_ranking(db: Session, user_info: dict) -> list:
    """部门排名（潜力产品）"""
    tenant_id = user_info.get("tenant_id", 1)
    depts = db.query(Department).filter(Department.tenant_id == tenant_id).all()
    result = []
    for d in depts:
        q = db.query(SalesPotential).filter(SalesPotential.dept_id == d.id, SalesPotential.tenant_id == tenant_id)
        sales = q.with_entities(func.sum(SalesPotential.amount)).scalar() or 0
        sales_prev = q.with_entities(func.sum(SalesPotential.amount_prev)).scalar() or 0
        yoy = ((sales - sales_prev) / sales_prev * 100) if sales_prev > 0 else 0
        total_prods = db.query(ProductDict).filter(ProductDict.tenant_id == tenant_id, ProductDict.is_potential == True).count()
        covered = q.with_entities(func.count(func.distinct(SalesPotential.product_id))).scalar() or 0
        result.append({
            "dept": d.name,
            "sales": round(sales, 0),
            "sales_prev": round(sales_prev, 0),
            "yoy": round(yoy, 1),
            "coverage_pct": round(covered / total_prods * 100, 1) if total_prods else 0,
        })
    result.sort(key=lambda x: x["sales"], reverse=True)
    return result


def get_heatmap_data(db: Session, user_info: dict) -> dict:
    """产品宽度热力图（27 产品 × 覆盖率）"""
    tenant_id = user_info.get("tenant_id", 1)
    products = db.query(ProductDict).filter(ProductDict.tenant_id == tenant_id).order_by(ProductDict.sort_order).all()
    total_customers = _apply_scope(db.query(SalesWidth), SalesWidth, user_info).with_entities(
        func.count(func.distinct(SalesWidth.customer_name))).scalar() or 1

    prods = []
    for p in products:
        cnt = _apply_scope(db.query(SalesWidth), SalesWidth, user_info).filter(
            SalesWidth.product_id == p.id).with_entities(
            func.count(func.distinct(SalesWidth.customer_name))).scalar() or 0
        prods.append({
            "name": p.name,
            "rate": round(cnt / total_customers * 100, 1),
            "count": cnt,
            "is_potential": p.is_potential,
        })
    return {"products": prods, "total_customers": total_customers}


def get_team_matrix(db: Session, user_info: dict) -> list:
    """团队 × 潜力产品矩阵"""
    tenant_id = user_info.get("tenant_id", 1)
    groups = db.query(Group).filter(Group.tenant_id == tenant_id).all()
    prods = db.query(ProductDict).filter(ProductDict.tenant_id == tenant_id, ProductDict.is_potential == True).all()

    result = []
    for g in groups:
        row = {"team": g.name, "dept": None, "products": {}}
        dept = db.query(Department).filter(Department.id == g.dept_id).first()
        row["dept"] = dept.name if dept else ""
        for p in prods:
            amt = db.query(func.sum(SalesPotential.amount)).filter(
                SalesPotential.group_id == g.id,
                SalesPotential.product_id == p.id,
                SalesPotential.tenant_id == tenant_id,
            ).scalar() or 0
            amt_prev = db.query(func.sum(SalesPotential.amount_prev)).filter(
                SalesPotential.group_id == g.id,
                SalesPotential.product_id == p.id,
                SalesPotential.tenant_id == tenant_id,
            ).scalar() or 0
            row["products"][p.name] = {"amount": round(amt, 0), "amount_prev": round(amt_prev, 0)}
        result.append(row)
    return result


def get_customer_list(db: Session, user_info: dict, limit: int = 20) -> list:
    """客户维度的产品覆盖列表"""
    query = _apply_scope(db.query(SalesWidth), SalesWidth, user_info)
    # 按客户聚合
    customers = query.with_entities(
        SalesWidth.customer_name,
        func.count(func.distinct(SalesWidth.product_id)).label("width"),
        func.sum(SalesWidth.amount).label("amount"),
    ).group_by(SalesWidth.customer_name).order_by(func.count(func.distinct(SalesWidth.product_id)).desc()).limit(limit).all()

    return [{"name": c[0], "width": c[1], "amount": round(c[2], 1)} for c in customers]
