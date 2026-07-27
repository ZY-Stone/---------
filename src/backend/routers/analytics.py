"""Analytics API — all responses aligned with frontend Zustand Store expectations"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from services.analytics_service import (
    get_width_kpi, get_width_distribution, get_width_team,
    get_width_customer_analysis, get_width_user_analysis,
    get_width_heatmap, get_width_cross_sell,
    get_potential_kpi, get_potential_product_ranking, get_potential_dept_ranking,
    get_potential_cust_segments, get_potential_quadrant,
    get_potential_team_matrix, get_potential_user_promotion,
    get_potential_user_cust_details,
)

router = APIRouter(prefix="/api/analytics", tags=["数据分析"])

# ==================== 产品宽度 ====================

@router.get("/width/kpi")
def width_kpi(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: width.kpi + width.productCoverage"""
    kpi = get_width_kpi(db, dept)
    return {"kpi": {
        "avgWidth": kpi["avgWidth"], "scaleUsers": kpi["scaleUsers"],
        "scaleCustomers": kpi["scaleCustomers"], "coverage": kpi["coverage"],
        "widthYoY": kpi["widthYoY"], "customersMoM": kpi["customersMoM"],
        "coverageYoY": kpi["coverageYoY"],
    }, "productCoverage": kpi.get("productCoverage", [])}

@router.get("/width/distribution")
def width_distribution(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: widthDistribution = { labels, data }"""
    return get_width_distribution(db, dept)

@router.get("/width/team")
def width_team(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: teamWidthRank = [{dept, avgWidth, count}]"""
    return get_width_team(db, dept)

@router.get("/width/customer-analysis")
def width_customer_analysis(db: Session = Depends(get_db)):
    """前端期望: customerAnalysis = { good: [...], bad: [...] }"""
    return get_width_customer_analysis(db)

@router.get("/width/user-analysis")
def width_user_analysis(db: Session = Depends(get_db)):
    """前端期望: userAnalysis = { good: [...], bad: [...] }"""
    return get_width_user_analysis(db)

@router.get("/width/heatmap")
def width_heatmap(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: heatmapData = { total, products: [{name, rate, count}] }"""
    return get_width_heatmap(db, dept)

@router.get("/width/cross-sell")
def width_cross_sell(limit: int = Query(10), db: Session = Depends(get_db)):
    """前端期望: crossSell = { prods, matrix }"""
    return get_width_cross_sell(db, limit)

# ==================== 潜力产品 ====================

@router.get("/potential/kpi")
def potential_kpi(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: potential.kpi = { totalSales, productCount, ... }"""
    return {"kpi": get_potential_kpi(db, dept)}

@router.get("/potential/product-ranking")
def potential_product_ranking(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: productRanking = [{product, sales, prev, yoy, type}]"""
    return {"productRanking": get_potential_product_ranking(db, dept)}

@router.get("/potential/dept-ranking")
def potential_dept_ranking(db: Session = Depends(get_db)):
    """前端期望: deptRanking = [{name, sales, prev, yoy, productCount}]"""
    return {"deptRanking": get_potential_dept_ranking(db)}

@router.get("/potential/quadrant")
def potential_quadrant(db: Session = Depends(get_db)):
    """前端期望: quadrant = [{product, x, y, amount, quadrant}]"""
    return {"quadrant": get_potential_quadrant(db)}

@router.get("/potential/cust-segments")
def potential_cust_segments(limit: int = Query(30), db: Session = Depends(get_db)):
    """前端期望: customerSegments = [{name, sales, productCount}]"""
    return {"customerSegments": get_potential_cust_segments(db, limit)}

@router.get("/potential/team-matrix")
def potential_team_matrix(db: Session = Depends(get_db)):
    return get_potential_team_matrix(db)

@router.get("/potential/user-promotion")
def potential_user_promotion(db: Session = Depends(get_db)):
    """前端期望: userPromotion = [{user, amount, productCount, custCount}]"""
    return {"userPromotion": get_potential_user_promotion(db)}

@router.get("/potential/user-cust-details")
def potential_user_cust_details(db: Session = Depends(get_db)):
    """前端期望: userCustDetails = [{user, cust, amount}]"""
    return {"userCustDetails": get_potential_user_cust_details(db)}

@router.get("/potential/top10")
def potential_top10(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: top10 = [{product, sales, prev, yoy, type}]"""
    return {"top10": get_potential_product_ranking(db, dept)[:10]}

@router.get("/potential/summary")
def potential_summary(dept: str = Query(""), db: Session = Depends(get_db)):
    """前端期望: { kpi: {...}, top10: [...], deptRanking: [...], prodComposition: [...], quadrant: [...] }"""
    kpi = get_potential_kpi(db, dept)
    top10 = get_potential_product_ranking(db, dept)[:10]
    dept_rank = get_potential_dept_ranking(db)
    # prodComposition from product ranking
    ranking = get_potential_product_ranking(db, dept)
    import math
    prodComposition = [{"name": p["product"], "amount": p["sales"]} for p in ranking]
    quadrant = get_potential_quadrant(db)
    return {
        "kpi": kpi, "top10": top10, "deptRanking": dept_rank,
        "prodComposition": prodComposition, "quadrant": quadrant,
    }

@router.get("/dashboard/overview")
def dashboard_overview(db: Session = Depends(get_db)):
    wk = get_width_kpi(db)
    pk = get_potential_kpi(db)
    return {
        "width": {
            "avgWidth": wk["avgWidth"], "scaleUsers": wk["scaleUsers"],
            "scaleCustomers": wk["scaleCustomers"], "coverage": wk["coverage"],
        },
        "potential": {
            "totalSales": pk["totalSales"], "totalPrev": pk["totalPrev"],
            "yoyGrowth": pk["yoyGrowth"], "productCount": pk["productCount"],
            "customerCount": pk["customerCount"],
        }
    }
