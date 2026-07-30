// ===== 数据导入与管理 — 总表上传/数据源切换/自动去重更新 =====
App.ImportData = App.ImportData || {};
App.ImportData.currentView = 'user';
App.ImportData._gen = 0;  // 代际计数器：防止 init() 异步回调覆盖刚导入的数据
App.ImportData.PRODS = App.WidthCustomer.PRODUCTS || [];
App.ImportData.shortProds = App.ImportData.PRODS.map(function(p) { return p.length > 5 ? p.substring(0, 5) + '…' : p; });

// 组名→部门名 映射（从 App.GROUPS 构建）
App.ImportData.groupDeptMap = {};
(function() {
  var groups = App.GROUPS || [];
  groups.forEach(function(g) { App.ImportData.groupDeptMap[g.n] = g.dept; });
  // 无下属组的部门：部门=组
  var noGroupDepts = ['场景数字化销售部','大客户销售部'];
  noGroupDepts.forEach(function(d) { App.ImportData.groupDeptMap[d] = d; });
})();

// 从组名推导部门名
App.ImportData.resolveDept = function(groupName) {
  if (!groupName) return '';
  return App.ImportData.groupDeptMap[groupName] || groupName;
};

// 从销售人员名反查所属部门（PERSONS 精确匹配 → GROUPS 负责人包含匹配）
// 导入的 dept 实际是组名，通过 resolveDept 映射到真实部门
App.ImportData.lookupDept = function(salesName, selfDept) {
  var dept = (selfDept || '').trim();
  if (dept) return App.ImportData.resolveDept(dept);  // 1) 组名 → 部门名映射
  if (!salesName) return '';
  // 2) PERSONS 表反查：sales → p.dept
  var persons = App.PERSONS || [];
  for (var i = 0; i < persons.length; i++) {
    if (persons[i].n === salesName) return persons[i].dept || '';
  }
  // 3) GROUPS 表反查：sales → g.ld 匹配小组负责人
  var groups = App.GROUPS || [];
  for (var j = 0; j < groups.length; j++) {
    if (groups[j].ld && groups[j].ld.indexOf(salesName) >= 0) return groups[j].dept || '';
  }
  return '';
};

// 统一持久化内存数据到 localStorage（缓存层，防止刷新后回退到后端旧数据）
App.ImportData.persist = function() {
  // 产品数据不存 localStorage，防止数据泄露。每次都从后端 API 拉取。
};

// 统一规上识别：是/y/yes/true/1/√/✓/对 → '是'，其他 → '否'
App.ImportData.parseGuishang = function(v) {
  var s = String(v || '').toLowerCase().trim();
  return (s.indexOf('是') >= 0 || s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === '√' || s === '✓' || s === '对') ? '是' : '否';
};

App.ImportData.history = [];
App.ImportData.UserGS = [];
App.ImportData.CustGS = [];
App.ImportData.init = function() {
  // 用代际计数器防止异步回调覆盖刚导入的数据
  var gen = ++App.ImportData._gen;
  // 注意：不在这里清空 UserGS/CustGS！
  // init() 可能在页面初始化、切Tab、导入等多个时机被调用，
  // 如果同步清空再异步填充，中间窗口期会导致图表渲染空数据。
  // 正确的做法：等后端数据返回后再决定是否替换。

  // 月份选择器上限设为当前月（不可上传未来月份数据）
  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var snapInput = document.getElementById('wSnapshotPeriod');
  if (snapInput) {
    snapInput.max = thisMonth;
    if (!snapInput.value) snapInput.value = thisMonth;
  }
  // 表内月份筛选默认当月
  var periodSel = document.getElementById('wImportPeriodFilter');
  if (periodSel && !periodSel.getAttribute('data-inited')) {
    periodSel.setAttribute('data-inited', '1');
    periodSel.value = thisMonth;
  }
  // 每次 init 都从后端拉取最新数据，不恢复 localStorage 历史（历史仅在当前会话有效）
  // 从 localStorage 恢复导入历史记录（仅元数据，不含数据快照）
  var storedHistory = [];
  try {
    storedHistory = JSON.parse(localStorage.getItem('pa_width_history') || '[]');
  } catch(e) { storedHistory = []; }
  App.ImportData.history = storedHistory.map(function(h) {
    return {
      id: h.id, file: h.file, time: h.time,
      userNew: h.userNew, userUpd: h.userUpd,
      custNew: h.custNew, custUpd: h.custUpd,
      total: h.total, person: h.person,
      snapshotPeriod: h.snapshotPeriod
    };
  });
  // 并行拉取 user + cust 数据，减少首屏等待时间
  var fetchUser = fetch('/api/import/width-records?type=user').then(function(r) { return r.json(); }).then(function(data) {
    if (data.rows && data.rows.length > 0) {
      App.ImportData.UserGS = data.rows.map(function(r) {
        return { id: r.id, user: r.name, siebel: r.siebel, industry: r.industry, sales: r.sales, group: r.group, dept: App.ImportData.resolveDept(r.group), guishang: r.guishang, width: r.width, prods: r.prods, contact: r.contact, level: r.level, snapshotPeriod: r.snapshotPeriod || '' };
      });
    }
  }).catch(function(err) {
    console.warn('[ImportData.init] 用户数据 fetch 失败，保留现有数据:', err.message || err);
  });

  var fetchCust = fetch('/api/import/width-records?type=cust').then(function(r) { return r.json(); }).then(function(data) {
    if (data.rows && data.rows.length > 0) {
      App.ImportData.CustGS = data.rows.map(function(r) {
        return { id: r.id, name: r.name, siebel: r.siebel, sales: r.sales, group: r.group, dept: App.ImportData.resolveDept(r.group), guishang: r.guishang, width: r.width, prods: r.prods, contact: r.contact, level: r.level, snapshotPeriod: r.snapshotPeriod || '' };
      });
    }
  }).catch(function(err) {
    console.warn('[ImportData.init] 客户数据 fetch 失败，保留现有数据:', err.message || err);
  });

  Promise.all([fetchUser, fetchCust]).then(function() {
    if (App.ImportData._gen !== gen) { console.log('[ImportData.init] 代际过期 gen=' + gen + ' 当前=' + App.ImportData._gen + '，跳过刷新'); return; }
    App.ImportData.syncToRaw();
    App.ImportData.updateTags();
    App.ImportData.renderHistory();
    App.ImportData.render();
    try { App.updateWidth(); } catch(e) {}
    try { App.updatePotential(); } catch(e) {}
    try { App.updateOverview(); } catch(e) {}
  });
};

// 保存快照到历史
App.ImportData.saveToHistory = function(fileName, nu, uu, nc, uc) {
  var now = new Date();
  var ds = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
  var snapInput = document.getElementById('wSnapshotPeriod');
  var entry = {
    id: Date.now(), file: fileName || '手动快照', time: ds,
    userNew: nu || 0, userUpd: uu || 0,
    custNew: nc || 0, custUpd: uc || 0,
    total: (nu || 0) + (uu || 0) + (nc || 0) + (uc || 0),
    person: (App.loggedInUser && App.loggedInUser.name) || '当前用户',
    snapshotPeriod: snapInput ? snapInput.value : '',
    userSnap: JSON.parse(JSON.stringify(App.ImportData.UserGS || [])),
    custSnap: JSON.parse(JSON.stringify(App.ImportData.CustGS || []))
  };
 App.ImportData.history.unshift(entry);
  if (App.ImportData.history.length > 20) App.ImportData.history = App.ImportData.history.slice(0, 20);
  App.ImportData.renderHistory();
  App.ImportData._persistHistory();
};

// 将历史记录元数据持久化到 localStorage（不含数据快照，仅文件名/时间/计数）
App.ImportData._persistHistory = function() {
  var meta = App.ImportData.history.map(function(h) {
    return {
      id: h.id, file: h.file, time: h.time,
      userNew: h.userNew, userUpd: h.userUpd,
      custNew: h.custNew, custUpd: h.custUpd,
      total: h.total, person: h.person,
      snapshotPeriod: h.snapshotPeriod
    };
  });
  try {
    localStorage.setItem('pa_width_history', JSON.stringify(meta));
  } catch(e) {
    console.warn('[ImportData] 历史记录持久化失败:', e.message);
  }
};

