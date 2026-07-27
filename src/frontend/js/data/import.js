// ===== 数据导入与管理 — 总表上传/数据源切换/自动去重更新 =====
App.ImportData = App.ImportData || {};
App.ImportData.currentView = 'user';
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
// 优先使用导入的 dept 值；仅在 dept 为空时才反查
App.ImportData.lookupDept = function(salesName, selfDept) {
  var dept = (selfDept || '').trim();
  if (dept) return dept;  // 1) 优先用导入的 dept
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
  try { localStorage.setItem('pa_width_user', JSON.stringify(App.ImportData.UserGS || [])); } catch(e) { console.warn(e); }
  try { localStorage.setItem('pa_width_cust', JSON.stringify(App.ImportData.CustGS || [])); } catch(e) { console.warn(e); }
};

// 统一规上识别：是/y/yes/true/1/√/✓/对 → '是'，其他 → '否'
App.ImportData.parseGuishang = function(v) {
  var s = String(v || '').toLowerCase().trim();
  return (s.indexOf('是') >= 0 || s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === '√' || s === '✓' || s === '对') ? '是' : '否';
};

App.ImportData.history = [];
App.ImportData.init = function() {
  // 恢复历史记录
  try { var sh = localStorage.getItem('pa_w_history'); if (sh) App.ImportData.history = JSON.parse(sh); } catch(e) {}
  // 先从 localStorage 缓存快速恢复（避免白屏等待）
  try {
    var cachedUser = localStorage.getItem('pa_width_user');
    var cachedCust = localStorage.getItem('pa_width_cust');
    if (cachedUser) App.ImportData.UserGS = JSON.parse(cachedUser);
    if (cachedCust) App.ImportData.CustGS = JSON.parse(cachedCust);
    if (cachedUser || cachedCust) {
      App.ImportData.syncToRaw();
      App.ImportData.updateTags();
      App.ImportData.renderHistory();
      App.ImportData.render();
      try { App.updateWidth(); } catch(e) {}
    }
  } catch(e) {}
  // 从后端 API 拉取最新数据（覆盖缓存）
  fetch('/api/import/width-records?type=user').then(function(r) { return r.json(); }).then(function(data) {
    if (data.rows && data.rows.length > 0) {
      App.ImportData.UserGS = data.rows.map(function(r) {
        return { user: r.name, siebel: r.siebel, industry: r.industry, sales: r.sales, group: r.group, dept: App.ImportData.resolveDept(r.group), guishang: r.guishang, width: r.width, prods: r.prods, contact: r.contact, level: r.level };
      });
    }
  }).catch(function(){}).finally(function() {
    return fetch('/api/import/width-records?type=cust').then(function(r) { return r.json(); }).then(function(data) {
      if (data.rows && data.rows.length > 0) {
        App.ImportData.CustGS = data.rows.map(function(r) {
          return { name: r.name, siebel: r.siebel, sales: r.sales, group: r.group, dept: App.ImportData.resolveDept(r.group), guishang: r.guishang, width: r.width, prods: r.prods, contact: r.contact, level: r.level };
        });
      }
    }).catch(function(){});
  }).finally(function() {
    App.ImportData.syncToRaw();
    App.ImportData.updateTags();
    App.ImportData.renderHistory();
    App.ImportData.render();
    App.ImportData.persist();  // 写入 localStorage 缓存
    try { App.updateWidth(); } catch(e) {}
    try { App.updatePotential(); } catch(e) {}
    try { App.updateOverview(); } catch(e) {}
  });
};

