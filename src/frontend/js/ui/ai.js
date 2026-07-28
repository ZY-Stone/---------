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

  // 执行分析（后台运行，切换页面不中断）
  analyze: function() {
    var question = document.getElementById('wAiPrompt').value.trim();
    if (!question) { alert('请输入分析问题'); return; }
    var btn = document.getElementById('wAiAnalyzeBtn');
    if (btn) { btn.disabled = true; btn.textContent = '分析中...'; }

    var resultDiv = document.getElementById('wAiResult');
    var resultBar = document.getElementById('wAiResultBar');
    if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取产品宽度数据并分析...</div>'; }
    if (resultBar) resultBar.style.display = 'none';

    // 标记分析进行中
    App.AI._running = true;
    App.AI._pendingResult = null;

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
        raw.split('\n').forEach(function(line) {
          if (line.startsWith('data:')) {
            try { var c = JSON.parse(line.slice(5).trim()); if (c.answer) content += c.answer; } catch(e2) {}
          }
        });
      }
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (content) {
        var html = content.replace(/</g, '&lt;').replace(/\n/g, '<br>');
        App.AI._pendingResult = { html: html, elapsed: elapsed };
        // 如果结果区可见，直接渲染
        var rd = document.getElementById('wAiResult');
        if (rd && rd.offsetParent) { rd.innerHTML = html; }
        var rb = document.getElementById('wAiResultBar');
        if (rb && rd && rd.offsetParent) { rb.style.display = 'flex'; }
        var el = document.getElementById('wAiElapsed');
        if (el) el.textContent = '⏱ 耗时 ' + elapsed + ' 秒';
        App.showToast('🤖 AI分析完成（耗时 ' + elapsed + ' 秒）', 5000);
      } else {
        App.AI._pendingResult = { html: '<div style="color:#e53935">AI返回了空内容，请检查API配置或稍后重试</div>', elapsed: 0 };
        var rd2 = document.getElementById('wAiResult');
        if (rd2 && rd2.offsetParent) { rd2.innerHTML = App.AI._pendingResult.html; }
        App.showToast('⚠ AI返回空内容，请检查API配置', 4000);
      }
    }).catch(function(e) {
      clearTimeout(timeoutId);
      var msg = e.name === 'AbortError' ? '⏰ 分析超时，请稍后重试' : '❌ 请求失败: ' + e.message;
      App.AI._pendingResult = { html: '<div style="color:#e53935">' + msg + '</div>', elapsed: 0 };
      var rd3 = document.getElementById('wAiResult');
      if (rd3 && rd3.offsetParent) { rd3.innerHTML = App.AI._pendingResult.html; }
      App.showToast(msg, 4000);
    }).finally(function() {
      App.AI._running = false;
      if (btn) { btn.disabled = false; btn.textContent = '🚀 开始分析'; }
    });
  },

  // 恢复未渲染的结果（切回 AI tab 时调用）
  restoreResult: function() {
    if (App.AI._pendingResult) {
      var rd = document.getElementById('wAiResult');
      if (rd) rd.innerHTML = App.AI._pendingResult.html;
      var rb = document.getElementById('wAiResultBar');
      if (rb) rb.style.display = 'flex';
      if (App.AI._pendingResult.elapsed) {
        var el = document.getElementById('wAiElapsed');
        if (el) el.textContent = '⏱ 耗时 ' + App.AI._pendingResult.elapsed + ' 秒';
      }
    }
    if (App.AI._running) {
      var rd2 = document.getElementById('wAiResult');
      if (rd2) { rd2.style.display = 'block'; rd2.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取产品宽度数据并分析...</div>'; }
    }
  },

  // 获取结果 HTML（保留格式）
  _getResultHtml: function() {
    var rd = document.getElementById('wAiResult');
    if (!rd) return '';
    return rd.innerHTML || '';
  },
  _getResultText: function() {
    var rd = document.getElementById('wAiResult');
    if (!rd) return '';
    return rd.innerText || rd.textContent || '';
  },

  // 构建报告 HTML 骨架
  _buildReport: function(title, bodyHtml) {
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' +
      'body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:14px;line-height:1.9;color:#1e293b;padding:40px 50px;max-width:820px;margin:0 auto}' +
      '.report-header{border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px}' +
      '.report-header h1{font-size:22px;color:#1e40af;margin:0 0 6px 0}' +
      '.report-meta{font-size:11px;color:#94a3b8;margin-top:4px}' +
      '.report-body{font-size:14px}' +
      '.report-body p{margin:8px 0}' +
      '.report-body ul,.report-body ol{padding-left:22px}' +
      '.report-body li{margin:4px 0}' +
      '.report-body strong{color:#1a56db}' +
      '.report-body table{width:100%;border-collapse:collapse;margin:12px 0}' +
      '.report-body th{background:#2563eb;color:#fff;padding:8px 12px;font-size:12px;text-align:left}' +
      '.report-body td{padding:7px 12px;border:1px solid #e5e7eb;font-size:12px}' +
      '.report-body h2{font-size:16px;color:#374151;border-left:4px solid #2563eb;padding-left:10px;margin:16px 0 8px 0}' +
      '.report-body h3{font-size:14px;color:#64748b;margin:12px 0 6px 0}' +
      '.report-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8}' +
      '@media print{body{padding:20px 30px}}' +
      '</style></head><body>' +
      '<div class="report-header"><h1>' + title + '</h1><div class="report-meta">📅 生成时间：' + dateStr + ' &nbsp;|&nbsp; 📊 数据来源：产品宽度导入数据 &nbsp;|&nbsp; 🤖 由 AI 自动分析生成</div></div>' +
      '<div class="report-body">' + bodyHtml + '</div>' +
      '<div class="report-footer">© ' + now.getFullYear() + ' 产品分析一体化平台 · AI 智能分析报告 · 生成时间 ' + dateStr + '</div>' +
      '</body></html>';
  },

  // 复制结果
  copyResult: function() {
    var text = App.AI._getResultText();
    if (!text) { alert('暂无分析结果'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { App.showToast('📋 已复制到剪贴板', 2000); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      App.showToast('📋 已复制到剪贴板', 2000);
    }
  },

  // 导出 PDF 报告
  exportPDF: function() {
    var bodyHtml = App.AI._getResultHtml();
    if (!bodyHtml || bodyHtml === '<br>') { alert('暂无分析结果'); return; }
    var html = App.AI._buildReport('🤖 产品宽度 AI 智能分析报告', bodyHtml);
    var w = window.open('', '_blank');
    w.document.write(html); w.document.close();
    setTimeout(function() { w.print(); }, 600);
  },

  // 导出 Word 报告（.doc）
  exportWord: function() {
    var bodyHtml = App.AI._getResultHtml();
    if (!bodyHtml || bodyHtml === '<br>') { alert('暂无分析结果'); return; }
    var html = App.AI._buildReport('🤖 产品宽度 AI 智能分析报告', bodyHtml);
    var blob = new Blob(['﻿' + html], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '产品宽度AI分析报告_' + new Date().toISOString().slice(0,10) + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    App.showToast('📝 Word 报告下载中', 2000);
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
    var btn = document.getElementById('pAiAnalyzeBtn');
    if (btn) { btn.disabled = true; btn.textContent = '分析中...'; }
    var rd = document.getElementById('pAiResult'), rb = document.getElementById('pAiResultBar');
    if (rd) { rd.style.display = 'block'; rd.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取数据并分析...</div>'; }
    if (rb) rb.style.display = 'none';

    App.PotAI._running = true;
    App.PotAI._pendingResult = null;

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
        raw.split('\n').forEach(function(l) { if (l.startsWith('data:')) try { var c2 = JSON.parse(l.slice(5).trim()); if (c2.answer) content += c2.answer; } catch(e2) {} });
      }
      var el = ((Date.now()-st)/1000).toFixed(1);
      if (content) {
        var html = content.replace(/</g,'&lt;').replace(/\n/g,'<br>');
        App.PotAI._pendingResult = { html: html, elapsed: el };
        var rd2 = document.getElementById('pAiResult');
        if (rd2 && rd2.offsetParent) { rd2.innerHTML = html; }
        var rb2 = document.getElementById('pAiResultBar');
        if (rb2 && rd2 && rd2.offsetParent) { rb2.style.display = 'flex'; }
        var el2 = document.getElementById('pAiElapsed');
        if (el2) el2.textContent = '⏱ 耗时 ' + el + ' 秒';
        App.showToast('🤖 潜力产品AI分析完成（耗时 ' + el + ' 秒）', 5000);
      } else {
        App.PotAI._pendingResult = { html: '<div style="color:#e53935">AI返回了空内容，请检查API配置</div>', elapsed: 0 };
        var rd3 = document.getElementById('pAiResult');
        if (rd3 && rd3.offsetParent) rd3.innerHTML = App.PotAI._pendingResult.html;
        App.showToast('⚠ 潜力产品AI返回空内容', 4000);
      }
    }).catch(function(e) { clearTimeout(tid);
      var msg = e.name==='AbortError'?'⏰ 分析超时，请稍后重试':'❌ 请求失败: '+e.message;
      App.PotAI._pendingResult = { html: '<div style="color:#e53935">'+msg+'</div>', elapsed: 0 };
      var rd4 = document.getElementById('pAiResult');
      if (rd4 && rd4.offsetParent) rd4.innerHTML = App.PotAI._pendingResult.html;
      App.showToast(msg, 4000);
    })
    .finally(function() { App.PotAI._running = false; if (btn) { btn.disabled = false; btn.textContent = '🚀 开始分析'; } });
  },
  restoreResult: function() {
    if (App.PotAI._pendingResult) {
      var rd = document.getElementById('pAiResult');
      if (rd) rd.innerHTML = App.PotAI._pendingResult.html;
      var rb = document.getElementById('pAiResultBar');
      if (rb) rb.style.display = 'flex';
      if (App.PotAI._pendingResult.elapsed) {
        var el = document.getElementById('pAiElapsed');
        if (el) el.textContent = '⏱ 耗时 ' + App.PotAI._pendingResult.elapsed + ' 秒';
      }
    }
    if (App.PotAI._running) {
      var rd2 = document.getElementById('pAiResult');
      if (rd2) { rd2.style.display = 'block'; rd2.innerHTML = '<div style="color:#888;padding:20px;text-align:center">AI正在读取数据并分析...</div>'; }
    }
  },
  _getResultHtml: function() {
    var rd = document.getElementById('pAiResult');
    return rd ? (rd.innerHTML || '') : '';
  },
  _getResultText: function() {
    var rd = document.getElementById('pAiResult');
    return rd ? (rd.innerText || rd.textContent || '') : '';
  },
  _buildReport: function(title, bodyHtml) {
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' +
      'body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:14px;line-height:1.9;color:#1e293b;padding:40px 50px;max-width:820px;margin:0 auto}' +
      '.report-header{border-bottom:3px solid #7c3aed;padding-bottom:16px;margin-bottom:24px}' +
      '.report-header h1{font-size:22px;color:#5b21b6;margin:0 0 6px 0}' +
      '.report-meta{font-size:11px;color:#94a3b8;margin-top:4px}' +
      '.report-body{font-size:14px}' +
      '.report-body p{margin:8px 0}' +
      '.report-body ul,.report-body ol{padding-left:22px}' +
      '.report-body li{margin:4px 0}' +
      '.report-body strong{color:#7c3aed}' +
      '.report-body table{width:100%;border-collapse:collapse;margin:12px 0}' +
      '.report-body th{background:#7c3aed;color:#fff;padding:8px 12px;font-size:12px;text-align:left}' +
      '.report-body td{padding:7px 12px;border:1px solid #e5e7eb;font-size:12px}' +
      '.report-body h2{font-size:16px;color:#374151;border-left:4px solid #7c3aed;padding-left:10px;margin:16px 0 8px 0}' +
      '.report-body h3{font-size:14px;color:#64748b;margin:12px 0 6px 0}' +
      '.report-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8}' +
      '@media print{body{padding:20px 30px}}' +
      '</style></head><body>' +
      '<div class="report-header"><h1>' + title + '</h1><div class="report-meta">📅 生成时间：' + dateStr + ' &nbsp;|&nbsp; 📊 数据来源：潜力产品导入数据 &nbsp;|&nbsp; 🤖 由 AI 自动分析生成</div></div>' +
      '<div class="report-body">' + bodyHtml + '</div>' +
      '<div class="report-footer">© ' + now.getFullYear() + ' 产品分析一体化平台 · AI 智能分析报告 · 生成时间 ' + dateStr + '</div>' +
      '</body></html>';
  },
  copyResult: function() {
    var t = App.PotAI._getResultText();
    if (!t) { alert('暂无分析结果'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).then(function() { App.showToast('📋 已复制到剪贴板', 2000); });
    } else {
      var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      App.showToast('📋 已复制到剪贴板', 2000);
    }
  },
  exportPDF: function() {
    var bodyHtml = App.PotAI._getResultHtml();
    if (!bodyHtml || bodyHtml === '<br>') { alert('暂无分析结果'); return; }
    var html = App.PotAI._buildReport('🤖 潜力产品 AI 智能分析报告', bodyHtml);
    var w = window.open('','_blank'); w.document.write(html); w.document.close();
    setTimeout(function(){w.print()},600);
  },
  exportWord: function() {
    var bodyHtml = App.PotAI._getResultHtml();
    if (!bodyHtml || bodyHtml === '<br>') { alert('暂无分析结果'); return; }
    var html = App.PotAI._buildReport('🤖 潜力产品 AI 智能分析报告', bodyHtml);
    var blob = new Blob(['﻿'+html],{type:'application/octet-stream'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = '潜力产品AI分析报告_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
    App.showToast('📝 Word 报告下载中', 2000);
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
  init: function() { App.PotAI.fillForm(App.PotAI.loadConfig()); }
};
