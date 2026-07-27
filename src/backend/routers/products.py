"""产品字典 CRUD API + 趋势 + 导入"""
from io import BytesIO, StringIO
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from database import get_db
from models.product_dict import ProductDict
from models.sales_data import PotentialCust

# ---- Pydantic Schemas ----
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="产品名称")
    alias: str = Field("", max_length=100, description="别名")
    category: str = Field("", max_length=50, description="品类")
    isPotential: bool = Field(False, alias="is_potential", description="是否潜力产品")
    sortOrder: int = Field(0, alias="sort_order", description="排序序号")

    class Config:
        populate_by_name = True

class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    alias: str | None = Field(None, max_length=100)
    category: str | None = Field(None, max_length=50)
    isPotential: bool | None = Field(None, alias="is_potential")
    sortOrder: int | None = Field(None, alias="sort_order")

    class Config:
        populate_by_name = True

router = APIRouter(prefix="/api/products", tags=["产品字典"])

# ============================================================
# GET /api/products — 产品列表
# 前端对应: Admin.tsx 产品字典 Tab（潜力产品清单 + 全量产品字典）
# 返回示例:
# {
#   "data": [
#     { "id": 1, "name": "IPC", "alias": "网络摄像机", "category": "前端",
#       "isPotential": true, "sortOrder": 1 }
#   ],
#   "total": 36,
#   "page": 1,
#   "size": 20
# }
# ============================================================
@router.get("")
def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    keyword: str = Query("", description="搜索产品名/别名"),
    category: str = Query("", description="品类筛选"),
    is_potential: bool | None = Query(None, description="潜力产品筛选"),
    sort_by: str = Query("sortOrder", description="排序字段"),
    db: Session = Depends(get_db),
):
    q = db.query(ProductDict)

    # 搜索
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            (ProductDict.name.ilike(kw)) | (ProductDict.alias.ilike(kw))
        )
    # 品类筛选
    if category:
        q = q.filter(ProductDict.category == category)
    # 潜力产品筛选
    if is_potential is not None:
        q = q.filter(ProductDict.is_potential == is_potential)

    total = q.count()
    q = q.order_by(getattr(ProductDict, sort_by, ProductDict.sort_order))
    rows = q.offset((page - 1) * size).limit(size).all()

    # 转为前端期望格式（camelCase）
    data = [{
        "id": r.id,
        "name": r.name,
        "alias": r.alias or "",
        "category": r.category or "",
        "isPotential": bool(r.is_potential),
        "sortOrder": r.sort_order,
    } for r in rows]

    return {"data": data, "total": total, "page": page, "size": size}


# ============================================================
# GET /api/products/{id} — 产品详情
# 前端对应: Admin.tsx 产品字典编辑弹窗
# 返回示例:
# {
#   "id": 1, "name": "IPC", "alias": "网络摄像机", "category": "前端",
#   "isPotential": true, "sortOrder": 1
# }
# ============================================================
@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    r = db.query(ProductDict).filter(ProductDict.id == product_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="产品不存在")

    return {
        "id": r.id,
        "name": r.name,
        "alias": r.alias or "",
        "category": r.category or "",
        "isPotential": bool(r.is_potential),
        "sortOrder": r.sort_order,
    }