// 渲染历史列表
App.ImportData.renderHistory = function() {
  var tbody = document.getElementById('wImportHistoryTable');
  if (!tbody) return;
  if (App.ImportData.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8">暂无历史记录，上传文件后自动保存</td></tr>';
    return;
  }
  var html = '';
  App.ImportData.history.forEach(function(h, i) {
    html += '<tr>';
    html += '<td><span class="rn rn0">' + (i + 1) + '</span></td>';
    html += '<td><strong>' + h.file + '</strong></td>';
    html += '<td style="text-align:center;font-size:11px">' + h.time + '</td>';
    html += '<td style="text-align:center;font-weight:600">' + (h.snapshotPeriod || '-') + '</td>';
    html += '<td style="text-align:center;font-weight:600;color:#1e40af">' + (h.userNew||0) + '<span style="font-size:10px;color:#9ca3af">新</span>/' + (h.userUpd||0) + '<span style="font-size:10px;color:#9ca3af">更</span></td>';
    html += '<td style="text-align:center;font-weight:600;color:#166534">' + (h.custNew||0) + '<span style="font-size:10px;color:#9ca3af">新</span>/' + (h.custUpd||0) + '<span style="font-size:10px;color:#9ca3af">更</span></td>';
    html += '<td style="text-align:center">' + h.total + '</td>';
    html += '<td style="font-size:11px">' + h.person + '</td>';
    html += '<td style="text-align:center">';
    html += '<button class="btn-ghost" style="padding:2px 6px;font-size:10px;color:#dc2626" onclick="App.ImportData.deleteHistory(' + i + ')" title="删除此记录">✕</button>';
    html += '</td></tr>';
  });
  tbody.innerHTML = html;
};

// 恢复历史版本
App.ImportData.restoreHistory = function(idx) {
  var h = App.ImportData.history[idx];
  if (!h) return;
  if (!confirm('确定恢复到 "' + h.file + '" (' + h.time + ') 的数据吗？\n\n当前数据将被替换。')) return;
  App.ImportData.UserGS = JSON.parse(JSON.stringify(h.userSnap));
  App.ImportData.CustGS = JSON.parse(JSON.stringify(h.custSnap));
  App.ImportData.persist();
  App.ImportData.syncToRaw();
  App.ImportData.updateTags();
  App.ImportData.render();
  App.WidthDetail.clearCache();
  App.updateWidth();
};

// 删除历史记录并回退数据到上一条快照状态
App.ImportData.deleteHistory = function(idx) {
  var h = App.ImportData.history[idx];
  if (!h) return;
  if (!confirm('确定删除「' + h.file + '」(' + (h.snapshotPeriod || h.time) + ') 的记录并回退数据吗？')) return;
  // 删除该条历史
  App.ImportData.history.splice(idx, 1);
  // 回退数据到前一条快照（如无则清空）
  var prev = App.ImportData.history[idx] || App.ImportData.history[0];
  if (prev && prev.userSnap && prev.custSnap) {
    App.ImportData.UserGS = JSON.parse(JSON.stringify(prev.userSnap));
    App.ImportData.CustGS = JSON.parse(JSON.stringify(prev.custSnap));
  } else {
    App.ImportData.UserGS = [];
    App.ImportData.CustGS = [];
  }
  App.ImportData.persist();
  App.ImportData.syncToRaw();
  App.ImportData.updateTags();
  App.ImportData.render();
  App.ImportData.renderHistory();
  App.WidthDetail.clearCache();
  App.updateWidth();
  App.ImportData._persistHistory();
};

// 清空所有历史记录及数据（含后端）
App.ImportData.clearAll = function() {
  if (!confirm('确定清空所有历史记录及后端数据吗？此操作不可撤销。')) return;
  // 递增代际，让所有进行中的 init() 回调失效
  App.ImportData._gen++;
  // 先清本地（防止重复点击）
  App.ImportData.history = [];
  try { localStorage.removeItem('pa_width_history'); } catch(e) {}
  App.ImportData.UserGS = [];
  App.ImportData.CustGS = [];
  App.WidthTeamMatrix.RAW = [];  // 清除潜力产品团队矩阵缓存
  App.ImportData.syncToRaw();
  App.ImportData.updateTags();
  App.ImportData.render();
  App.ImportData.renderHistory();
  App.WidthDetail.clearCache();
  // 刷新所有产品宽度子视图（团队分析、客户明细、用户明细等）
  try { App.updateWidth(); } catch(e) {}
  try { App.WidthCustomer.render(); } catch(e) {}
  try { App.WidthUser.render(); } catch(e) {}
  try { App.renderWidthUserTab(); } catch(e) {}
  try { App.renderWidthGapAnalysis(); } catch(e) {}
  try { App.renderWidthProductTab(); } catch(e) {}
  try { App.updatePotential(); } catch(e) {}
  try { App.updateOverview(); } catch(e) {}
  try { App.Data.rebuildDerived(); } catch(e) {}
  // 清后端并等待结果，使用带认证的 API 请求确保数据库真正删除
  var baseUrl = (window.location.protocol === 'file:') ? 'http://localhost:8800' : window.location.origin;
  var headers = { 'Content-Type': 'application/json' };
  var token = sessionStorage.getItem('pa_token');
  if (token) { headers['Authorization'] = 'Bearer ' + token; }
  fetch(baseUrl + '/api/import/width-records', { method: 'DELETE', headers: headers })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      console.log('[clearAll] 后端已删除 ' + (data.deleted || 0) + ' 条产品宽度数据');
      alert('✅ 已清空所有历史记录及后端数据（删除 ' + (data.deleted || 0) + ' 条）');
    })
    .catch(function(err) {
      console.error('[clearAll] 后端删除失败:', err);
      alert('⚠️ 后端数据删除失败（' + (err.message || '网络错误') + '），请检查后端服务是否正常运行。刷新页面后数据可能会重新出现。');
    });
};

// 清空全部导入数据并重置平台
App.ImportData.resetAll = function() {
  if (!confirm('确定清空所有导入数据吗？\n\n此操作将清除：\n- 产品宽度导入数据\n- 潜力产品导入数据\n- 所有历史记录\n- 后端数据库\n\n此操作不可撤销！')) return;
  // 清空内存
  App.ImportData.UserGS = [];
  App.ImportData.CustGS = [];
  App.ImportData.history = [];
  try { localStorage.removeItem('pa_width_history'); } catch(e) {}
  App.WidthCustomer.RAW = [];
  App.WidthUser = App.WidthUser || {};
  App.WidthUser.RAW = [];
  App.WidthCustomer.RAW_MERGED = [];
  App.WidthTeamMatrix.RAW = [];  // 清除潜力产品团队矩阵缓存
  if (App.ImportPotential) {
    App.ImportPotential.CustRAW = [];
    App.ImportPotential.UserRAW = [];
    App.ImportPotential.history = [];
  }
  // 刷新所有视图
  App.ImportData.renderHistory();
  App.ImportData.updateTags();
  App.ImportData.render();
  try { App.updateWidth(); } catch(e) {}
  try { App.updatePotential(); } catch(e) {}
  try { App.updateOverview(); } catch(e) {}
  if (App.ImportPotential && typeof App.ImportPotential.render === 'function') {
    try { App.ImportPotential.render(); } catch(e) {}
    try { App.ImportPotential.renderHistory(); } catch(e) {}
  }
  try { App.addLog('删除数据', '全部数据', '清空所有导入数据（含后端数据库）'); } catch(e) {}
  // 清后端数据库，使用带认证的 API 请求确保真正删除
  var baseUrl = (window.location.protocol === 'file:') ? 'http://localhost:8800' : window.location.origin;
  var headers = { 'Content-Type': 'application/json' };
  var token = sessionStorage.getItem('pa_token');
  if (token) { headers['Authorization'] = 'Bearer ' + token; }
  Promise.all([
    fetch(baseUrl + '/api/import/width-records', { method: 'DELETE', headers: headers }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function(e) { console.warn('[resetAll] width DELETE failed:', e); return {ok:false, deleted:0}; }),
    fetch(baseUrl + '/api/import/potential-cust', { method: 'DELETE', headers: headers }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function(e) { console.warn('[resetAll] pot-cust DELETE failed:', e); return {ok:false, deleted:0}; }),
    fetch(baseUrl + '/api/import/potential-user', { method: 'DELETE', headers: headers }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function(e) { console.warn('[resetAll] pot-user DELETE failed:', e); return {ok:false, deleted:0}; })
  ]).then(function(results) {
    var widthDel = results[0] && results[0].deleted || 0;
    var custDel = results[1] && results[1].deleted || 0;
    var userDel = results[2] && results[2].deleted || 0;
    var total = widthDel + custDel + userDel;
    console.log('[resetAll] 后端已删除：宽度=' + widthDel + ' 客户=' + custDel + ' 用户=' + userDel);
    alert('✅ 已清空所有导入数据（后端共删除 ' + total + ' 条），平台已恢复空状态');
  }).catch(function(err) {
    console.error('[resetAll] 后端删除失败:', err);
    alert('⚠️ 后端数据删除部分失败（' + (err.message || '网络错误') + '），刷新后数据可能残留。请检查后端服务。');
  });
};

