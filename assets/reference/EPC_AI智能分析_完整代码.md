# EPC项目管理系统 — AI 智能分析 完整代码

> 提取日期：2026-07-16
> 涉及文件：`src/ai_service.py`、`src/app.py`（AI路由）、`src/templates/dashboard.html`（AI前端）

---

## 一、后端 — AI 服务核心模块 (`src/ai_service.py`)

```python
"""
EPC项目管理系统 - AI 智能分析服务模块
封装 AI 配置管理、Prompt 构建、MaaS API 通信、响应解析
"""
import json
import time
import urllib.request
import urllib.error
from database.db import get_setting, save_setting, get_ai_context


# ═══════════════════════════════════════════════════════════
#  配置常量
# ═══════════════════════════════════════════════════════════

AI_CONFIG_DEFAULTS = {
    "endpoint": "https://maas.hikvision.com.cn",
    "app_id": "",
    "api_key": "",
    "user": "",
    "model": "default",
    "temperature": 0.7,
    "max_tokens": 2048,
    "timeout": 300,
}

AVAILABLE_MODELS = [
    {"value": "default", "label": "默认模型"},
    {"value": "deepseek-v3", "label": "DeepSeek V3"},
    {"value": "deepseek-r1", "label": "DeepSeek R1（深度推理）"},
]


# ═══════════════════════════════════════════════════════════
#  自定义异常
# ═══════════════════════════════════════════════════════════

class AIConfigError(Exception):
    """AI 配置错误（缺少必要参数）"""
    pass


class AIAPIError(Exception):
    """AI API 调用错误"""
    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


class AITimeoutError(Exception):
    """AI API 超时"""
    pass


# ═══════════════════════════════════════════════════════════
#  AI 配置管理
# ═══════════════════════════════════════════════════════════

def get_ai_config():
    """从 settings 表读取 AI 配置，未设置时返回默认值"""
    raw = get_setting("ai_config")
    if raw:
        try:
            saved = json.loads(raw)
            config = dict(AI_CONFIG_DEFAULTS)
            config.update(saved)
            return config
        except Exception:
            pass
    return dict(AI_CONFIG_DEFAULTS)


def save_ai_config(config):
    """保存 AI 配置到 settings 表"""
    clean = {}
    for key in AI_CONFIG_DEFAULTS:
        if key in config:
            clean[key] = config[key]
    save_setting("ai_config", json.dumps(clean, ensure_ascii=False))


def validate_config(config):
    """验证配置是否完整，返回 (is_valid, error_message)"""
    if not config.get("endpoint"):
        return False, "请填写 API 地址"
    if not config.get("app_id"):
        return False, "请填写 App ID"
    if not config.get("api_key"):
        return False, "请填写 API Key"
    return True, ""


def check_connection(config, user=None):
    """测试 AI API 连接是否正常"""
    is_valid, err = validate_config(config)
    if not is_valid:
        return False, err

    base = (config.get("endpoint") or "").rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    url = f"{base}/apps/{config['app_id']}/api/v1/completion/block"

    api_user = user or config.get("user", "").strip() or "admin"
    req_body = json.dumps({
        "question": "你好，请回复'连接成功'",
        "user": api_user,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=req_body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", config["api_key"])

    try:
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read().decode("utf-8")
        try:
            result = json.loads(raw)
            if result.get("code") and result.get("code") != "0":
                return False, f"API 返回错误: {result.get('message', '未知错误')}"
        except json.JSONDecodeError:
            pass
        return True, "连接成功"
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:200]
        except Exception:
            pass
        return False, f"HTTP {e.code}: {body or str(e)}"
    except Exception as e:
        return False, f"连接失败: {str(e)}"


# ═══════════════════════════════════════════════════════════
#  Prompt 构建
# ═══════════════════════════════════════════════════════════

def build_analysis_prompt(question, rows, max_chars=8000):
    """
    构建分析 prompt：系统指令 + 问题 + 精简数据上下文
    rows: get_ai_context() 返回的项目数据列表（仅8列轻量数据）
    """
    ctx = f"EPC项目{len(rows)}个\n"
    skipped = 0
    for r in rows:
        nm = (r.get("项目名称") or "")[:18]
        fc = r.get("预计HK金额（万元）") or 0
        ac = r.get("实际总出货金额（万元）") or 0
        if fc == 0 and ac == 0:
            skipped += 1
            continue
        ctx += (
            f"{nm}|{r.get('行业', '')}|{r.get('区域', '')}|"
            f"{fc}|{ac}|{r.get('跟进人', '')}|{r.get('是否赢单', '否')}\n"
        )
    if skipped:
        ctx += f"(已跳过{skipped}个零金额项目)\n"

    prompt = (
        f"你是EPC项目管理分析助手。请根据以下项目数据，用中文回答问题。回答要具体、可操作。\n"
        f"问：{question}\n\n{ctx}"
    )

    if len(prompt) > max_chars:
        prompt = prompt[:max_chars] + "\n...(数据已截断)"

    return prompt


# ═══════════════════════════════════════════════════════════
#  MaaS API 通信
# ═══════════════════════════════════════════════════════════

def _parse_api_response(raw):
    """解析 API 返回：先尝试 JSON，再尝试 SSE"""
    # 1. 尝试 JSON 格式
    try:
        result = json.loads(raw)
        if result.get("code") and result.get("code") != "0":
            msg = result.get("message", "") or result.get("error", "") or "未知错误"
            raise AIAPIError(f"API 返回错误: {msg}", code=result.get("code"))
        content = (
            result.get("content")
            or result.get("answer")
            or result.get("data", {}).get("content")
            or result.get("data", {}).get("answer")
            or ""
        )
        if content:
            return content
    except json.JSONDecodeError:
        pass
    except AIAPIError:
        raise

    # 2. 尝试 SSE 格式（data: 前缀）
    answer_parts = []
    for line in raw.split("\n"):
        if line.startswith("data:"):
            try:
                chunk = json.loads(line[5:].strip())
                if chunk.get("answer"):
                    answer_parts.append(chunk["answer"])
            except json.JSONDecodeError:
                pass

    if answer_parts:
        return "".join(answer_parts)

    # 3. 无法解析
    raise AIAPIError(f"无法解析 API 响应: {raw[:200]}...")


def call_maas_api(prompt, config, user=None):
    """调用 MaaS API，返回解析后的文本内容"""
    base = (config.get("endpoint") or "https://maas.hikvision.com.cn").rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    url = f"{base}/apps/{config['app_id']}/api/v1/completion/block"

    api_user = user or config.get("user", "").strip() or "admin"
    timeout = int(config.get("timeout", 300))

    req_body = json.dumps({
        "question": prompt,
        "user": api_user,
        "temperature": float(config.get("temperature", 0.7)),
        "max_tokens": int(config.get("max_tokens", 2048)),
    }).encode("utf-8")

    req = urllib.request.Request(url, data=req_body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", config["api_key"])

    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        raw = resp.read().decode("utf-8")
        content = _parse_api_response(raw)
        return content

    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:300]
        except Exception:
            pass
        raise AIAPIError(f"API 请求失败 (HTTP {e.code})", code=e.code)

    except Exception as e:
        if "timed out" in str(e).lower() or "timeout" in str(e).lower():
            raise AITimeoutError("AI 服务响应超时，请稍后重试")
        raise AIAPIError(f"AI 调用失败: {str(e)}")


# ═══════════════════════════════════════════════════════════
#  高层封装 — 一站式分析
# ═══════════════════════════════════════════════════════════

def analyze(question, username=None, role="user", display_name=""):
    """
    一站式 AI 分析：
    1. 验证配置 → 2. 查询项目数据 → 3. 构建 prompt → 4. 调用 API → 5. 返回结果
    返回: {"status": "ok", "content": "...", "elapsed_ms": 123}
    失败: {"error": "...", "error_type": "config|api|timeout|unknown"}
    """
    t0 = time.time()

    config = get_ai_config()
    is_valid, err_msg = validate_config(config)
    if not is_valid:
        return {"error": err_msg, "error_type": "config"}

    rows = get_ai_context(username=username, role=role, display_name=display_name)
    t1 = time.time()

    prompt = build_analysis_prompt(question, rows)

    try:
        content = call_maas_api(prompt, config, user=display_name or username)
        elapsed = int((time.time() - t0) * 1000)
        return {"status": "ok", "content": content, "elapsed_ms": elapsed}
    except AIConfigError as e:
        return {"error": str(e), "error_type": "config"}
    except AIAPIError as e:
        return {"error": str(e), "error_type": "api"}
    except AITimeoutError as e:
        return {"error": str(e), "error_type": "timeout"}
    except Exception as e:
        return {"error": f"AI 分析异常: {str(e)}", "error_type": "unknown"}
```

