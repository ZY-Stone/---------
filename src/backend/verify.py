"""联调验证脚本 — 覆盖数据一致性、导入、查询、性能"""
import json, time, urllib.request, urllib.error, sys, os
from io import BytesIO

BASE = "http://127.0.0.1:8800"
PASS, FAIL = 0, 0
token = None

def ok(name, elapsed=0):
    global PASS; PASS += 1
    t = f" ({elapsed:.2f}s)" if elapsed else ""
    print(f"  PASS {name}{t}")

def err(name, msg):
    global FAIL; FAIL += 1
    print(f"  FAIL {name} — {msg[:120]}")

def login():
    data = json.dumps({"username":"admin","password":"admin123"}).encode()
    req = urllib.request.Request(BASE+"/api/auth/login", data=data, headers={"Content-Type":"application/json"})
    resp = urllib.request.urlopen(req, timeout=5)
    return json.loads(resp.read())["token"]

def GET(path):
    req = urllib.request.Request(BASE+path, headers={"Authorization": f"Bearer {token}"})
    resp = urllib.request.urlopen(req, timeout=10)
    return resp.getcode(), json.loads(resp.read())

def POST(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(BASE+path, data=body, headers={"Content-Type":"application/json", "Authorization": f"Bearer {token}"})
    resp = urllib.request.urlopen(req, timeout=10)
    return resp.getcode(), json.loads(resp.read())

print("=" * 60)
print("  产品分析一体化平台 — 联调验证")
print("=" * 60)

# ---- 1. 认证 ----
print("\n--- 1. 认证 ---")
token = login()
ok("1.1 登录成功")
try:
    data = json.dumps({"username":"admin","password":"wrong"}).encode()
    req = urllib.request.Request(BASE+"/api/auth/login", data=data, headers={"Content-Type":"application/json"})
    urllib.request.urlopen(req)
    err("1.2 错误密码", "应返回401但成功了")
except urllib.error.HTTPError as e:
    if e.code == 401: ok("1.2 错误密码返回401")
    else: err("1.2", f"期望401实际{e.code}")

# ---- 2. 数据查询 ----
print("\n--- 2. 数据查询一致性 ---")
s, r = GET("/api/products?page=1&size=5")
if s == 200 and "data" in r and len(r["data"]) <= 5:
    ok("2.1 产品列表分页")
else: err("2.1", f"status={s} data_rows={len(r.get('data',[]))}")

s, r = GET("/api/products?is_potential=true")
if s == 200 and all(p.get("isPotential") for p in r.get("data", [])):
    ok("2.2 潜力产品筛选")
else: err("2.2", "筛选不正确")

s, r = GET("/api/products/1")
need = ["id","name","alias","category","isPotential","sortOrder"]
if s == 200 and all(k in r for k in need):
    ok("2.3 产品详情字段完整")
else: err("2.3", f"缺字段")

try:
    GET("/api/products/99999")
    err("2.4 404", "应返回404")
except urllib.error.HTTPError as e:
    if e.code == 404: ok("2.4 产品不存在→404")
    else: err("2.4", f"期望404实际{e.code}")

# ---- 3. 趋势 ----
print("\n--- 3. 趋势数据 ---")
s, r = GET("/api/products/1/trends?start_date=2025-08&end_date=2026-07")
if s == 200 and len(r) == 12: ok("3.1 连续12个月")
else: err("3.1", f"status={s} periods={len(r)}")

if s == 200 and len(r) >= 2:
    if r[0]["period"] == "2025-08" and r[-1]["period"] == "2026-07":
        ok("3.2 起止月份正确")
    else: err("3.2", f"start={r[0]['period']} end={r[-1]['period']}")
    if all(all(k in p for k in ["period","sales","salesPrev"]) for p in r):
        ok("3.3 字段格式一致")
    else: err("3.3", "字段不一致")

# ---- 4. 导入 ----
print("\n--- 4. 导入功能 ---")
try:
    import requests, openpyxl
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["产品名称","别名","品类","潜力产品","排序"])
    name = f"验证-{int(time.time())}"
    ws.append([name, "测试", "前端", "否", 88])
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    r = requests.post(BASE+"/api/products/import",
        files={"file": ("test.xlsx", buf)}, headers={"Authorization": f"Bearer {token}"})
    data = r.json()
    if data.get("ok") and data.get("success", 0) > 0:
        ok("4.1 xlsx导入成功")
    else: err("4.1", f"fail={data.get('fail')} errors={data.get('errors')}")