// 保存快照到历史
App.ImportData.saveToHistory = function(fileName) {
  var now = new Date();
  var ds = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
  var entry = {
    id: Date.now(), file: fileName || '手动快照', time: ds,
    userCount: (App.ImportData.UserGS || []).length,
    custCount: (App.ImportData.CustGS || []).length,
    total: (App.ImportData.UserGS || []).length + (App.ImportData.CustGS || []).length,
    person: '当前用户',
    userSnap: JSON.parse(JSON.stringify(App.ImportData.UserGS || [])),
    custSnap: JSON.parse(JSON.stringify(App.ImportData.CustGS || []))
  };
  App.ImportData.history.unshift(entry);
  if (App.ImportData.history.length > 20) App.ImportData.history = App.ImportData.history.slice(0, 20);
  App.ImportData.renderHistory();
  // 持久化到 localStorage（仅元数据，不含销售数据快照）
  try {
    var meta = App.ImportData.history.map(function(h) {
      return {id:h.id, file:h.file, time:h.time, userCount:h.userCount, custCount:h.custCount, total:h.total, person:h.person};
    });
    localStorage.setItem('pa_w_history', JSON.stringify(meta));
  } catch(e) {}
};

// 渲染历史列表
App.ImportData.renderHistory = function() {
  var tbody = document.getElementById('wImportHistoryTable');
  if (!tbody) return;
  if (App.ImportData.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">暂无历史记录，上传文件后自动保存</td></tr>';
    return;
  }
  var html = '';
  App.ImportData.history.forEach(function(h, i) {
    html += '<tr>';
    html += '<td><span class="rn rn0">' + (i + 1) + '</span></td>';
    html += '<td><strong>' + h.file + '</strong></td>';
    html += '<td style="text-align:center;font-size:11px">' + h.time + '</td>';
    html += '<td style="text-align:center;font-weight:600;color:#1e40af">' + h.userCount + '</td>';
    html += '<td style="text-align:center;font-weight:600;color:#166534">' + h.custCount + '</td>';
    html += '<td style="text-align:center">' + h.total + '</td>';
    html += '<td style="font-size:11px">' + h.person + '</td>';
    html += '<td style="text-align:center">';
    html += '<button class="btn-ghost" style="padding:2px 6px;font-size:10px" onclick="App.ImportData.restoreHistory(' + i + ')" title="恢复到此版本">🔄恢复</button> ';
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
  try { localStorage.setItem('pa_w_history', JSON.stringify(App.ImportData.history)); } catch(e) {}
};

// 删除历史记录
App.ImportData.deleteHistory = function(idx) {
  if (!confirm('确定删除此历史记录吗？')) return;
  App.ImportData.history.splice(idx, 1);
  App.ImportData.renderHistory();
  try { localStorage.setItem('pa_w_history', JSON.stringify(App.ImportData.history)); } catch(e) {}
};

// 清空所有历史记录
App.ImportData.clearAll = function() {
  if (!confirm('确定清空所有历史记录吗？当前数据不会被影响。')) return;
  App.ImportData.history = [];
  App.ImportData.renderHistory();
};

// 清空全部导入数据并重置平台
App.ImportData.resetAll = function() {
  if (!confirm('确定清空所有导入数据吗？\n\n此操作将清除：\n- 产品宽度导入数据\n- 潜力产品导入数据\n- 所有历史记录\n- 本地缓存\n- 后端数据库\n\n此操作不可撤销！')) return;
  // 先调后端清空数据库（不 await，避免阻塞）
  try { fetch('/api/import/width-records', { method: 'DELETE' }); } catch(e) {}
  try { fetch('/api/import/potential-cust', { method: 'DELETE' }); } catch(e) {}
  try { fetch('/api/import/potential-user', { method: 'DELETE' }); } catch(e) {}
  // 清空 localStorage
  try { localStorage.removeItem('pa_w_history'); } catch(e) {}
  try { localStorage.removeItem('pa_p_history'); } catch(e) {}
  try { localStorage.removeItem('pa_width_user'); } catch(e) {}
  try { localStorage.removeItem('pa_width_cust'); } catch(e) {}
  // 清空内存
  App.ImportData.UserGS = [];
  App.ImportData.CustGS = [];
  App.ImportData.history = [];
  App.WidthCustomer.RAW = [];
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
  alert('✅ 已清空所有导入数据（含后端数据库），平台已恢复空状态');
};

// 下载当前数据为 Excel
App.ImportData.exportCurrent = function() {
  if (typeof XLSX === 'undefined') { alert('XLSX库未加载'); return; }
  var wb = XLSX.utils.book_new();
  var products = App.ImportData.PRODS;
  // 用户sheet
  var userRows = [['最终用户-行业','siebel编码','最终用户','销售','销售部门','是否规上','产品线合计'].concat(products).concat(['接口人','用户等级'])];
  (App.ImportData.UserGS || []).forEach(function(u) {
    var row = [u.industry||'', u.siebel||'', u.user, u.sales||'', u.dept||'', u.guishang||'是', u.width];
    products.forEach(function(p) { row.push(u.prods[p] || 0); });
    row.push(u.contact||'', u.level||'');
    userRows.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(userRows), '规上用户-产品线宽度');
  // 客户sheet
  var custRows = [['siebel编码','售达方描述(客户)','销售','销售部门','是否规上','产品线合计'].concat(products).concat(['接口人','客户等级'])];
  (App.ImportData.CustGS || []).forEach(function(c) {
    var row = [c.siebel||'', c.name, c.sales||'', c.dept||'', c.guishang||'是', c.width];
    products.forEach(function(p) { row.push(c.prods[p] || 0); });
    row.push(c.contact||'', c.level||'');
    custRows.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(custRows), '客户产品线覆盖');
  var now = new Date();
  var fn = '产品宽度总表_' + now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2) + '.xlsx';
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
  App.setText('w-total-user-count', (App.ImportData.UserGS || []).length);
  App.setText('w-total-cust-count', (App.ImportData.CustGS || []).length);
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
      App.ImportData.UserGS = d.rows.map(function(r){return {user:r.name,siebel:r.siebel,industry:r.industry,sales:r.sales,group:r.group,dept:App.ImportData.resolveDept(r.group),guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level};});
    }
  }).catch(function(){}).finally(function(){
    return fetch('/api/import/width-records?type=cust').then(function(r){return r.json();}).then(function(d){
      if (d.rows && d.rows.length > 0) {
        App.ImportData.CustGS = d.rows.map(function(r){return {name:r.name,siebel:r.siebel,group:r.group,dept:App.ImportData.resolveDept(r.group),sales:r.sales,guishang:r.guishang,width:r.width,prods:r.prods,contact:r.contact,level:r.level};});
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
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result), wb = XLSX.read(data, { type: 'array' }), products = App.ImportData.PRODS;
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
          try { App.Field.detectSchema(hd, 'width.user'); } catch(e) {}
          var col = App.ImportData.mapCols(hd, 'user');
          // 按 siebel编码 去重（唯一标识）
          var em = {}; App.ImportData.UserGS.forEach(function(r) { em[r.siebel] = r; });
          j.slice(1).forEach(function(row) {
            var siebel = String(row[col.siebel] || '').trim();
            var nm = String(row[col.user] || '').trim();
            if (!siebel && !nm) return;
            var key = siebel || nm;
            var salesName = String(row[col.sales] || '').trim();
            var deptInput = String(row[col.dept] || '').trim();
            var resolvedDept = App.ImportData.lookupDept(salesName, deptInput);
            var e = { user: nm, siebel: siebel, industry: String(row[col.industry] || '').trim(), sales: salesName, group: deptInput, dept: resolvedDept, guishang: App.ImportData.parseGuishang(row[col.guishang]), width: parseInt(row[col.width]) || 0, prods: {}, contact: String(row[col.contact] || '').trim(), level: String(row[col.level] || '').trim() };
            products.forEach(function(p, i) { e.prods[p] = (row[col.prodStart + i] === 1 || String(row[col.prodStart + i]).trim() === '1') ? 1 : 0; });
            if (em[key]) { uu++; Object.assign(em[key], e); } else { nu++; App.ImportData.UserGS.push(e); em[key] = e; }
          });
        } else if (hasCust && !foundCust) {
          foundCust = true;
          try { App.Field.detectSchema(hd, 'width.cust'); } catch(e) {}
          var col = App.ImportData.mapCols(hd, 'cust');
          // 按 siebel编码 去重（唯一标识）
          var em = {}; App.ImportData.CustGS.forEach(function(r) { em[r.siebel] = r; });
          j.slice(1).forEach(function(row) {
            var siebel = String(row[col.siebel] || '').trim();
            var nm = String(row[col.name] || '').trim();
            if (!siebel && !nm) return;
            var key = siebel || nm;
            var salesName = String(row[col.sales] || '').trim();
            var deptInput = String(row[col.dept] || '').trim();
            var resolvedDept = App.ImportData.lookupDept(salesName, deptInput);
            var e = { name: nm, siebel: siebel, sales: salesName, group: deptInput, dept: resolvedDept, guishang: App.ImportData.parseGuishang(row[col.guishang]), width: parseInt(row[col.width]) || 0, prods: {}, contact: String(row[col.contact] || '').trim(), level: String(row[col.level] || '').trim() };
            products.forEach(function(p, i) { e.prods[p] = (row[col.prodStart + i] === 1 || String(row[col.prodStart + i]).trim() === '1') ? 1 : 0; });
            if (em[key]) { uc++; Object.assign(em[key], e); } else { nc++; App.ImportData.CustGS.push(e); em[key] = e; }
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
      App.ImportData.saveToHistory(file.name);
      try { App.Data.rebuildDerived(); } catch(e) { console.warn('rebuildDerived failed:', e); }

      // 发送到后端数据库
      var userApiRows = App.ImportData.UserGS.map(function(r) {
        return {user: r.user, siebel: r.siebel||'', industry: r.industry||'', sales: r.sales||'', dept: r.dept||'', guishang: r.guishang||'否', width: r.width||0, prods: r.prods||{}, contact: r.contact||'', level: r.level||''};
      });
      var custApiRows = App.ImportData.CustGS.map(function(r) {
        return {name: r.name, siebel: r.siebel||'', sales: r.sales||'', dept: r.dept||'', guishang: r.guishang||'否', width: r.width||0, prods: r.prods||{}, contact: r.contact||'', level: r.level||''};
      });
      var apiCalls = [];
      if (userApiRows.length > 0) apiCalls.push(App.API.sendWidth(userApiRows, 'user'));
      if (custApiRows.length > 0) apiCalls.push(App.API.sendWidth(custApiRows, 'cust'));
      var msg = '导入完成! 文件: ' + file.name;
      msg += '\n\n规上用户: 新增' + nu + ' / 更新' + uu + '（共' + App.ImportData.UserGS.length + '）';
      if (!foundUser) msg += '\n  ⚠ 未找到用户sheet';
      msg += '\n规上客户: 新增' + nc + ' / 更新' + uc + '（共' + App.ImportData.CustGS.length + '）';
      if (potMatrix.length > 0) msg += '\n\n潜力产品: ' + potMatrix.length + ' 条（团队×产品矩阵）';
      if (!foundCust) msg += '\n  ⚠ 未找到客户sheet';
      msg += '\n\n识别sheets: ' + wb.SheetNames.join(', ');
      if (apiCalls.length > 0) {
        Promise.all(apiCalls).then(function() {
          alert(msg + '\n\n✅ 已同步后端数据库');
        }).catch(function(err) {
          alert(msg + '\n\n⚠️ 后端保存失败：' + err.message + '\n数据仅在前端内存中，刷新后消失。');
        });
      } else {
        alert(msg);
      }
    } catch(err) { alert('解析失败: ' + err.message); }
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
  var nr = [], p = App.ImportData.PRODS;
  var seenUsers = new Set();
  App.ImportData.UserGS.forEach(function(u) { nr.push({ team: u.dept || '', account: u.sales || '', user: u.user, width: u.width, guishang: u.guishang === '是' ? 1 : 0, prods: u.prods }); seenUsers.add(u.user); });
  App.ImportData.CustGS.forEach(function(c) { if (!seenUsers.has(c.name)) { nr.push({ team: c.dept || '', account: c.sales || '', user: c.name, width: c.width, guishang: c.guishang === '是' ? 1 : 0, prods: c.prods }); seenUsers.add(c.name); } });
  App.WidthCustomer.RAW = nr;
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

// 部门变更 → 级联刷新小组下拉 + 重渲表格
App.ImportData.onDeptChange = function(val) {
  var grpSel = document.getElementById('wImportGroupFilter');
  if (grpSel) grpSel.value = 'all';
  App.ImportData.populateImportGrpDropdown();
  App.ImportData.render();
};

// 小组变更 → 重渲表格
App.ImportData.onGrpChange = function(val) {
  App.ImportData.render();
};


App.ImportData.render = function() {
  var isU = App.ImportData.currentView === 'user', data = (isU ? App.ImportData.UserGS : App.ImportData.CustGS).slice();
  var srch = ((document.getElementById('wImportSearch') || {}).value || '').trim().toLowerCase();
  var srt = (document.getElementById('wImportSort') || {}).value || 'width_desc';

  // 同步顶部筛选状态到表内下拉（首次渲染 / Tab 切换时）
  var topState = (typeof App.getFilterState === 'function') ? App.getFilterState('page-width') : { team: 'all', group: 'all' };
  var deptSel = document.getElementById('wImportDeptFilter');
  var grpSel = document.getElementById('wImportGroupFilter');
  if (deptSel && deptSel.options.length <= 1) {
    App.ImportData.populateImportDeptDropdown();
    // 联动顶部状态
    if (topState.team !== 'all' && deptSel.querySelector('option[value="' + topState.team + '"]')) {
      deptSel.value = topState.team;
      App.ImportData.populateImportGrpDropdown();
      if (topState.group !== 'all' && grpSel && grpSel.querySelector('option[value="' + topState.group + '"]')) {
        grpSel.value = topState.group;
      }
    }
  }

  var deptFilter = deptSel ? deptSel.value : 'all';
  var groupFilter = grpSel ? grpSel.value : 'all';

  var pageSize = App.ImportData.getPageSize();
  if (pageSize === 0) pageSize = Math.max(data.length, 1);
  // 应用筛选（value 为 'all' 时不过滤）
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

  App.setText('w-import-view-title', (isU ? '规上用户产品宽度 (' : '规上客户产品宽度 (') + total + ' 条)');

  var prods = App.ImportData.PRODS, sp = App.ImportData.shortProds;
  var thead = document.getElementById('wImportDataThead');
  if (thead) {
    var th = '<th style="width:32px"><input type="checkbox" id="wImportCheckAll" onchange="App.ImportData.toggleAll(this)" title="全选/取消"></th><th style="width:44px">序号</th>';
    if (isU) th += '<th>最终用户-行业</th><th>siebel编码</th><th style="min-width:130px">最终用户</th><th>销售</th><th>销售部门</th><th style="text-align:center">规上</th><th style="text-align:center">产品线合计</th>';
    else th += '<th>siebel编码</th><th style="min-width:150px">售达方描述(客户)</th><th>销售</th><th>销售部门</th><th style="text-align:center">规上</th><th style="text-align:center">产品线合计</th>';
    sp.forEach(function(s, i) { th += '<th style="text-align:center" title="' + prods[i] + '">' + s + '</th>'; });
    th += (isU ? '<th>接口人</th><th style="text-align:center">用户等级</th>' : '<th>接口人</th><th style="text-align:center">客户等级</th>');
    thead.innerHTML = '<tr>' + th + '</tr>';
  }

  var h = '', maxW = Math.max.apply(null, data.map(function(r) { return r.width; }).concat([1]));
  paged.forEach(function(r, ri) {
    var pct = Math.round(r.width / Math.max(1, maxW) * 100);
    var key = isU ? r.user : r.name;
    h += '<tr data-key="' + key.replace(/"/g,'&quot;') + '">';
    h += '<td style="text-align:center"><input type="checkbox" class="w-import-cb" data-key="' + key.replace(/"/g,'&quot;') + '" onclick="event.stopPropagation()"></td>' + '<td style="text-align:center;font-size:11px;color:#94a3b8">' + (start + ri + 1) + '</td>';
    if (isU) { h += '<td>' + (r.industry || '-') + '</td><td style="font-size:11px">' + (r.siebel || '-') + '</td><td class="name-cell"><strong>' + App.escapeHtml(r.user) + '</strong></td>'; }
    else { h += '<td style="font-size:11px">' + (r.siebel || '-') + '</td><td class="name-cell"><strong>' + App.escapeHtml(r.name) + '</strong></td>'; }
    h += '<td>' + App.escapeHtml(r.sales || '-') + '</td>';
    h += '<td>' + App.escapeHtml(r.group || r.dept || '-') + '</td>';
    var gs = r.guishang || '否';
    h += '<td style="text-align:center"><span class="badge ' + (gs==='是'?'badge-on':'badge-off') + '">' + gs + '</span></td>';
    h += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:4px;justify-content:center"><div style="width:50px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:3px"></div></div><span style="font-weight:700;color:#2563eb;min-width:22px">' + r.width + '</span></div></td>';
    prods.forEach(function(p) { h += '<td style="text-align:center;color:' + ((r.prods[p] || 0) > 0 ? '#059669' : '#d1d5db') + '">' + ((r.prods[p] || 0) > 0 ? '✓' : '-') + '</td>'; });
    h += '<td>' + (r.contact || '-') + '</td>';
    h += '<td style="text-align:center;font-size:11px">' + (r.level || '-') + '</td></tr>';
  });
  var tc = prods.length + (isU ? 9 : 8) + 2;
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
  if (!confirm('确定删除选中的 ' + keys.length + ' 条记录吗？此操作不可撤销。')) return;
  var isU = App.ImportData.currentView === 'user';
  var arr = isU ? App.ImportData.UserGS : App.ImportData.CustGS;
  var keyField = isU ? 'user' : 'name';
  for (var i = arr.length - 1; i >= 0; i--) {
    if (keys.indexOf(arr[i][keyField]) >= 0) arr.splice(i, 1);
  }
  // 同步后端：删除该类型的全部记录后重新上传剩余数据
  var type = isU ? 'user' : 'cust';
  var remaining = isU ? App.ImportData.UserGS : App.ImportData.CustGS;
  try {
    fetch('/api/import/width-records?type=' + type, { method: 'DELETE' }).then(function() {
      if (remaining.length > 0) {
        // 重新上传剩余数据
        fetch('/api/import/width-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: remaining.map(function(r) {
            var obj = { siebel: r.siebel || '', industry: r.industry || '', name: r.user || r.name || '', sales: r.sales || '', dept: r.dept || r.group || '', guishang: r.guishang || '否', width: r.width || 0, prods: r.prods || {}, contact: r.contact || '', level: r.level || '' };
            return obj;
          }), type: type })
        });
      }
    });
  } catch(e) {}
  App.ImportData.persist();  // 同步 localStorage
  App.ImportData.syncToRaw(); App.ImportData.updateTags(); App.ImportData.render();
  App.WidthDetail.clearCache(); App.updateWidth();
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
    // 编辑 sales 后自动回填部门
    if (field === 'sales' && v) {
      record.dept = App.ImportData.lookupDept(v, record.dept);
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
