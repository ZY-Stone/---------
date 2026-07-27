App.AI = {
  // 从 localStorage 加载配置
  loadConfig: function() {
    try {
      var saved = localStorage.getItem('w_ai_config');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { endpoint: 'https://maas.hikvision.com.cn', app_id: '', api_key: '', user: '', timeout: 300 };
  },

  // 保存配置到 localStorage
  saveConfig: function() {
    var config = {
      endpoint: document.getElementById('wAiEndpoint').value.trim(),
      app_id: document.getElementById('wAiAppId').value.trim(),
      api_key: document.getElementById('wAiApiKey').value.trim(),
      user: document.getElementById('wAiUser').value.trim(),
      timeout: parseInt(document.getElementById('wAiTimeout').value) || 300
    };
    localStorage.setItem('w_ai_config', JSON.stringify(config));
    alert('API配置已保存');
    App.AI.switchTab('analyze');
  },

  // 填充表单
  fillForm: function(config) {
    var ids = { endpoint: 'wAiEndpoint', app_id: 'wAiAppId', api_key: 'wAiApiKey', user: 'wAiUser', timeout: 'wAiTimeout' };
    Object.keys(ids).forEach(function(k) {
      var el = document.getElementById(ids[k]);
      if (el && config[k] != null) el.value = config[k];
    });
  },

  // 切换 tab
  switchTab: function(tab) {
    document.getElementById('wAiTabAnalyzeContent').style.display = tab === 'analyze' ? 'block' : 'none';
    document.getElementById('wAiTabConfigContent').style.display = tab === 'config' ? 'block' : 'none';
    var a = document.getElementById('wAiTabAnalyze'), c = document.getElementById('wAiTabConfig');
    if (a) a.classList.toggle('active', tab === 'analyze');
    if (c) c.classList.toggle('active', tab === 'config');
  },

  // 快捷提问
  quick: function(q) {
    document.getElementById('wAiPrompt').value = q;
    App.AI.analyze();
  },

  // 构建数据上下文
  buildContext: function() {
    var raw = App.WidthCustomer.RAW;
    var products = App.WidthDetail.PRODUCTS;
    var ctx = '产品宽度数据总览:\n';
    ctx += '总记录数: ' + raw.length + '\n';
    ctx += '规上客户数: ' + raw.filter(function(r) { return r.guishang === 1; }).length + '\n';
    var avgW = raw.length ? (raw.reduce(function(s, r) { return s + r.width; }, 0) / raw.length).toFixed(1) : 0;
    ctx += '平均产品宽度: ' + avgW + '\n';
    ctx += '产品品类数: ' + products.length + '\n\n';

    // 按部门统计
    ctx += '部门维度:\n';
    App.BUSINESS_DEPTS.forEach(function(d) {
      var dg = App.GROUPS.filter(function(g) { return g.dept === d.n; }).map(function(g) { return g.n; });
      var dr = raw.filter(function(r) { return dg.indexOf(r.team) >= 0; });
      var dw = dr.length ? (dr.reduce(function(s, r) { return s + r.width; }, 0) / dr.length).toFixed(1) : 0;
      ctx += '  ' + d.n + ': ' + dr.length + '条, 均宽' + dw + '\n';
    });

    // 按组统计(取前10)
    ctx += '\n组维度(TOP10):\n';
    var grpStats = App.GROUPS.map(function(g) {
      var gr = raw.filter(function(r) { return r.team === g.n; });
      return { n: g.n, cnt: gr.length, aw: gr.length ? (gr.reduce(function(s, r) { return s + r.width; }, 0) / gr.length).toFixed(1) : 0 };
    }).sort(function(a, b) { return b.cnt - a.cnt; }).slice(0, 10);
    grpStats.forEach(function(g) { ctx += '  ' + g.n + ': ' + g.cnt + '条, 均宽' + g.aw + '\n'; });

    // 品类覆盖率
    ctx += '\n品类覆盖率:\n';
    var top8 = products.slice(0, 8);
    top8.forEach(function(p) {
      var cov = raw.filter(function(r) { return r.prods && r.prods[p] === 1; }).length;
      ctx += '  ' + p + ': ' + cov + '/' + raw.length + ' (' + (raw.length ? (cov/raw.length*100).toFixed(1) : 0) + '%)\n';
    });

    return ctx;
  },

  // 执行分析
  analyze: function() {
    var question = document.getElementById('wAiPrompt').value.trim();
    if (!question) { alert('请输入分析问题'); return; }
    var btn = document.getElementById('wAiAnalyzeBtn');
    btn.disabled = true; btn.textContent = '分析中...';

    var resultDiv = document.getElementById('wAiResult');
    var resultBar = document.getElementById('wAiResultBar');
    resultDiv.style.display = 'block'; resultBar.style.display = 'none';
    resultDiv.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取产品宽度数据并分析...</div>';

    var config = App.AI.loadConfig();
    var ctx = App.AI.buildContext();
    var prompt = '你是产品宽度分析助手。请根据以下产品宽度数据，用中文回答问题。回答要具体、可操作。\n问：' + question + '\n\n' + ctx;

    var base = (config.endpoint || 'https://maas.hikvision.com.cn').replace(/\/$/, '');
    if (base.endsWith('/v1')) base = base.slice(0, -3);
    var url = base + '/apps/' + (config.app_id || '') + '/api/v1/completion/block';

    var startTime = Date.now();
    var controller = new AbortController();
    var timeoutMs = (parseInt(config.timeout) || 300) * 1000;
    var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': config.api_key || '' },
      body: JSON.stringify({ question: prompt, user: config.user || 'admin', temperature: 0.7, max_tokens: 2048 }),
      signal: controller.signal
    }).then(function(r) {
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function(raw) {
      var content = '';
      try {
        var json = JSON.parse(raw);
        content = json.content || json.answer || (json.data && json.data.content) || '';
      } catch(e) {
        // SSE format
        raw.split('\n').forEach(function(line) {
          if (line.startsWith('data:')) {
            try { var c = JSON.parse(line.slice(5).trim()); if (c.answer) content += c.answer; } catch(e2) {}
          }
        });
      }
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (content) {
        resultDiv.innerHTML = content.replace(/</g, '&lt;').replace(/\n/g, '<br>');
        document.getElementById('wAiElapsed').textContent = '⏱ 耗时 ' + elapsed + ' 秒';
        resultBar.style.display = 'flex';
      } else {
        resultDiv.innerHTML = '<div style="color:#e53935">AI返回了空内容，请检查API配置或稍后重试</div>';
      }
    }).catch(function(e) {
      clearTimeout(timeoutId);
      var msg = e.name === 'AbortError' ? '⏰ 分析超时，请稍后重试' : '❌ 请求失败: ' + e.message;
      resultDiv.innerHTML = '<div style="color:#e53935">' + msg + '</div>';
    }).finally(function() {
      btn.disabled = false; btn.textContent = '🚀 开始分析';
    });
  },

  // 测试连接
  testConnection: function() {
    var config = {
      endpoint: document.getElementById('wAiEndpoint').value.trim(),
      app_id: document.getElementById('wAiAppId').value.trim(),
      api_key: document.getElementById('wAiApiKey').value.trim()
    };
    if (!config.endpoint || !config.app_id || !config.api_key) {
      document.getElementById('wAiTestResult').innerHTML = '<span style="color:#e53935">请填写 API 地址、App ID 和 API Key</span>';
      return;
    }
    var base = config.endpoint.replace(/\/$/, '');
    if (base.endsWith('/v1')) base = base.slice(0, -3);
    var url = base + '/apps/' + config.app_id + '/api/v1/completion/block';

    document.getElementById('wAiTestResult').innerHTML = '<span style="color:#888">测试中...</span>';

    var controller = new AbortController();
    setTimeout(function() { controller.abort(); }, 15000);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': config.api_key },
      body: JSON.stringify({ question: '请回复连接成功', user: 'test' }),
      signal: controller.signal
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function() {
      document.getElementById('wAiTestResult').innerHTML = '<span style="color:#16a34a">✅ 连接成功</span>';
    }).catch(function(e) {
      document.getElementById('wAiTestResult').innerHTML = '<span style="color:#e53935">❌ ' + (e.name === 'AbortError' ? '连接超时' : e.message) + '</span>';
    });
  },

  // 复制结果
  copyResult: function() {
    var div = document.getElementById('wAiResult');
    var text = div.textContent || div.innerText || '';
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(function() {
      alert('已复制到剪贴板');
    }).catch(function() {
      alert('复制失败');
    });
  },

  // 初始化
  init: function() {
    var config = App.AI.loadConfig();
    App.AI.fillForm(config);
  }
};