except ImportError:
    print("  SKIP 4.1 (requests/openpyxl not available)")

# ---- 5. 分析 API ----
print("\n--- 5. 分析 API ---")
endpoints = [
    ("总览", "/api/analytics/dashboard/overview"),
    ("宽度KPI", "/api/analytics/width/kpi"),
    ("宽度分布", "/api/analytics/width/distribution"),
    ("宽度团队", "/api/analytics/width/team"),
    ("宽度客户分析", "/api/analytics/width/customer-analysis"),
    ("宽度用户分析", "/api/analytics/width/user-analysis"),
    ("宽度热力图", "/api/analytics/width/heatmap"),
    ("潜力KPI", "/api/analytics/potential/kpi"),
    ("潜力产品排名", "/api/analytics/potential/product-ranking"),
    ("潜力部门排名", "/api/analytics/potential/dept-ranking"),
    ("潜力四象限", "/api/analytics/potential/quadrant"),
    ("潜力客户分层", "/api/analytics/potential/cust-segments"),
    ("潜力团队矩阵", "/api/analytics/potential/team-matrix"),
    ("潜力用户推广", "/api/analytics/potential/user-promotion"),
    ("潜力用户明细", "/api/analytics/potential/user-cust-details"),
    ("潜力汇总", "/api/analytics/potential/summary"),
]
for name, path in endpoints:
    try:
        s, r = GET(path)
        if s == 200: ok(f"5.{endpoints.index((name,path))+1} {name}")
        else: err(f"5.{endpoints.index((name,path))+1} {name}", f"HTTP {s}")
    except Exception as e:
        err(f"5.{endpoints.index((name,path))+1} {name}", str(e))

# ---- 6. 管理 ----
print("\n--- 6. 管理 API ---")
s, r = GET("/api/admin/users")
if s == 200 and isinstance(r, list): ok("6.1 用户列表")
else: err("6.1", f"status={s}")

s, r = GET("/api/admin/departments")
if s == 200 and isinstance(r, list): ok("6.2 部门列表")
else: err("6.2", f"status={s}")

# ---- 7. 备份 ----
print("\n--- 7. 备份 ---")
s, r = GET("/api/backup/list")
if s == 200 and isinstance(r, list): ok("7.1 备份列表")
else: err("7.1", f"status={s}")

# ---- 8. 性能 ----
print("\n--- 8. 性能 ---")
start = time.time(); s, r = GET("/api/products?size=50"); elapsed = time.time() - start
if s == 200 and elapsed < 0.5: ok("8.1 产品列表 <500ms", elapsed)
elif elapsed >= 0.5: err("8.1", f"{elapsed:.2f}s > 0.5s")
else: err("8.1", f"HTTP {s}")

start = time.time(); s, r = GET("/api/analytics/potential/summary"); elapsed = time.time() - start
if s == 200 and elapsed < 2.0: ok("8.2 分析API <2s", elapsed)
elif elapsed >= 2.0: err("8.2", f"{elapsed:.2f}s > 2s")
else: err("8.2", f"HTTP {s}")

# ----
print("\n" + "=" * 60)
total = PASS + FAIL
print(f"  结果: {PASS} 通过 / {FAIL} 失败 (共 {total})")
if FAIL == 0: print("  ✅ 全部通过")
else: print(f"  ❌ {FAIL} 项失败")
print("=" * 60)
