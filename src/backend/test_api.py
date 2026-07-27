"""后端 API 全面验证脚本 — 测试所有功能模块"""
import json, urllib.request, sys

BASE = "http://127.0.0.1:8800"
ok = 0; fail = 0

def test(method, path, data=None, expect_status=200, desc=""):
    global ok, fail
    try:
        url = BASE + path
        if data:
            body = json.dumps(data).encode()
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method=method)
        else:
            req = urllib.request.Request(url, method=method)
        resp = urllib.request.urlopen(req, timeout=10)
        status = resp.getcode()
        result = json.loads(resp.read())
        if status == expect_status:
            ok += 1
            print(f"  [OK] {desc:40s} → {status}")
        else:
            fail += 1
            print(f"  [FAIL] {desc:40s} → {status} (expected {expect_status})")
        return result
    except Exception as e:
        fail += 1
        print(f"  [FAIL] {desc:40s} → {e}")

# ===== 1. 认证 =====
print("\n=== 1. Auth ===")
r = test("POST", "/api/auth/login", {"username": "admin", "password": "admin123"}, desc="Login")
token = r.get("token", "") if r else ""

def auth_req(method, path, data=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }, method=method)
    resp = urllib.request.urlopen(req, timeout=10)
    return resp.getcode(), json.loads(resp.read())

# ===== 2. 数据导入 (写入测试数据) =====
print("\n=== 2. Import ===")
cust_data = {"rows": [{
    "dept2": "深圳", "dept3": "客户销售一部", "dept4": "客户销售一组", "group": "客户销售一组", "dept": "客户销售一部",
    "sales": "张栋柱", "contact": "姚金成", "product": "出入口停车",
    "custName": "测试客户A", "amount": 100, "amountPrev": 80,
    "qty": 10, "qtyPrev": 8, "opps": 3, "oppsPrev": 2, "users": 5, "usersPrev": 4,
}]}
s, r = auth_req("POST", "/api/import/potential-cust", cust_data)
print(f"  {'[OK]' if s==200 else '[FAIL]'} Import potential-cust → {s} {r.get('count',0)} rows")

width_data = {"type": "user", "rows": [{
    "siebel": "1-ABC", "industry": "电子政务", "user": "测试用户A",
    "sales": "张栋柱", "dept": "客户销售一部", "guishang": "是",
    "width": 5, "prods": '{"IPC":1,"NVR":1,"门禁":1}',
    "contact": "姚金成", "level": "头部用户"
}]}
s, r = auth_req("POST", "/api/import/width-records", width_data)
print(f"  {'[OK]' if s==200 else '[FAIL]'} Import width-records → {s} {r.get('count',0)} rows")

# ===== 3. 数据查询 =====
print("\n=== 3. Query ===")
s, r = auth_req("GET", "/api/potential/kpi")
print(f"  {'[OK]' if s==200 and r.get('kpi',{}).get('totalSales',0)>0 else '[FAIL]'} Potential KPI → sales={r.get('kpi',{}).get('totalSales',0)}")

s, r = auth_req("GET", "/api/potential/cust-table?page=1&size=10")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Potential cust-table → {r.get('total',0)} rows")

s, r = auth_req("GET", "/api/potential/products")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Potential products → {r.get('products',[])}")

s, r = auth_req("GET", "/api/analytics/width/kpi")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Width KPI → avgWidth={r.get('avgWidth',0)}")

s, r = auth_req("GET", "/api/analytics/potential/summary")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Potential summary → kpi={r.get('kpi',{}).get('totalSales',0)}")

# ===== 4. 数据导出 =====
print("\n=== 4. Export ===")
try:
    url = BASE + "/api/export/width"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    resp = urllib.request.urlopen(req, timeout=10)
    ct = resp.headers.get("Content-Type", "")
    ok_export = resp.getcode() == 200 and ("spreadsheet" in ct or "excel" in ct or "octet-stream" in ct)
    print(f"  {'[OK]' if ok_export else '[FAIL]'} Export width → {resp.getcode()} ({ct[:50]})")
except Exception as e:
    print(f"  [FAIL] Export → {e}")

# ===== 5. 管理 =====
print("\n=== 5. Admin ===")
s, r = auth_req("GET", "/api/admin/users")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Admin users → {len(r) if isinstance(r, list) else r}")

s, r = auth_req("GET", "/api/admin/departments")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Departments → {len(r) if isinstance(r, list) else r}")

# ===== 6. 备份 =====
print("\n=== 6. Backup ===")
s, r = auth_req("POST", "/api/backup/create")
print(f"  {'[OK]' if s==200 else '[FAIL]'} Create backup → {s}")
s, r = auth_req("GET", "/api/backup/list")
print(f"  {'[OK]' if s==200 else '[FAIL]'} List backups → {r}")

# ===== 7. Analytics 全部端点 =====
print("\n=== 7. Analytics ===")
endpoints = [
    ("GET", "/api/analytics/dashboard/overview", "Dashboard"),
    ("GET", "/api/analytics/width/coverage", "Width Coverage"),
    ("GET", "/api/analytics/width/team-dimension", "Width Team"),
    ("GET", "/api/analytics/width/heatmap", "Width Heatmap"),
    ("GET", "/api/analytics/width/cross-sell", "Width Cross-sell"),
    ("GET", "/api/analytics/potential/kpi", "Pot KPI"),
    ("GET", "/api/analytics/potential/product-ranking", "Pot Product Rank"),
    ("GET", "/api/analytics/potential/dept-ranking", "Pot Dept Rank"),
    ("GET", "/api/analytics/potential/cust-segments", "Pot Cust Segments"),
    ("GET", "/api/analytics/potential/team-matrix", "Pot Team Matrix"),
    ("GET", "/api/analytics/potential/user-promotion", "Pot User Promo"),
]
for method, path, desc in endpoints:
    s, r = auth_req(method, path)
    print(f"  {'[OK]' if s==200 else '[FAIL]'} {desc:25s} → {s}")

print(f"\nTotal: {ok} passed, {fail} failed out of {ok+fail}")