---

## 二、后端 — AI API 路由 (`src/app.py` 片段)

```python
from ai_service import (
    get_ai_config, save_ai_config,
    check_connection as check_ai_connection,
    analyze as ai_analyze,
)

# ═══════════════════════════════════════════════════════════
#  AI 分析
# ═══════════════════════════════════════════════════════════

@app.route("/api/ai/config", methods=["GET"])
@login_required
def api_get_ai_config():
    return jsonify(get_ai_config())


@app.route("/api/ai/config", methods=["POST"])
@login_required
@admin_required
def api_save_ai_config():
    data = request.get_json()
    if not data:
        return jsonify({"error": "数据为空"}), 400
    save_ai_config(data)
    _log("save_ai_config", "", "AI配置已更新")
    return jsonify({"status": "ok"})


@app.route("/api/ai/config/test", methods=["POST"])
@login_required
@admin_required
def api_test_ai_config():
    """测试 AI 连接"""
    data = request.get_json() or {}
    config = {
        "endpoint": data.get("endpoint", "").strip(),
        "app_id": data.get("app_id", "").strip(),
        "api_key": data.get("api_key", "").strip(),
    }
    ok, msg = check_ai_connection(config, user=session.get("display_name"))
    return jsonify({"ok": ok, "message": msg})


@app.route("/api/ai/analyze", methods=["POST"])
@login_required
def api_ai_analyze():
    data = request.get_json()
    question = data.get("question", "").strip() if data else ""

    if not question:
        return jsonify({"error": "请输入分析内容"}), 400

    _log("ai_analyze", "", question[:200])

    result = ai_analyze(
        question,
        username=session.get("username"),
        role=session.get("role"),
        display_name=session.get("display_name", ""),
    )

    if result.get("error"):
        code = 400 if result.get("error_type") == "config" else 500
        return jsonify({"error": result["error"]}), code

    return jsonify(result)
```