# ============================================================
# POST /api/products — 新增产品
# 前端对应: Admin.tsx 「➕ 新增产品」
# 请求示例: { "name": "测试产品", "alias": "测试", "category": "前端", "isPotential": false, "sortOrder": 99 }
# 返回示例: { "id": 37, "name": "测试产品", ... }
# N+1 检查: 单次 INSERT，无关联查询 ✅
# ============================================================
@router.post("", status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    # 检查重名
    existing = db.query(ProductDict).filter(ProductDict.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"产品 '{body.name}' 已存在")

    rec = ProductDict(
        tenant_id=1,
        name=body.name,
        alias=body.alias,
        category=body.category,
        is_potential=body.isPotential,
        sort_order=body.sortOrder,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "id": rec.id,
        "name": rec.name,
        "alias": rec.alias or "",
        "category": rec.category or "",
        "isPotential": bool(rec.is_potential),
        "sortOrder": rec.sort_order,
    }


# ============================================================
# PUT /api/products/{id} — 更新产品
# 前端对应: Admin.tsx 「✏️」编辑产品
# 请求示例: { "name": "新名称", "category": "后端" }
# 返回示例: { "id": 37, "name": "新名称", "category": "后端", ... }
# N+1 检查: 单次 UPDATE，无关联查询 ✅
# ============================================================
@router.put("/{product_id}")
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    rec = db.query(ProductDict).filter(ProductDict.id == product_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="产品不存在")

    # 只更新传入的字段
    update_data = body.model_dump(exclude_unset=True, by_alias=False)
    # Pydantic alias → DB field mapping
    if "is_potential" in update_data:
        rec.is_potential = update_data["is_potential"]
    if "sort_order" in update_data:
        rec.sort_order = update_data["sort_order"]
    for field in ["name", "alias", "category"]:
        if field in update_data:
            setattr(rec, field, update_data[field])

    db.commit()
    db.refresh(rec)

    return {
        "id": rec.id,
        "name": rec.name,
        "alias": rec.alias or "",
        "category": rec.category or "",
        "isPotential": bool(rec.is_potential),
        "sortOrder": rec.sort_order,
    }


# ============================================================
# DELETE /api/products/{id} — 删除产品
# 前端对应: Admin.tsx 「🗑」删除产品
# 返回示例: { "ok": true, "id": 37 }
# N+1 检查: 单次 DELETE，无关联查询 ✅
# 约束: 有销售数据引用的产品不可删除
# ============================================================
@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    rec = db.query(ProductDict).filter(ProductDict.id == product_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="产品不存在")

    # 检查是否有销售数据引用（旧表）
    from models.sales_data import SalesWidth, SalesPotential
    ref_width = db.query(SalesWidth).filter(SalesWidth.product_id == product_id).first()
    ref_potential = db.query(SalesPotential).filter(SalesPotential.product_id == product_id).first()
    if ref_width or ref_potential:
        raise HTTPException(status_code=400, detail="该产品已有销售数据，不可删除。建议修改产品状态代替删除")

    db.delete(rec)
    db.commit()

    return {"ok": True, "id": product_id}


# ============================================================
# POST /api/products/import — 文件批量导入产品字典
# 前端对应: Admin.tsx 产品字典 Tab 上传
# 格式: multipart/form-data, field name = "file"
# 支持: .xlsx / .csv
# Upsert: name 重复则更新，否则新增
# 返回示例:
# {
#   "ok": true, "total": 50, "success": 48, "fail": 2,
#   "errors": [{"row": 3, "field": "name", "msg": "产品名称为空"}]
# }
# N+1 检查: 单次 load + batch insert ✅
# ============================================================
_REQUIRED_FIELDS = ["name"]

@router.post("/import")
async def import_products(
    file: UploadFile = File(...),
    skip_errors: bool = Query(True, description="跳过错误继续"),
    db: Session = Depends(get_db),
):
    # ---- 格式校验 ----
    filename = file.filename or ""
    if not (filename.endswith(".xlsx") or filename.endswith(".xls") or filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls / .csv 格式")

    # ---- 读取文件到内存 ----
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件为空")

    # ---- 解析 (openpyxl / csv) ----
    try:
        import csv as _csv
        rows_raw: list[list[str]] = []
        if filename.endswith(".csv"):
            text = content.decode("utf-8-sig")
            reader = _csv.reader(StringIO(text))
            rows_raw = list(reader)
        else:
            import openpyxl
            wb = openpyxl.load_workbook(BytesIO(content))
            ws = wb.active
            rows_raw = [[str(c.value) if c.value is not None else "" for c in row] for row in ws.iter_rows()]
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"缺少依赖: {e.name}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    if len(rows_raw) < 2:
        raise HTTPException(status_code=400, detail="文件中无数据行（需要表头+至少一行数据）")

    headers = [str(h).strip() for h in rows_raw[0]]
    data_rows = rows_raw[1:]

    # ---- 列名映射 (header index → logical name) ----
    col_map = {
        "产品名称": "name", "name": "name",
        "别名": "alias", "alias": "alias",
        "品类": "category", "category": "category", "分类": "category",
        "潜力产品": "isPotential", "potential": "isPotential",
        "排序": "sortOrder", "sort": "sortOrder",
    }
    col_index: dict[str, int] = {}
    for i, h in enumerate(headers):
        key = col_map.get(h, "")
        if key:
            col_index[key] = i

    if "name" not in col_index:
        raise HTTPException(status_code=400, detail="文件缺少\"产品名称\"列")

    # ---- 校验 & 批量 Upsert ----
    success, fail = 0, 0
    errors: list[dict] = []
    existing_names = {r.name: r for r in db.query(ProductDict).all()}

    for ri, row in enumerate(data_rows):
        row_num = ri + 2
        def _cell(key): return str(row[col_index[key]]).strip() if col_index.get(key, -1) < len(row) else ""
        name = _cell("name")

        # 必填校验
        if not name:
            fail += 1
            errors.append({"row": row_num, "field": "name", "msg": "产品名称为空"})
            if not skip_errors:
                db.rollback()
                return {"ok": False, "total": len(data_rows), "success": 0, "fail": fail, "errors": errors, "message": "校验失败，已回滚"}
            continue

        # Upsert
        if name in existing_names:
            rec = existing_names[name]
            if "alias" in col_index: rec.alias = _cell("alias")[:100]
            if "category" in col_index: rec.category = _cell("category")[:50]
            if "isPotential" in col_index:
                v = _cell("isPotential").lower()
                rec.is_potential = v in ("true", "1", "yes", "是", "✓")
        else:
            is_pot = _cell("isPotential").lower() in ("true", "1", "yes", "是", "✓")
            sort_v = _cell("sortOrder")
            rec = ProductDict(
                tenant_id=1, name=name,
                alias=_cell("alias")[:100] if "alias" in col_index else "",
                category=_cell("category")[:50] if "category" in col_index else "",
                is_potential=is_pot,
                sort_order=int(sort_v) if sort_v.lstrip("-").isdigit() else 0,
            )
            existing_names[name] = rec
            db.add(rec)
        success += 1

    # 批量提交
    db.commit()

    return {
        "ok": True, "total": len(data_rows), "success": success, "fail": fail,
        "errors": errors,
        "message": f"导入完成：成功 {success} 条" + (f"，失败 {fail} 条" if fail else ""),
    }


# ============================================================
# GET /api/products/{id}/trends — 产品历史趋势
# 前端对应: Potential Product Tab 趋势图 (chart-p-yoy)
# 数据源: potential_cust 按月聚合本期/同期销售额
# 日期补零: 使用 Pandas date_range 生成连续月份
# 返回示例:
# [
#   { "period": "2025-08", "sales": 1200.5, "salesPrev": 980.3 },
#   { "period": "2025-09", "sales": 1320.1, "salesPrev": 1050.0 },
#   ...
# ]
# N+1 检查: 单次 GROUP BY 查询 ✅
# ============================================================
@router.get("/{product_id}/trends")
def product_trends(
    product_id: int,
    start_date: str = Query("2025-08", description="开始期间 YYYY-MM"),
    end_date: str = Query("2026-07", description="结束期间 YYYY-MM"),
    granularity: str = Query("month", description="聚合粒度: month(仅支持月)"),
    db: Session = Depends(get_db),
):
    # 获取产品名
    prod = db.query(ProductDict).filter(ProductDict.id == product_id).first()
    product_name = prod.name if prod else None
    if not product_name:
        raise HTTPException(status_code=404, detail="产品不存在")

    # 查询该产品按月聚合的本期/同期
    rows = (
        db.query(
            PotentialCust.period,
            func.sum(PotentialCust.amount).label("sales"),
            func.sum(PotentialCust.amount_prev).label("salesPrev"),
        )
        .filter(PotentialCust.product == product_name)
        .filter(PotentialCust.period >= start_date.replace("-", ""), PotentialCust.period <= end_date.replace("-", ""))
        .group_by(PotentialCust.period)
        .order_by(PotentialCust.period)
        .all()
    )

    # 构建查询结果字典
    actual = {r.period: {"sales": round(r.sales or 0, 1), "salesPrev": round(r.salesPrev or 0, 1)} for r in rows}

    # 生成连续月份序列（使用 Pandas）
    try:
        import pandas as pd
        months = pd.date_range(start=start_date, end=end_date, freq="MS")
        period_list = [d.strftime("%Y-%m") for d in months]
    except ImportError:
        # Fallback: 手工生成
        start_y, start_m = int(start_date[:4]), int(start_date[5:7])
        end_y, end_m = int(end_date[:4]), int(end_date[5:7])
        period_list = []
        y, m = start_y, start_m
        while (y < end_y) or (y == end_y and m <= end_m):
            period_list.append(f"{y}-{m:02d}")
            m += 1
            if m > 12:
                m = 1
                y += 1

    # 输出连续数据（缺失月份补零）
    result = []
    for p in period_list:
        key = p.replace("-", "")
        result.append({
            "period": p,
            "sales": actual.get(key, {}).get("sales", 0),
            "salesPrev": actual.get(key, {}).get("salesPrev", 0),
        })

    return result