// ===== 潜力产品 AI 分析（复用 AI 通信逻辑，独立数据上下文） =====
App.PotAI = {
  loadConfig: function() {
    try { return JSON.parse(localStorage.getItem('p_ai_config') || localStorage.getItem('w_ai_config') || '{}'); } catch(e) {}
    return { endpoint: 'https://maas.hikvision.com.cn', app_id: '', api_key: '', user: '', timeout: 300 };
  },
  saveConfig: function() {
    var c = { endpoint: document.getElementById('pAiEndpoint').value.trim(), app_id: document.getElementById('pAiAppId').value.trim(), api_key: document.getElementById('pAiApiKey').value.trim(), user: document.getElementById('pAiUser').value.trim(), timeout: parseInt(document.getElementById('pAiTimeout').value) || 300 };
    localStorage.setItem('p_ai_config', JSON.stringify(c));
    alert('API配置已保存'); App.PotAI.switchTab('analyze');
  },
  fillForm: function(c) {
    ['pAiEndpoint','pAiAppId','pAiApiKey','pAiUser','pAiTimeout'].forEach(function(id) {
      var el = document.getElementById(id); if (el && c[id.replace('pAi','').toLowerCase()] != null) el.value = c[id.replace('pAi','').toLowerCase()];
      if (el && c[id.replace('pAi','w').replace('Endpoint','AiEndpoint').replace('AppId','AiAppId').replace('ApiKey','AiApiKey').replace('User','AiUser').replace('Timeout','AiTimeout')] != null) el.value = c[id.replace('pAi','w').replace('Endpoint','AiEndpoint').replace('AppId','AiAppId').replace('ApiKey','AiApiKey').replace('User','AiUser').replace('Timeout','AiTimeout')];
    });
  },
  switchTab: function(tab) {
    document.getElementById('pAiTabAnalyzeContent').style.display = tab === 'analyze' ? 'block' : 'none';
    document.getElementById('pAiTabConfigContent').style.display = tab === 'config' ? 'block' : 'none';
    var a = document.getElementById('pAiTabAnalyze'), c = document.getElementById('pAiTabConfig');
    if (a) a.classList.toggle('active', tab === 'analyze');
    if (c) c.classList.toggle('active', tab === 'config');
  },
  quick: function(q) { document.getElementById('pAiPrompt').value = q; App.PotAI.analyze(); },
  buildContext: function() {
    var raw = App.WidthCustomer.RAW;
    var ctx = '潜力产品分析数据:\n总记录数: ' + raw.length + '\n规上客户数: ' + raw.filter(function(r) { return r.guishang === 1; }).length + '\n';
    var avgW = raw.length ? (raw.reduce(function(s, r) { return s + r.width; }, 0) / raw.length).toFixed(1) : 0;
    ctx += '平均产品宽度: ' + avgW + '\n\n';
    ctx += '部门维度:\n';
    App.BUSINESS_DEPTS.forEach(function(d) {
      var dg = App.GROUPS.filter(function(g) { return g.dept === d.n; }).map(function(g) { return g.n; });
      var dr = raw.filter(function(r) { return dg.indexOf(r.team) >= 0; });
      var dw = dr.length ? (dr.reduce(function(s, r) { return s + r.width; }, 0) / dr.length).toFixed(1) : 0;
      ctx += '  ' + d.n + ': ' + dr.length + '条, 均宽' + dw + '\n';
    });
    ctx += '\n品类覆盖率:\n';
    var products = App.WidthDetail.PRODUCTS;
    products.slice(0, 10).forEach(function(p) {
      var cov = raw.filter(function(r) { return r.prods && r.prods[p] === 1; }).length;
      ctx += '  ' + p + ': ' + cov + '/' + raw.length + ' (' + (raw.length ? (cov/raw.length*100).toFixed(1) : 0) + '%)\n';
    });
    return ctx;
  },
  analyze: function() {
    var q = document.getElementById('pAiPrompt').value.trim(); if (!q) { alert('请输入分析问题'); return; }
    var btn = document.getElementById('pAiAnalyzeBtn'), rd = document.getElementById('pAiResult'), rb = document.getElementById('pAiResultBar');
    btn.disabled = true; btn.textContent = '分析中...';
    rd.style.display = 'block'; rb.style.display = 'none';
    rd.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取数据并分析...</div>';
    var c = App.PotAI.loadConfig(), ctx = App.PotAI.buildContext();
    var prompt = '你是潜力产品分析助手。请根据以下产品宽度数据，用中文回答问题。回答要具体、可操作。\n问：' + q + '\n\n' + ctx;
    var base = (c.endpoint || 'https://maas.hikvision.com.cn').replace(/\/$/, ''); if (base.endsWith('/v1')) base = base.slice(0, -3);
    var url = base + '/apps/' + (c.app_id || '') + '/api/v1/completion/block';
    var st = Date.now(), ctrl = new AbortController(), tid = setTimeout(function() { ctrl.abort(); }, (parseInt(c.timeout) || 300) * 1000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': c.api_key || '' }, body: JSON.stringify({ question: prompt, user: c.user || 'admin', temperature: 0.7, max_tokens: 2048 }), signal: ctrl.signal })
    .then(function(r) { clearTimeout(tid); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function(raw) {
      var content = '';
      try { content = JSON.parse(raw).content || JSON.parse(raw).answer || ''; } catch(e) {
        raw.split('\n').forEach(function(l) { if (l.startsWith('data:')) try { var c = JSON.parse(l.slice(5).trim()); if (c.answer) content += c.answer; } catch(e2) {} });
      }
      var el = ((Date.now()-st)/1000).toFixed(1);
      if (content) { rd.innerHTML = content.replace(/</g,'&lt;').replace(/\n/g,'<br>'); document.getElementById('pAiElapsed').textContent = '⏱ 耗时 ' + el + ' 秒'; rb.style.display = 'flex'; }
      else rd.innerHTML = '<div style="color:#e53935">AI返回了空内容，请检查API配置</div>';
    }).catch(function(e) { clearTimeout(tid); rd.innerHTML = '<div style="color:#e53935">' + (e.name==='AbortError'?'⏰ 分析超时':'❌ '+e.message) + '</div>'; })
    .finally(function() { btn.disabled = false; btn.textContent = '🚀 开始分析'; });
  },
  testConnection: function() {
    var c = { endpoint: document.getElementById('pAiEndpoint').value.trim(), app_id: document.getElementById('pAiAppId').value.trim(), api_key: document.getElementById('pAiApiKey').value.trim() };
    if (!c.endpoint||!c.app_id||!c.api_key) { document.getElementById('pAiTestResult').innerHTML='<span style="color:#e53935">请填写 API 地址、App ID 和 API Key</span>'; return; }
    var base = c.endpoint.replace(/\/$/,''); if (base.endsWith('/v1')) base = base.slice(0,-3);
    document.getElementById('pAiTestResult').innerHTML='<span style="color:#888">测试中...</span>';
    var ctrl = new AbortController(); setTimeout(function(){ctrl.abort()},15000);
    fetch(base+'/apps/'+c.app_id+'/api/v1/completion/block',{method:'POST',headers:{'Content-Type':'application/json','Authorization':c.api_key},body:JSON.stringify({question:'请回复连接成功',user:'test'}),signal:ctrl.signal})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()})
    .then(function(){document.getElementById('pAiTestResult').innerHTML='<span style="color:#16a34a">✅ 连接成功</span>'})
    .catch(function(e){document.getElementById('pAiTestResult').innerHTML='<span style="color:#e53935">❌ '+(e.name==='AbortError'?'连接超时':e.message)+'</span>'});
  },
  copyResult: function() {
    var t = (document.getElementById('pAiResult').textContent||'').trim();
    if (t) navigator.clipboard.writeText(t).then(function(){alert('已复制')}).catch(function(){alert('复制失败')});
  },
  init: function() { App.PotAI.fillForm(App.PotAI.loadConfig()); }
};