---

## 三、数据库 — AI 轻量查询 (`src/database/db.py` 片段)

```python
def get_ai_context(username=None, role="user", display_name=""):
    """
    AI 分析专用轻量查询 — 仅查 8 列，比全量查询快 40%
    与 get_all_projects 权限逻辑一致
    """
    conn = get_connection()
    cols = "项目名称, 行业, 区域, 跟进人, 是否赢单, 预计HK金额（万元）, 实际总出货金额（万元）, 更新日期"
    query = f"SELECT {cols} FROM projects WHERE 1=1"
    params = []

    # 权限过滤
    if role == "user" and username:
        if display_name and display_name != username:
            query += " AND (跟进人 = ? OR 跟进人 = ? OR 跟进人 IS NULL OR 跟进人 = '')"
            params.extend([username, display_name])
        else:
            query += " AND (跟进人 = ? OR 跟进人 IS NULL OR 跟进人 = '')"
            params.append(username)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]
```

---

## 四、前端 — AI 界面 (`src/templates/dashboard.html` 片段)

### HTML 结构

```html
<!-- AI 智能分析 -->
<div class="chart-card full" style="margin-bottom:24px" id="aiSection">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <h3>🤖 AI 智能分析</h3>
    <div style="display:flex;gap:6px">
      <a onclick="switchAITab('analyze')" class="ai-tab active" id="tabAnalyze">🔍 智能分析</a>
      <a onclick="switchAITab('config')" class="ai-tab" id="tabConfig">⚙️ API配置</a>
    </div>
  </div>

  <!-- 分析Tab -->
  <div id="aiTabAnalyze">
    <div id="aiWelcome">
      <div>👋 你好！我是 EPC 项目管理智能助手</div>
      <div>我会读取项目数据库中的<b>全部项目数据</b>，结合你的问题给出分析。</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        <!-- 5个快捷提问按钮 -->
        <span onclick="aiQuick('全面分析项目数据...')">📊 全面分析</span>
        <span onclick="aiQuick('各产品线预测和实际出货对比...')">📦 产品线分析</span>
        <span onclick="aiQuick('分析各跟进人的项目数量和金额...')">👤 人员分析</span>
        <span onclick="aiQuick('哪些项目超过30天没有更新...')">⚠️ 异常预警</span>
        <span onclick="aiQuick('分析各行业项目分布和赢单率...')">🏭 行业策略</span>
      </div>
    </div>
    <div style="display:flex;gap:10px">
      <textarea id="aiPrompt" rows="3" placeholder="输入你的问题..."></textarea>
      <button onclick="doAIAnalyze()" id="aiAnalyzeBtn">🚀 开始分析</button>
    </div>
    <div id="aiResult" style="display:none"></div>
    <div id="aiResultBar" style="display:none">
      <span id="aiElapsed"></span>
      <button onclick="copyAIResult()">📋 复制结果</button>
      <button onclick="exportAIWord()">📄 导出Word</button>
    </div>
  </div>

  <!-- 配置Tab -->
  <div id="aiTabConfig" style="display:none">
    <!-- API地址 / App ID / API Key / 模型 / Temperature / MaxTokens / Timeout -->
    <button onclick="testAIConnection()">🔌 测试连接</button>
    <button onclick="saveAIConfig()">💾 保存配置</button>
  </div>
</div>
```