// 下载当前数据为 Excel
App.ImportData.exportCurrent = function() {
  if (typeof XLSX === 'undefined') { alert('XLSX库未加载'); return; }

  // 读取当前选择的月份
  var periodEl = document.getElementById('wSnapshotPeriod');
  var selectedPeriod = periodEl ? periodEl.value : '';
  var periodLabel = selectedPeriod || '全部月份';

  // 按月份过滤数据
  var users = (App.ImportData.UserGS || []).slice();
  var custs = (App.ImportData.CustGS || []).slice();
  if (selectedPeriod) {
    users = users.filter(function(u) { return (u.snapshotPeriod || '') === selectedPeriod; });
    custs = custs.filter(function(c) { return (c.snapshotPeriod || '') === selectedPeriod; });
  }

  var wb = XLSX.utils.book_new();
  var products = App.ImportData.PRODS;
  // 用户sheet
  var userRows = [['最终用户-行业','siebel编码','最终用户','销售','销售部门','是否规上','产品线合计','月份'].concat(products).concat(['接口人','用户等级'])];
  users.forEach(function(u) {
    var row = [u.industry||'', u.siebel||'', u.user, u.sales||'', u.dept||'', u.guishang||'是', u.width, u.snapshotPeriod||''];
    products.forEach(function(p) { row.push(u.prods[p] || 0); });
    row.push(u.contact||'', u.level||'');
    userRows.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(userRows), '规上用户-产品线宽度');
  // 客户sheet
  var custRows = [['siebel编码','售达方描述(客户)','销售','销售部门','是否规上','产品线合计','月份'].concat(products).concat(['接口人','客户等级'])];
  custs.forEach(function(c) {
    var row = [c.siebel||'', c.name, c.sales||'', c.dept||'', c.guishang||'是', c.width, c.snapshotPeriod||''];
    products.forEach(function(p) { row.push(c.prods[p] || 0); });
    row.push(c.contact||'', c.level||'');
    custRows.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(custRows), '客户产品线覆盖');

  App.addLog('数据导出', '产品宽度', '下载产品宽度数据(' + periodLabel + '): 用户' + users.length + '条 / 客户' + custs.length + '条');

  var now = new Date();
  var fn = '产品宽度总表_' + periodLabel.replace(/[^0-9a-zA-Z一-鿿]/g, '-') + '_' + now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2) + '.xlsx';
  XLSX.writeFile(wb, fn);
};

// 新增空白记录
App.ImportData.addEmptyRecord = function() {
  var isU = App.ImportData.currentView === 'user';
  if (isU) {
    var name = prompt('请输入最终用户名称:');
    if (!name) return;
    var prods = {};
    App.ImportData.PRODS.forEach(function(p) { prods[p] = 0; });
    App.ImportData.UserGS.push({ user: name, siebel: '', industry: '', sales: '', dept: '', guishang: '否', width: 0, prods: prods, contact: '', level: '' });
  } else {
    var name = prompt('请输入客户名称:');
    if (!name) return;
    var prods = {};
    App.ImportData.PRODS.forEach(function(p) { prods[p] = 0; });
    App.ImportData.CustGS.push({ name: name, siebel: '', sales: '', dept: '', guishang: '否', width: 0, prods: prods, contact: '', level: '' });
  }
  App.ImportData.persist();
  App.ImportData.syncToRaw();
  App.ImportData.updateTags();
  App.ImportData.render();
  App.WidthDetail.clearCache();
  App.updateWidth();
};

App.ImportData.syncFromRaw = function() {
  var raw = App.WidthCustomer.RAW, prods = App.ImportData.PRODS;
  var um = {}, cm = {};
  raw.forEach(function(r) {
    if (r.guishang === 1) {
      var uk = r.user;
      if (um[uk]) { um[uk].width = Math.max(um[uk].width, r.width); prods.forEach(function(p) { if (r.prods && r.prods[p]) um[uk].prods[p] = 1; }); }
      else { var up = {}; prods.forEach(function(p) { up[p] = (r.prods && r.prods[p]) ? 1 : 0; }); um[uk] = { user: r.user, siebel: '', industry: '', sales: r.account, dept: r.team, guishang: '是', width: r.width, prods: up, contact: '', level: '' }; }
    }
    if (r.guishang === 1) {
      var ck = r.account || r.user;
      if (cm[ck]) { cm[ck].width = Math.max(cm[ck].width, r.width); prods.forEach(function(p) { if (r.prods && r.prods[p]) cm[ck].prods[p] = 1; }); }
      else { var cp = {}; prods.forEach(function(p) { cp[p] = (r.prods && r.prods[p]) ? 1 : 0; }); cm[ck] = { name: ck, siebel: '', sales: r.account, dept: r.team, guishang: '是', width: r.width, prods: cp, contact: '', level: '' }; }
    }
  });
  App.ImportData.UserGS = Object.values(um); App.ImportData.CustGS = Object.values(cm);
};

App.ImportData.switchView = function(v) { App.ImportData.currentView = v; App.ImportData.updateTags(); App.ImportData.render(); };

App.ImportData.updateTags = function() {
  var ugs = (App.ImportData.UserGS || []).filter(function(r) { var g=(r.guishang||'').toString().trim(); return g==='是'||g==='1'; }).length;
  var ungs = (App.ImportData.UserGS || []).length - ugs;
  var cgs = (App.ImportData.CustGS || []).filter(function(r) { var g=(r.guishang||'').toString().trim(); return g==='是'||g==='1'; }).length;
  var cngs = (App.ImportData.CustGS || []).length - cgs;
  App.setText('w-total-user-gs', ugs);
  App.setText('w-total-user-ngs', ungs);
  App.setText('w-total-cust-gs', cgs);
  App.setText('w-total-cust-ngs', cngs);
  var ut = document.getElementById('w-total-user-tag'), ct = document.getElementById('w-total-cust-tag');
  if (ut) {
    ut.style.opacity = App.ImportData.currentView === 'user' ? '1' : '0.5';
    ut.style.background = App.ImportData.currentView === 'user' ? '#1a56db' : '#dbeafe';
    ut.style.color = App.ImportData.currentView === 'user' ? '#fff' : '#1e40af';
    ut.style.fontWeight = App.ImportData.currentView === 'user' ? '700' : '400';
  }
  if (ct) {
    ct.style.opacity = App.ImportData.currentView === 'user' ? '0.5' : '1';
    ct.style.background = App.ImportData.currentView === 'cust' ? '#1a56db' : '#dcfce7';
    ct.style.color = App.ImportData.currentView === 'cust' ? '#fff' : '#166534';
    ct.style.fontWeight = App.ImportData.currentView === 'cust' ? '700' : '400';
  }
};

App.ImportData.refresh = function() {
  // 从后端 API 重新拉取数据
  fetch('/api/import/width-records?type=user').then(function(r){return r.json();}).then(function(d){
    if (d.rows && d.rows.length > 0) {
      App.ImportData.UserGS = d.rows.map(function(r){return {user:r.name,siebel:r.siebel,industry:r.industry,sales:r.sales,group:r.group,dept:App.ImportData.resolveDept(r.group),guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level,snapshotPeriod:r.snapshotPeriod||''};});
      App.ImportData.UserGS = d.rows.map(function(r){return {id:r.id,user:r.name,siebel:r.siebel,industry:r.industry,sales:r.sales,group:r.group,dept:App.ImportData.resolveDept(r.group),guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level,snapshotPeriod:r.snapshotPeriod||''};});
    }
  }).catch(function(){}).finally(function(){
    return fetch('/api/import/width-records?type=cust').then(function(r){return r.json();}).then(function(d){
      if (d.rows && d.rows.length > 0) {
        App.ImportData.CustGS = d.rows.map(function(r){return {name:r.name,siebel:r.siebel,group:r.group,dept:App.ImportData.resolveDept(r.group),sales:r.sales,guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level,snapshotPeriod:r.snapshotPeriod||''};});
        App.ImportData.CustGS = d.rows.map(function(r){return {id:r.id,name:r.name,siebel:r.siebel,group:r.group,dept:App.ImportData.resolveDept(r.group),sales:r.sales,guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level,snapshotPeriod:r.snapshotPeriod||''};});
      }
    }).catch(function(){});
  }).finally(function(){
    App.ImportData.syncToRaw();
    App.ImportData.updateTags();
    App.ImportData.render();
    App.ImportData.persist();
    App.WidthDetail.clearCache();
    try { App.updateWidth(); } catch(e) {}
  });
};

App.ImportData.handleUpload = function(input) {
  var file = input.files && input.files[0]; if (!file) return;
  // 重置 input 以便同一文件可再次触发 onchange
  input.value = '';
  // 确保月份已设置，弹窗确认
  var snapInput = document.getElementById('wSnapshotPeriod');
  if (snapInput && !snapInput.value) {
    var now = new Date();
    snapInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  var snapVal = snapInput ? snapInput.value : '';
  if (!confirm('数据月份：' + (snapVal || '未设置') + '\n\n确定导入「' + file.name + '」吗？\n\n如需修改月份，请点击"取消"后在页面上修改。')) return;
  console.log('[宽度导入] 开始解析:', file.name);
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result), wb = XLSX.read(data, { type: 'array' }), products = App.ImportData.PRODS;
      console.log('[宽度导入] Sheets:', wb.SheetNames.join(', '));
      var newUserRows = [], newCustRows = [];
      var nu = 0, uu = 0, nc = 0, uc = 0;
      var foundUser = false, foundCust = false;

      // 遍历所有sheet，按表头自动识别用户/客户
      wb.SheetNames.forEach(function(sn) {
        if (!wb.Sheets[sn]) return;
        var j = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
        if (!j || j.length < 2) return;
        var hd = j[0] || [];
        // 检测sheet类型：有"最终用户"列 → 用户sheet；有"售达方"列 → 客户sheet
        var hasUser = hd.some(function(h) { return String(h||'').indexOf('最终用户') >= 0 && String(h||'').indexOf('行业') < 0; });
        var hasCust = hd.some(function(h) { return String(h||'').indexOf('售达方') >= 0; });

        if (hasUser && !foundUser) {
          foundUser = true;
          console.log('[宽度导入] 用户sheet:', sn, '行数:', j.length, '表头:', hd);
          try { App.Field.detectSchema(hd, 'width.user'); } catch(e) {}
          var col = App.ImportData.mapCols(hd, 'user');
          console.log('[宽度导入] 用户列映射:', JSON.stringify(col));
          // 按 siebel编码 + 数据月份 去重（同编码同月=更新，不同月=新增）
          var snap = (document.getElementById('wSnapshotPeriod') || {}).value || '';
          j.slice(1).forEach(function(row) {
            var siebel = String(row[col.siebel] || '').trim();
            var nm = String(row[col.user] || '').trim();
            if (!siebel && !nm) return;
            var salesName = String(row[col.sales] || '').trim();
            var deptInput = String(row[col.dept] || '').trim();
            var resolvedDept = App.ImportData.lookupDept(salesName, deptInput);
            var e = { user: nm, siebel: siebel, industry: String(row[col.industry] || '').trim(), sales: salesName, group: deptInput, dept: resolvedDept, guishang: App.ImportData.parseGuishang(row[col.guishang]), width: parseInt(row[col.width]) || 0, prods: {}, contact: String(row[col.contact] || '').trim(), level: String(row[col.level] || '').trim(), snapshotPeriod: snap };
            products.forEach(function(p, i) { e.prods[p] = (row[col.prodStart + i] === 1 || String(row[col.prodStart + i]).trim() === '1') ? 1 : 0; });
            newUserRows.push(e);
          });
        } else if (hasCust && !foundCust) {
          foundCust = true;
          console.log('[宽度导入] 客户sheet:', sn, '行数:', j.length, '表头:', hd);
          try { App.Field.detectSchema(hd, 'width.cust'); } catch(e) {}
          var col = App.ImportData.mapCols(hd, 'cust');
          console.log('[宽度导入] 客户列映射:', JSON.stringify(col));
          // 按 siebel编码 + 数据月份 去重（同编码同月=更新，不同月=新增）
          var snap2 = (document.getElementById('wSnapshotPeriod') || {}).value || '';
          j.slice(1).forEach(function(row) {
            var siebel = String(row[col.siebel] || '').trim();
            var nm = String(row[col.name] || '').trim();
            if (!siebel && !nm) return;
            var salesName = String(row[col.sales] || '').trim();
            var deptInput = String(row[col.dept] || '').trim();
            var resolvedDept = App.ImportData.lookupDept(salesName, deptInput);
            var e = { name: nm, siebel: siebel, sales: salesName, group: deptInput, dept: resolvedDept, guishang: App.ImportData.parseGuishang(row[col.guishang]), width: parseInt(row[col.width]) || 0, prods: {}, contact: String(row[col.contact] || '').trim(), level: String(row[col.level] || '').trim(), snapshotPeriod: snap2 };
            products.forEach(function(p, i) { e.prods[p] = (row[col.prodStart + i] === 1 || String(row[col.prodStart + i]).trim() === '1') ? 1 : 0; });
            newCustRows.push(e);
          });
        }
      });

      // 解析潜力产品数据（客户/用户视图）
      var potMatrix = [];
      wb.SheetNames.forEach(function(sn) {
        if (!wb.Sheets[sn]) return;
        var j = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
        if (!j || j.length < 2) return;
        var hd = j[0] || [];
        // 检测潜力产品sheet：同时有"潜力产品"列和"销售额"列
        var hasPot = hd.some(function(h) { return String(h||'').indexOf('潜力产品') >= 0; });
        var hasAmt = hd.some(function(h) { return String(h||'').indexOf('销售额') >= 0; });
        if (!hasPot || !hasAmt) return;
        var colMap = {};
        hd.forEach(function(h, i) {
          var s = String(h||'').trim();
          if (s.indexOf('二级部门')>=0) colMap.dept2 = i;
          if (s.indexOf('大部门')>=0||s.indexOf('三级部门')>=0) colMap.dept3 = i;
          if (s.indexOf('团队小组')>=0||s.indexOf('四级部门')>=0) colMap.dept4 = i;
          if (s.indexOf('销售雇员')>=0||s.indexOf('负责销售')>=0) colMap.person = i;
          if (s.indexOf('潜力产品')>=0) colMap.product = i;
          if (s.indexOf('售达方')>=0) colMap.seller = i;
          if (s.indexOf('销售额(万)')>=0||s.indexOf('产品出库额')>=0) colMap.amount = i;
          if (s.indexOf('同期销售额')>=0||s.indexOf('产品出库额同期')>=0) colMap.amountPrev = i;
        });
        if (colMap.product == null || colMap.amount == null) return;
        j.slice(1).forEach(function(row) {
          var team = String(row[colMap.dept4] || row[colMap.dept3] || '').trim();
          var product = String(row[colMap.product] || '').trim();
          var amount = parseFloat(row[colMap.amount]) || 0;
          var amountPrev = parseFloat(row[colMap.amountPrev]) || 0;
          if (!team || !product || amount === 0) return;
          potMatrix.push({ team: team, product: product, amount: amount, amountPrev: amountPrev });
        });
      });
      if (potMatrix.length > 0) {
        App.WidthTeamMatrix.RAW = potMatrix;
      }
      // ── 合并去重：按 siebel + snapshotPeriod 合并到 UserGS/CustGS ──
      var _snap = (document.getElementById('wSnapshotPeriod') || {}).value || '';
      App.ImportData.UserGS.forEach(function(r) { if (!r.snapshotPeriod) r.snapshotPeriod = _snap; });
      var _userIdx = {}; App.ImportData.UserGS.forEach(function(r, i) { _userIdx[(r.siebel||r.user||'') + '|' + (r.snapshotPeriod||'')] = i; });
      newUserRows.forEach(function(r) {
        var _key = (r.siebel||r.user||'') + '|' + (r.snapshotPeriod||'');
        if (_userIdx[_key] !== undefined) { App.ImportData.UserGS[_userIdx[_key]] = r; uu++; }
        else { App.ImportData.UserGS.push(r); nu++; _userIdx[_key] = App.ImportData.UserGS.length - 1; }
      });
      App.ImportData.CustGS.forEach(function(r) { if (!r.snapshotPeriod) r.snapshotPeriod = _snap; });
      var _custIdx = {}; App.ImportData.CustGS.forEach(function(r, i) { _custIdx[(r.siebel||r.name||'') + '|' + (r.snapshotPeriod||'')] = i; });
      newCustRows.forEach(function(r) {
        var _key = (r.siebel||r.name||'') + '|' + (r.snapshotPeriod||'');
        if (_custIdx[_key] !== undefined) { App.ImportData.CustGS[_custIdx[_key]] = r; uc++; }
        else { App.ImportData.CustGS.push(r); nc++; _custIdx[_key] = App.ImportData.CustGS.length - 1; }
      });
      console.log('[宽度导入] 解析完成: 用户', nu, '新增/', uu, '更新, 客户', nc, '新增/', uc, '更新, 潜力矩阵', potMatrix.length, '条');
      // 递增代际计数器，防止 init() 中尚未完成的异步请求覆盖刚导入的数据
      App.ImportData._gen++;

      if (!foundUser && !foundCust && potMatrix.length === 0) {
        alert('未识别到用户/客户/潜力产品数据。\n\n当前sheets: ' + wb.SheetNames.join(', '));
        return;
      }

      var oldUserLen = App.ImportData.UserGS.length, oldCustLen = App.ImportData.CustGS.length;
      App.ImportData.syncToRaw(); App.ImportData.updateTags(); App.ImportData.render(); App.WidthDetail.clearCache();
      // 导入后全链路刷新
      App.updateWidth();
      try { App.updatePotential(); } catch(e) {}
      try { App.updateOverview(); } catch(e) {}
      try { App.renderWidthUserTab(); } catch(e) {}
      try { App.renderWidthProblemDiag(); } catch(e) {}
      if (potMatrix.length > 0) {
        try { App.updatePotential(); } catch(e) {}
        try { App.updateOverview(); } catch(e) {}
      }
      App.ImportData.saveToHistory(file.name, nu, uu, nc, uc);
      try { App.Data.rebuildDerived(); } catch(e) { console.warn('rebuildDerived failed:', e); }

      // 发送到后端数据库
      var userApiRows = newUserRows.map(function(r) {
        return {user: r.user, siebel: r.siebel||'', industry: r.industry||'', sales: r.sales||'', dept: r.group||r.dept||'', guishang: r.guishang||'否', width: r.width||0, prods: r.prods||{}, contact: r.contact||'', level: r.level||'', snapshotPeriod: r.snapshotPeriod||''};
      });
      var custApiRows = newCustRows.map(function(r) {
        return {name: r.name, siebel: r.siebel||'', sales: r.sales||'', dept: r.group||r.dept||'', guishang: r.guishang||'否', width: r.width||0, prods: r.prods||{}, contact: r.contact||'', level: r.level||'', snapshotPeriod: r.snapshotPeriod||''};
      });
      var snapshot = (document.getElementById('wSnapshotPeriod') || {}).value || '';
      // 构造带认证的 API 请求（确保后端 @require_perm 校验通过）
      var baseUrl = (window.location.protocol === 'file:') ? 'http://localhost:8800' : window.location.origin;
      var authHeaders = {'Content-Type':'application/json'};
      var token = sessionStorage.getItem('pa_token');
      if (token) { authHeaders['Authorization'] = 'Bearer ' + token; }
      var apiCalls = [];
      if (userApiRows.length > 0) { console.log('[导入] 发送用户数据:', userApiRows.length, '条, 月份:', snapshot); apiCalls.push(fetch(baseUrl + '/api/import/width-records', { method: 'POST', headers: authHeaders, body: JSON.stringify({ rows: userApiRows, type: 'user', snapshotPeriod: snapshot }) }).then(function(r) { return r.json(); })); }
      if (custApiRows.length > 0) { console.log('[导入] 发送客户数据:', custApiRows.length, '条, 月份:', snapshot); apiCalls.push(fetch(baseUrl + '/api/import/width-records', { method: 'POST', headers: authHeaders, body: JSON.stringify({ rows: custApiRows, type: 'cust', snapshotPeriod: snapshot }) }).then(function(r) { return r.json(); })); }
      if (apiCalls.length > 0) {
        Promise.all(apiCalls).then(function(results) {
          var dbMsgs = [];
          results.forEach(function(r, i) {
            if (r && r.ok) dbMsgs.push((r.message || '') + '（写入DB ' + (r.count||0) + ' 新增 / ' + (r.updated||0) + ' 更新）');
          });
          console.log('[宽度导入] 后端保存成功:', dbMsgs.join('; '));
          try { App.addLog('数据导入', file.name, '产品宽度导入: 用户' + App.ImportData.UserGS.length + '条 / 客户' + App.ImportData.CustGS.length + '条'); } catch(e) {}
          var warnings = [];
          if (!foundUser) warnings.push('未找到用户sheet');
          if (!foundCust) warnings.push('未找到客户sheet');
          App.showImportResult(true, '产品宽度导入', file.name, [
            { label: '规上用户', newCount: nu, updCount: uu, total: newUserRows.length, dbMsg: dbMsgs[0] || '' },
            { label: '规上客户', newCount: nc, updCount: uc, total: newCustRows.length, dbMsg: dbMsgs[1] || '' }
          ], warnings);
        }).catch(function(err) {
          console.error('[宽度导入] 后端保存失败:', err);
          try { App.addLog('数据导入', file.name, '产品宽度导入(后端保存失败): 用户' + App.ImportData.UserGS.length + '条 / 客户' + App.ImportData.CustGS.length + '条'); } catch(e) {}
          App.showImportResult(false, '产品宽度导入', file.name, [
            { label: '规上用户', newCount: nu, updCount: uu, total: newUserRows.length, dbMsg: '❌ ' + err.message },
            { label: '规上客户', newCount: nc, updCount: uc, total: newCustRows.length, dbMsg: '❌ ' + err.message }
          ], [!foundUser && '未找到用户sheet', !foundCust && '未找到客户sheet'].filter(Boolean));
        });
      } else {
        try { App.addLog('数据导入', file.name, '产品宽度导入: 用户' + App.ImportData.UserGS.length + '条 / 客户' + App.ImportData.CustGS.length + '条（未同步后端）'); } catch(e) {}
        var w2 = []; if (!foundUser) w2.push('未找到用户sheet'); if (!foundCust) w2.push('未找到客户sheet');
        App.showImportResult(true, '产品宽度导入', file.name, [
          { label: '规上用户', newCount: nu, updCount: uu, total: newUserRows.length, dbMsg: '仅前端' },
          { label: '规上客户', newCount: nc, updCount: uc, total: newCustRows.length, dbMsg: '仅前端' }
        ], w2);
      }
    } catch(err) { console.error('[宽度导入] 解析失败:', err); try { App.addLog('数据导入', '导入失败', err.message); } catch(e) {} App.showImportResult(false, '产品宽度导入', (file && file.name) || '未知文件', [], ['❌ 解析失败: ' + err.message]); }
  };
  reader.readAsArrayBuffer(file);
};

