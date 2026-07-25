"""潜力产品查询 API"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.sales_data import PotentialCust, PotentialUser

router = APIRouter(prefix="/api/potential", tags=["潜力产品查询"])

@router.get("/cust-table")
def get_cust_table(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    product: str = Query("", description="产品筛选"),
    dept: str = Query("", description="部门筛选"),
    db: Session = Depends(get_db),
):
    """分页查询客户维度数据"""
    q = db.query(PotentialCust)
    if product:
        q = q.filter(PotentialCust.product == product)
    if dept:
        q = q.filter(PotentialCust.dept3 == dept)
    total = q.count()
    rows = q.order_by(PotentialCust.amount.desc()).offset((page - 1) * size).limit(size).all()
    return {
        "total": total, "page": page, "size": size,
        "rows": [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]
    }

@router.get("/user-table")
def get_user_table(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """分页查询用户维度数据"""
    q = db.query(PotentialUser)
    total = q.count()
    rows = q.order_by(PotentialUser.out_amt.desc()).offset((page - 1) * size).limit(size).all()
    return {
        "total": total, "page": page, "size": size,
        "rows": [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]
    }

@router.get("/kpi")
def get_potential_kpi(dept: str = Query("", description="部门筛选"), db: Session = Depends(get_db)):
    """潜力产品 KPI 聚合"""
    q = db.query(PotentialCust)
    if dept:
        q = q.filter(PotentialCust.dept3 == dept)

    total_sales = q.with_entities(func.sum(PotentialCust.amount)).scalar() or 0
    total_prev = q.with_entities(func.sum(PotentialCust.amount_prev)).scalar() or 0
    product_count = q.with_entities(func.count(func.distinct(PotentialCust.product))).scalar() or 0
    customer_count = q.with_entities(func.count(func.distinct(PotentialCust.cust_name))).scalar() or 0

    # 按产品排名
    prod_ranking = (
        q.with_entities(
            PotentialCust.product,
            func.sum(PotentialCust.amount).label("sales"),
            func.sum(PotentialCust.amount_prev).label("prev"),
        ).group_by(PotentialCust.product).order_by(func.sum(PotentialCust.amount).desc()).all()
    )

    # 按部门排名
    dept_ranking = (
        q.with_entities(
            PotentialCust.dept3,
            func.sum(PotentialCust.amount).label("sales"),
            func.sum(PotentialCust.amount_prev).label("prev"),
            func.count(func.distinct(PotentialCust.product)).label("prod_cnt"),
        ).group_by(PotentialCust.dept3).order_by(func.sum(PotentialCust.amount).desc()).all()
    )

    return {
        "kpi": {
            "totalSales": round(total_sales, 1),
            "totalPrev": round(total_prev, 1),
            "yoyGrowth": round((total_sales - total_prev) / total_prev * 100, 1) if total_prev else 0,
            "productCount": product_count,
            "customerCount": customer_count,
            "avgPrice": round(total_sales / customer_count, 1) if customer_count else 0,
        },
        "productRanking": [
            {"product": r.product, "sales": round(r.sales, 1), "prev": round(r.prev or 0, 1),
             "yoy": round((r.sales - (r.prev or 0)) / (r.prev or 1) * 100, 1)}
            for r in prod_ranking
        ],
        "deptRanking": [
            {"name": r.dept3 or "未知", "sales": round(r.sales, 1), "prev": round(r.prev or 0, 1),
             "yoy": round((r.sales - (r.prev or 0)) / (r.prev or 1) * 100, 1),
             "productCount": r.prod_cnt}
            for r in dept_ranking
        ],
    }

@router.get("/products")
def get_potential_products(db: Session = Depends(get_db)):
    """获取所有潜力产品列表"""
    prods = (
        db.query(PotentialCust.product, func.count(PotentialCust.id).label("cnt"))
        .group_by(PotentialCust.product).order_by(func.count(PotentialCust.id).desc()).all()
    )
    return {"products": [{"name": p.product, "count": p.cnt} for p in prods]}

@router.get("/depts")
def get_potential_depts(db: Session = Depends(get_db)):
    """获取所有部门列表"""
    depts = (
        db.query(PotentialCust.dept3).group_by(PotentialCust.dept3).order_by(PotentialCust.dept3).all()
    )
    return {"depts": [d[0] for d in depts if d[0]]}