### JavaScript

```javascript
// ── AI 智能分析 ──

function aiQuick(q){
  document.getElementById('aiPrompt').value = q;
  doAIAnalyze();
}

function switchAITab(tab){
  document.getElementById('aiTabAnalyze').style.display = tab==='analyze' ? 'block' : 'none';
  document.getElementById('aiTabConfig').style.display = tab==='config' ? 'block' : 'none';
  document.getElementById('tabAnalyze').classList.toggle('active', tab==='analyze');
  document.getElementById('tabConfig').classList.toggle('active', tab==='config');
}

async function testAIConnection(e){
  var btn = e ? e.target : document.querySelector('#aiTabConfig button');
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '测试中...';
  var resultEl = document.getElementById('aiTestResult');
  resultEl.textContent = ''; resultEl.style.color = '#888';
  var data = {
    endpoint: document.getElementById('aiEndpoint').value.trim(),
    app_id: document.getElementById('aiAppId').value.trim(),
    api_key: document.getElementById('aiApiKey').value.trim()
  };
  try {
    var r = await fetch('/api/ai/config/test', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(20000)
    });
    var d = await r.json();
    if(d.ok){ resultEl.textContent = '✅ ' + d.message; resultEl.style.color = '#16a34a'; }
    else { resultEl.textContent = '❌ ' + d.message; resultEl.style.color = '#e53935'; }
  } catch(e){
    resultEl.textContent = '❌ 请求失败: ' + e.message; resultEl.style.color = '#e53935';
  }
  btn.disabled = false; btn.textContent = orig;
}

async function saveAIConfig(){
  var data = {
    endpoint: document.getElementById('aiEndpoint').value.trim(),
    app_id: document.getElementById('aiAppId').value.trim(),
    api_key: document.getElementById('aiApiKey').value.trim(),
    model: document.getElementById('aiModel').value.trim(),
    temperature: parseFloat(document.getElementById('aiTemperature').value) || 0.7,
    max_tokens: parseInt(document.getElementById('aiMaxTokens').value, 10) || 2048,
    timeout: parseInt(document.getElementById('aiTimeout').value, 10) || 300
  };
  var r = await fetch('/api/ai/config', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
  if(r.status === 403){ showToast('仅管理员可修改API配置', 'error'); return; }
  var d = await r.json();
  if(d.error){ showToast(d.error, 'error'); return; }
  showToast('API配置已保存'); switchAITab('analyze');
}

async function doAIAnalyze(){
  var question = document.getElementById('aiPrompt').value.trim();
  if(!question){ showToast('请输入分析问题', 'error'); return; }
  var btn = document.getElementById('aiAnalyzeBtn');
  btn.disabled = true; btn.textContent = '分析中...';

  var resultDiv = document.getElementById('aiResult');
  var resultBar = document.getElementById('aiResultBar');
  document.getElementById('aiWelcome').style.display = 'none';
  resultDiv.style.display = 'block'; resultBar.style.display = 'none';
  resultDiv.innerHTML = '<div class="ai-loading">AI正在读取数据库全量数据并分析...</div>';

  var startTime = Date.now();
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, 300000);  // 5分钟超时
    var r = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({question: question}),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    var d = await r.json();
    if(d.error){
      resultDiv.innerHTML = '<div style="color:#e53935">❌ ' + d.error + '</div>';
    } else if(!d.content || d.content.trim() === ''){
      resultDiv.innerHTML = '<div style="color:#e53935">❌ AI返回了空内容</div>';
    } else {
      resultDiv.innerHTML = '<div style="white-space:pre-wrap;font-size:14px;line-height:1.8">'
        + d.content.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>';
      document.getElementById('aiElapsed').textContent = '⏱ 耗时 ' + elapsed + ' 秒'
        + (d.elapsed_ms ? '（服务端 ' + d.elapsed_ms + 'ms）' : '');
      resultBar.style.display = 'flex';
    }
  } catch(e){
    if(e.name === 'AbortError'){
      resultDiv.innerHTML = '<div style="color:#e53935">⏰ 分析超时（5分钟）</div>';
    } else {
      resultDiv.innerHTML = '<div style="color:#e53935">❌ 请求失败: ' + e.message + '</div>';
    }
  }
  btn.disabled = false; btn.textContent = '🚀 开始分析';
}

function copyAIResult(){
  var div = document.getElementById('aiResult');
  var text = div.textContent || div.innerText || '';
  if(!text.trim()){ showToast('没有可复制的内容', 'error'); return; }
  navigator.clipboard.writeText(text).then(
    function(){ showToast('已复制到剪贴板'); }
  ).catch(function(){ showToast('复制失败', 'error'); });
}
```