App.ImportData.mapCols = function(hd, tp) {
  var m = {}; hd.forEach(function(h, i) { var s = String(h || '').trim();
    if (s.indexOf('siebel') >= 0) m.siebel = i;
    if (tp === 'user') { if (s.indexOf('最终用户') >= 0 && s.indexOf('行业') < 0) m.user = i; if (s.indexOf('行业') >= 0 && s.indexOf('用户') >= 0) m.industry = i; }
    else { if ((s.indexOf('售达方') >= 0 || s.indexOf('客户') >= 0) && s.indexOf('等级') < 0) m.name = i; }
    if (s.indexOf('销售') >= 0 && s.indexOf('部门') < 0) m.sales = i;
    if (s.indexOf('部门') >= 0) m.dept = i;
    if (s.indexOf('规上') >= 0 || s.indexOf('是否') >= 0) m.guishang = i;
    if (s.indexOf('合计') >= 0 || s.indexOf('产品宽度') >= 0) m.width = i;
    if (s.indexOf('接口') >= 0) m.contact = i;
    if (s.indexOf('等级') >= 0) m.level = i;
    if (s.indexOf('IPC') >= 0 || s.indexOf('球机') >= 0) m.prodStart = i;
  }); if (m.prodStart == null) m.prodStart = 6; return m;
};

App.ImportData.syncToRaw = function() {
  var custRaw = [], userRaw = [], mergedRaw = [], p = App.ImportData.PRODS;
  var seenMerged = new Set();

  // 用户维度 RAW（全部用户数据）
  App.ImportData.UserGS.forEach(function(u) {
    var grp = u.group || u.dept || '';
    var dept = u.dept || '';
    var entry = { team: grp, dept: dept, account: u.sales || '', user: u.user, width: u.width, guishang: u.guishang === '是' ? 1 : 0, prods: u.prods, snapshotPeriod: u.snapshotPeriod || '' };
    userRaw.push(entry);
    mergedRaw.push(entry);
    seenMerged.add(u.user);
  });

  // 客户维度 RAW（全部客户数据，独立不合并）
  App.ImportData.CustGS.forEach(function(c) {
    var grp = c.group || c.dept || '';
    var dept = c.dept || '';
    var entry = { team: grp, dept: dept, account: c.sales || '', user: c.name, width: c.width, guishang: c.guishang === '是' ? 1 : 0, prods: c.prods, snapshotPeriod: c.snapshotPeriod || '' };
    custRaw.push(entry);
    // 合并 RAW（团队维度用）：去重
    if (!seenMerged.has(c.name)) {
      mergedRaw.push(entry);
      seenMerged.add(c.name);
    }
  });

  // 分配数据源：客户维度 → CustRAW / 用户维度 → UserRAW / 团队维度 → 合并RAW
  App.WidthCustomer.RAW = custRaw;
  App.WidthUser.RAW = userRaw;
  App.WidthCustomer.RAW_MERGED = mergedRaw;  // 团队维度数据明细用

  // 同步产品列表到全局（供团队维度表头动态渲染）
  if (App.ImportData.PRODS && App.ImportData.PRODS.length > 0) {
    App.WidthCustomer.PRODUCTS = App.ImportData.PRODS.slice();
    App.WidthDetail.PRODUCTS = App.ImportData.PRODS.slice();
  }
};