---

## 五、架构图

```
用户提问 (dashboard.html)
    │
    ▼
POST /api/ai/analyze (app.py)
    │
    ▼
ai_service.analyze()
    ├── get_ai_config()          ← settings 表
    ├── get_ai_context()         ← projects 表 (仅8列)
    ├── build_analysis_prompt()  ← 构建 prompt
    └── call_maas_api()          ← HTTP POST → MaaS
        └── _parse_api_response() ← JSON / SSE 双模式解析
    │
    ▼
返回 {status:"ok", content:"...", elapsed_ms:123}
    │
    ▼
前端渲染 + 复制/导出Word
```

## 六、API 路由总览

| 路由 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/ai/config` | GET | login | 获取 AI 配置 |
| `/api/ai/config` | POST | admin | 保存 AI 配置 |
| `/api/ai/config/test` | POST | admin | 测试 API 连接 |
| `/api/ai/analyze` | POST | login | 执行 AI 分析 |

## 七、配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| endpoint | `https://maas.hikvision.com.cn` | MaaS API 地址 |
| app_id | — | 应用 ID |
| api_key | — | API 密钥 |
| user | — | 默认用户标识 |
| model | `default` | 模型名称（default/deepseek-v3/deepseek-r1） |
| temperature | `0.7` | 生成温度（0~1） |
| max_tokens | `2048` | 最大输出 token 数 |
| timeout | `300` | 请求超时（秒） |