App.ImportData._page = 1;

App.ImportData.getPageSize = function() {
  var psEl = document.getElementById('wImportPageSize');
  var pageSize = psEl ? (psEl.value === '0' ? 0 : parseInt(psEl.value) || 20) : 20;
  return pageSize;
};

// ── 表内部门/小组筛选下拉（数据源与顶部一致） ──

// 从 App.DEPTS 填充部门下拉
App.ImportData.populateImportDeptDropdown = function() {
  var sel = document.getElementById('wImportDeptFilter');
  if (!sel) return;
  var curVal = sel.value;
  var depts = (typeof App.getFilteredDepts === 'function') ? App.getFilteredDepts() : (App.BUSINESS_DEPTS || App.DEPTS || []);
  sel.innerHTML = '<option value="all">全部部门</option>' + depts.map(function(d) { return '<option value="' + d.n + '">' + d.n + '</option>'; }).join('');
  if (depts.some(function(d) { return d.n === curVal; })) sel.value = curVal;
  else sel.value = 'all';
};

// 从 App.GROUPS 填充小组下拉（根据当前选中的部门级联）
App.ImportData.populateImportGrpDropdown = function() {
  var sel = document.getElementById('wImportGroupFilter');
  if (!sel) return;
  var curVal = sel.value;
  var deptVal = (document.getElementById('wImportDeptFilter') || {}).value || 'all';
  var groups = (typeof App.getFilteredGroups === 'function') ? App.getFilteredGroups(deptVal !== 'all' ? deptVal : null) : (App.GROUPS || []);
  sel.innerHTML = '<option value="all">全部小组</option>' + groups.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
  if (groups.some(function(g) { return g.n === curVal; })) sel.value = curVal;
  else sel.value = 'all';
};

// 部门变更 → 级联刷新小组下拉 + 同步顶部 FilterBar
App.ImportData.onDeptChange = function(val) {
  var grpSel = document.getElementById('wImportGroupFilter');
  if (grpSel) grpSel.value = 'all';
  App.ImportData.populateImportGrpDropdown();
  // 同步顶部 FilterBar（单向：表内 → 顶部）
  var topDept = document.querySelector('#page-width .filter-dept');
  if (topDept && topDept.value !== val) { topDept.value = val; App.onDeptChange('page-width'); }
  else App.ImportData.render();
};

// 小组变更 → 同步顶部 FilterBar
App.ImportData.onGrpChange = function(val) {
  var topGrp = document.querySelector('#page-width .filter-group-sel');
  if (topGrp && topGrp.value !== val) { topGrp.value = val; App.onGrpChange('page-width'); }
  else App.ImportData.render();
};


App.ImportData.render = function() {
  var isU = App.ImportData.currentView === 'user', data = (isU ? App.ImportData.UserGS : App.ImportData.CustGS).slice();
  var srch = ((document.getElementById('wImportSearch') || {}).value || '').trim().toLowerCase();
  var srt = (document.getElementById('wImportSort') || {}).value || 'width_desc';

  // 首次渲染时同步顶部筛选状态到表内下拉（仅在选项未初始化时）
  var topState = (typeof App.getFilterState === 'function') ? App.getFilterState('page-width') : { team: 'all', group: 'all' };
  var deptSel = document.getElementById('wImportDeptFilter');
  var grpSel = document.getElementById('wImportGroupFilter');
  if (deptSel && deptSel.options.length <= 1) {
    App.ImportData.populateImportDeptDropdown();
    if (topState.team !== 'all' && deptSel.querySelector('option[value="' + topState.team + '"]')) {
      deptSel.value = topState.team;
    }
    App.ImportData.populateImportGrpDropdown();
    if (topState.group !== 'all' && grpSel && grpSel.querySelector('option[value="' + topState.group + '"]')) {
      grpSel.value = topState.group;
    }
  }

  var deptFilter = deptSel ? deptSel.value : 'all';
  var groupFilter = grpSel ? grpSel.value : 'all';
  var periodSel = document.getElementById('wImportPeriodFilter');

  // 动态填充月份下拉（每次渲染都刷新）
  if (periodSel) {
    var periods = {};
    (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
      var p = r.snapshotPeriod || '';
      if (p) periods[p] = true;
    });
    var curVal = periodSel.value;
    var monthList = Object.keys(periods).sort();
    if (monthList.length === 0) {
      periodSel.innerHTML = '<option value="">无数据</option>';
    } else {
      var latest = monthList[monthList.length - 1];
      periodSel.innerHTML = monthList.map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
      periodSel.value = periods[curVal] ? curVal : latest;
    }
  }

  var periodFilter = periodSel ? periodSel.value : '';
  var pageSize = App.ImportData.getPageSize();
  if (pageSize === 0) pageSize = Math.max(data.length, 1);
  // 月份筛选（选中哪个就筛哪个，没数据就显示空）
  if (periodFilter && periodFilter !== 'all') {
    data = data.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  if (deptFilter !== 'all') data = data.filter(function(r) { return (r.dept || '') === deptFilter; });
  if (groupFilter !== 'all') data = data.filter(function(r) { return (r.group || r.dept || '') === groupFilter; });
  if (srch) data = data.filter(function(r) { return (r.user || r.name || '').toLowerCase().indexOf(srch) >= 0 || (r.sales || '').toLowerCase().indexOf(srch) >= 0; });
  // 排序
  if (srt === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (srt === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });
  else if (srt === 'name') data.sort(function(a,b) { return (a.user||a.name).localeCompare(b.user||b.name); });

  var total = data.length, totalPages = Math.ceil(total / pageSize);
  var page = App.ImportData._page || 1;
  if (page > totalPages && totalPages > 0) { page = totalPages; App.ImportData._page = page; }
  var start = (page - 1) * pageSize, paged = data.slice(start, start + pageSize);

  App.setText('w-import-view-title', (isU ? '用户产品宽度 (' : '客户产品宽度 (') + total + ' 条)');
  // 同步更新右上角客户/用户数量标签（按当前筛选条件，筛空回退全部）
  var filteredUser = App.ImportData.UserGS.slice();
  var filteredCust = App.ImportData.CustGS.slice();
  if (periodFilter && periodFilter !== 'all') {
    filteredUser = filteredUser.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    filteredCust = filteredCust.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  if (deptFilter !== 'all') { filteredUser = filteredUser.filter(function(r) { return (r.dept || '') === deptFilter; }); filteredCust = filteredCust.filter(function(r) { return (r.dept || '') === deptFilter; }); }
  if (groupFilter !== 'all') { filteredUser = filteredUser.filter(function(r) { return (r.group || r.dept || '') === groupFilter; }); filteredCust = filteredCust.filter(function(r) { return (r.group || r.dept || '') === groupFilter; }); }
  var isGs2 = function(r) { var g=(r.guishang||'').toString().trim(); return g==='是'||g==='1'; };
  App.setText('w-total-user-gs', filteredUser.filter(isGs2).length);
  App.setText('w-total-user-ngs', filteredUser.length - filteredUser.filter(isGs2).length);
  App.setText('w-total-cust-gs', filteredCust.filter(isGs2).length);
  App.setText('w-total-cust-ngs', filteredCust.length - filteredCust.filter(isGs2).length);

  var prods = App.ImportData.PRODS, sp = App.ImportData.shortProds;
  var thead = document.getElementById('wImportDataThead');
  if (thead) {
    var th = '<th style="width:32px"><input type="checkbox" id="wImportCheckAll" onchange="App.ImportData.toggleAll(this)" title="全选/取消"></th><th style="width:44px">序号</th>';
    if (isU) th += '<th>最终用户-行业</th><th>siebel编码</th><th style="min-width:130px">最终用户</th><th>销售</th><th>组</th><th>销售部门</th><th style="text-align:center">规上</th><th style="text-align:center">产品线合计</th>';
    else th += '<th>siebel编码</th><th style="min-width:150px">售达方描述(客户)</th><th>销售</th><th>组</th><th>销售部门</th><th style="text-align:center">规上</th><th style="text-align:center">产品线合计</th>';
    sp.forEach(function(s, i) { th += '<th style="text-align:center" title="' + prods[i] + '">' + s + '</th>'; });
    th += (isU ? '<th>接口人</th><th style="text-align:center">用户等级</th>' : '<th>接口人</th><th style="text-align:center">客户等级</th>');
    thead.innerHTML = '<tr>' + th + '</tr>';
  }

  var h = '', maxW = Math.max.apply(null, data.map(function(r) { return r.width; }).concat([1]));
  paged.forEach(function(r, ri) {
    var pct = Math.round(r.width / Math.max(1, maxW) * 100);
    var key = isU ? r.user : r.name;
    h += '<tr data-key="' + key.replace(/"/g,'&quot;') + '" data-backend-id="' + (r.id || '') + '" data-idx="' + (start + ri) + '" data-snapshot-period="' + (r.snapshotPeriod || '') + '">';
    h += '<td style="text-align:center"><input type="checkbox" class="w-import-cb" data-key="' + key.replace(/"/g,'&quot;') + '" onclick="event.stopPropagation()"></td>' + '<td style="text-align:center;font-size:11px;color:#94a3b8">' + (start + ri + 1) + '</td>';
    if (isU) { h += '<td>' + (r.industry || '-') + '</td><td style="font-size:11px">' + (r.siebel || '-') + '</td><td class="name-cell"><strong>' + App.escapeHtml(r.user) + '</strong></td>'; }
    else { h += '<td style="font-size:11px">' + (r.siebel || '-') + '</td><td class="name-cell"><strong>' + App.escapeHtml(r.name) + '</strong></td>'; }
    h += '<td>' + App.escapeHtml(r.sales || '-') + '</td>';
    h += '<td>' + App.escapeHtml(r.group || '-') + '</td>';
    h += '<td>' + App.escapeHtml(r.dept || '-') + '</td>';
    var gs = r.guishang || '否';
    h += '<td style="text-align:center"><span class="badge ' + (gs==='是'?'badge-on':'badge-off') + '">' + gs + '</span></td>';
    h += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:4px;justify-content:center"><div style="width:50px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:3px"></div></div><span style="font-weight:700;color:#2563eb;min-width:22px">' + r.width + '</span></div></td>';
    prods.forEach(function(p) { h += '<td style="text-align:center;color:' + ((r.prods[p] || 0) > 0 ? '#059669' : '#d1d5db') + '">' + ((r.prods[p] || 0) > 0 ? '✓' : '-') + '</td>'; });
    h += '<td>' + (r.contact || '-') + '</td>';
    h += '<td style="text-align:center;font-size:11px">' + (r.level || '-') + '</td></tr>';
  });
  var tc = prods.length + (isU ? 10 : 9) + 2;
  if (data.length === 0) h = '<tr><td colspan="' + tc + '" style="text-align:center;padding:24px;color:#94a3b8">请上传总表文件</td></tr>';
  var tb = document.getElementById('wImportDataTbody'); if (tb) tb.innerHTML = h;
  document.getElementById('wImportCheckAll').checked = false;

  App.setText('wImportPageInfo', (page-1)*pageSize+1 + '–' + Math.min(page*pageSize, total) + ' / ' + total + ' 条');
  var pbtns = document.getElementById('wImportPageBtns');
  if (pbtns && totalPages > 1) {
    var ph = '';
    if (page > 1) ph += '<button class="page-btn" onclick="App.ImportData.goPage(' + (page-1) + ')">←</button>';
    for (var i = 1; i <= totalPages && i <= 8; i++) ph += '<button class="page-btn' + (i === page ? ' active' : '') + '" onclick="App.ImportData.goPage(' + i + ')">' + i + '</button>';
    if (page < totalPages) ph += '<button class="page-btn" onclick="App.ImportData.goPage(' + (page+1) + ')">→</button>';
    pbtns.innerHTML = ph;
  } else if (pbtns) { pbtns.innerHTML = ''; }
};

App.ImportData.goPage = function(p) { App.ImportData._page = p; App.ImportData.render(); };

App.ImportData.getSelectedKeys = function() {
  var cbs = document.querySelectorAll('.w-import-cb:checked');
  var keys = [];
  cbs.forEach(function(cb) { keys.push(cb.getAttribute('data-key')); });
  return keys;
};

App.ImportData.toggleAll = function(cb) {
  var cbs = document.querySelectorAll('.w-import-cb');
  cbs.forEach(function(c) { c.checked = cb.checked; });
};

App.ImportData.selectAll = function() {
  var cbs = document.querySelectorAll('.w-import-cb');
  cbs.forEach(function(c) { c.checked = true; });
  var all = document.getElementById('wImportCheckAll');
  if (all) all.checked = true;
};

App.ImportData.deselectAll = function() {
  var cbs = document.querySelectorAll('.w-import-cb');
  cbs.forEach(function(c) { c.checked = false; });
  var all = document.getElementById('wImportCheckAll');
  if (all) all.checked = false;
};

App.ImportData.batchDelete = function() {
  var keys = App.ImportData.getSelectedKeys();
  if (keys.length === 0) { alert('请先勾选要删除的记录'); return; }

  // 必须选择月份才能删除（防止误删其他月份数据）
  var periodSel = document.getElementById('wImportPeriodFilter');
  var selectedPeriod = periodSel ? (periodSel.value && periodSel.value !== 'all' && periodSel.value !== '' ? periodSel.value : '') : '';
  if (!selectedPeriod) {
    alert('请先在「月份」下拉筛选器中选择要删除的月份，再进行删除操作。\n\n此限制是为了防止误删其他月份的数据。');
    return;
  }

  if (!confirm('确定删除 ' + selectedPeriod + ' 月份下选中的 ' + keys.length + ' 条记录吗？\n\n此操作不可撤销，仅删除所选月份的数据。')) return;
  var isU = App.ImportData.currentView === 'user';
  var arr = isU ? App.ImportData.UserGS : App.ImportData.CustGS;
  var keyField = isU ? 'user' : 'name';

  // 收集选中行的后端 ID（仅收集当前月份的数据行，通过 DOM 属性校验）
  var ids = [];
  var cbs = document.querySelectorAll('.w-import-cb:checked');
  cbs.forEach(function(cb) {
    var row = cb.closest('tr');
    if (row) {
      var rowPeriod = row.getAttribute('data-snapshot-period') || '';
      if (rowPeriod !== selectedPeriod) return;  // 安全校验：跳过非当前月份的勾选
      var bid = row.getAttribute('data-backend-id');
      if (bid) ids.push(parseInt(bid));
    }
  });

  // 先从后端删除（精确 ID 删除），再从当前月份的数据中清除
  var delPromise = ids.length > 0
    ? App.API.batchDeleteWidthRecords(ids)
    : Promise.resolve({ ok: true, deleted: 0 });

  delPromise.then(function(r) {
    console.log('[batchDelete] 后端删除 ' + (r.deleted || ids.length) + ' 条, 月份: ' + selectedPeriod);
    // 只删除当前选中月份的记录（同key不同月的数据保留）
    for (var i = arr.length - 1; i >= 0; i--) {
      if (keys.indexOf(arr[i][keyField]) >= 0 && (arr[i].snapshotPeriod || '') === selectedPeriod) {
        arr.splice(i, 1);
      }
    }
    App.ImportData.persist();
    App.ImportData.syncToRaw(); App.ImportData.updateTags(); App.ImportData.render();
    App.WidthDetail.clearCache();
    try { App.updateWidth(); } catch(e) {}
    try { App.addLog('批量删除', '产品宽度', '删除 ' + selectedPeriod + ' 月份 ' + keys.length + ' 条' + (isU ? '用户' : '客户') + '记录'); } catch(e) {}
  }).catch(function(err) {
    alert('❌ 后端删除失败: ' + err.message + '\n请刷新页面重试');
  });
  App.WidthDetail.clearCache(); App.updateWidth();
  try { App.addLog('删除数据', '产品宽度', '批量删除 ' + selectedPeriod + ' 月份 ' + keys.length + ' 条记录'); } catch(e) {}
};


// 列宽拖动调整
App.ImportData._colResize = null;
document.addEventListener('mousemove', function(e) {
  if (!App.ImportData._colResize) return;
  var dx = e.clientX - App.ImportData._colResize.startX;
  var newW = Math.max(40, App.ImportData._colResize.startW + dx);
  App.ImportData._colResize.th.style.width = newW + 'px';
  App.ImportData._colResize.th.style.minWidth = newW + 'px';
});
document.addEventListener('mouseup', function() {
  if (!App.ImportData._colResize) return;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  App.ImportData._colResize = null;
});

App.ImportData.initColResize = function() {
  var thead = document.getElementById('wImportDataThead');
  if (!thead) return;
  var ths = thead.querySelectorAll('th');
  ths.forEach(function(th, i) {
    if (th.querySelector('.resize-handle')) return;
    var handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:6px;cursor:col-resize;z-index:3';
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault(); e.stopPropagation();
      App.ImportData._colResize = { colIdx: i, startX: e.clientX, startW: th.offsetWidth, th: th };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    th.style.position = 'relative';
    th.appendChild(handle);
  });
};

App.ImportData.startEdit = function(td, field) {
  if (td.classList.contains('editing')) return;
  var isU = App.ImportData.currentView === 'user';
  var arr = isU ? App.ImportData.UserGS : App.ImportData.CustGS;
  var page = App.ImportData._page || 1;
  var pageSize = App.ImportData.getPageSize();
  if (pageSize === 0) pageSize = Math.max(arr.length, 1);
  var tr = td.parentElement;
  var rows = Array.from(tr.parentElement.children);
  var rowIdx = rows.indexOf(tr);
  var idx = (page - 1) * pageSize + rowIdx;
  var record = arr[idx];
  if (!record) return;
  var orig = record[field] || '';
  td.classList.add('editing');
  var inp = document.createElement('input');
  inp.value = orig;
  inp.style.cssText = 'width:' + Math.max(orig.length*12,60) + 'px;padding:4px 6px;font-size:12px;border:1px solid #1a56db;border-radius:3px;outline:none';
  td.textContent = ''; td.appendChild(inp); inp.focus(); inp.select();
  var save = function() {
    var v = inp.value.trim(); record[field] = v;
    // 编辑 sales 后自动回填组和部门
    if (field === 'sales' && v) {
      record.dept = App.ImportData.lookupDept(v, record.dept);
      var grpTd = td.nextElementSibling;           // 组
      var deptTd = grpTd ? grpTd.nextElementSibling : null;  // 销售部门
      if (grpTd) grpTd.textContent = record.group || '-';
      if (deptTd) deptTd.textContent = record.dept || '-';
    }
    // 编辑组后自动推导部门
    if (field === 'group' && v) {
      record.dept = App.ImportData.resolveDept(v);
      var nextTd = td.nextElementSibling;
      if (nextTd) nextTd.textContent = record.dept || '-';
    }
    td.classList.remove('editing');
    td.textContent = v || '-';
    App.ImportData.persist();  // 持久化
    App.ImportData.syncToRaw(); App.WidthDetail.clearCache(); App.updateWidth();
  setTimeout(function() { App.ImportData.initColResize(); }, 50);
  };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { td.textContent = orig || '-'; td.classList.remove('editing'); } });
};
