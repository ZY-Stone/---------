/**
 * app.js — 应用主逻辑
 * SPA 路由、筛选联动、子 Tab 内容切换、数据刷新、导出
 */
window.App = window.App || {};

// ===== 登录状态 =====
App.loggedInUser = null;

// ===== 应用登录逻辑 =====
App.doLogin = function() {
  var loginUserEl = document.getElementById('loginUser');
  var loginPwdEl = document.getElementById('loginPwd');
  var errEl = document.getElementById('loginError');
  var username = (loginUserEl ? loginUserEl.value : '').trim();
  var password = loginPwdEl ? loginPwdEl.value : '';

  if (!username) { if (errEl) { errEl.textContent = '请输入账号'; errEl.style.display = 'block'; } return; }
  if (!password) { if (errEl) { errEl.textContent = '请输入密码'; errEl.style.display = 'block'; } return; }

  // 优先尝试后端 API 登录
  App.API.login(username, password).then(function(apiData) {
    // 后端登录成功
    var u = apiData.user;
    App.loggedInUser = {
      id: u.id, username: u.username, name: u.name, role: u.role,
      dept: u.dept_name || '-', group: u.group_name || '-',
      dept_id: u.dept_id, group_id: u.group_id, tenant_id: u.tenant_id,
    };
    sessionStorage.setItem('pa_login', JSON.stringify({ username: u.username, role: u.role, name: u.name, token: apiData.token }));
    App.API.restoreToken();
    if (errEl) errEl.style.display = 'none';
    document.getElementById('loginOverlay').classList.add('hidden');
    App.applyRoleUI(u.role, u.name, u.dept_name, u.group_name);
    App.initAll();
  }).catch(function(err) {
    console.log('API login failed, fallback to mock:', err.message);
    // 回退到本地 Mock 登录
    _localLogin(username, password, errEl);
  });
};

// 本地 Mock 登录（后端不可用时的回退）
function _localLogin(username, password, errEl) {
  var user = App.MOCK_USERS.find(function(u) { return u.username === username; });
  if (!user) { if (errEl) { errEl.textContent = '账号或密码错误'; errEl.style.display = 'block'; } return; }

  if (password !== 'admin123') {
    if (errEl) { errEl.textContent = '账号或密码错误'; errEl.style.display = 'block'; }
    return;
  }

  if (user.role === 'person') {
    if (errEl) { errEl.textContent = '个人角色不可登录系统，请联系主管'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  App.loggedInUser = user;
  sessionStorage.setItem('pa_login', JSON.stringify({ username: user.username, role: user.role, name: user.name }));

  var overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.add('hidden');
  App.applyRoleUI(user.role, user.name, user.dept, user.group);
  App.initAll();
}

App.doLogout = function() {
  if (confirm('确定要退出登录吗？')) {
    App.loggedInUser = null;
    sessionStorage.removeItem('pa_login');
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('hidden');
    var loginUser = document.getElementById('loginUser');
    if (loginUser) loginUser.value = '';
    var loginPwd = document.getElementById('loginPwd');
    if (loginPwd) loginPwd.value = '';
    var loginError = document.getElementById('loginError');
    if (loginError) loginError.style.display = 'none';
  }
};

App.applyRoleUI = function(role, displayName, dept, group) {
  var r = App.USER_ROLES[role];
  var avatar = displayName ? displayName.charAt(0) : r.avatar;
  var avEl = document.getElementById('topbar-avatar');
  if (avEl) { avEl.textContent = avatar; avEl.style.background = r.color; }
  App.setText('topbar-name', displayName || r.name);
  var badgeEl = document.getElementById('topbar-role');
  if (badgeEl) {
    badgeEl.textContent = r.badge;
    badgeEl.style.background = r.color;
    badgeEl.style.color = '#fff';
  }
  // 组织路径: 业务中心 + 部门 + 组 + 数据范围
  var scopeParts = ['深圳业务中心'];
  if (dept && dept !== '-') scopeParts.push(dept);
  if (group && group !== '-') scopeParts.push(group);
  // 数据范围标注
  var scope = App.getDataScope();
  if (scope && scope !== '全部数据') scopeParts.push('🔒 ' + scope);
  App.setText('topbar-scope', scopeParts.join(' · '));

  // 管理员显示权限设置入口
  var permItem = document.getElementById('topbar-perm-item');
  if (permItem) {
    permItem.style.display = (role === 'admin' || role === 'gm') ? '' : 'none';
  }
};

// ===== SPA 页面路由 =====
App.showPage = function(p) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });

  var page = document.getElementById('page-' + p);
  if (page) page.classList.add('active');

  var nav = document.querySelector('.nav-item[data-page="' + p + '"]');
  if (nav) nav.classList.add('active');

  window.scrollTo(0, 0);

  // 页面切换后，触发该页面所有图表的 resize（解决隐藏容器中 Chart.js 渲染尺寸为 0 的问题）
  setTimeout(function() {
    Object.keys(App.charts).forEach(function(key) {
      var chart = App.charts[key];
      if (chart && typeof chart.resize === 'function') {
        try { chart.resize(); } catch(e) {}
      }
    });
  }, 100);
};

// ===== 侧边栏导航绑定 =====
document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    if (item.classList.contains('disabled')) return;
    App.showPage(item.dataset.page);
  });
});

// ===== 子 Tab 切换：显示/隐藏内容区块 (使用 active 类) =====
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.subtab');
  if (!btn) return;
  var bar = btn.closest('.subtabs-inline');
  if (!bar) return;
  var page = bar.closest('.page');
  if (!page) return;

  // 切换 active 样式
  bar.querySelectorAll('.subtab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var tabName = btn.getAttribute('data-tab');
  if (!tabName) return;

  // 隐藏当前页面所有 tab 内容区块
  page.querySelectorAll('[data-tab-content]').forEach(function(el) {
    el.style.display = 'none';
  });

  // 显示匹配的区块
  var target = page.querySelector('[data-tab-content="' + tabName + '"]');
  if (target) {
    target.style.display = '';
    if (tabName === 'w-team') {
      App.WidthDetail.render(); App.WidthTeamMatrix.render(); App.WidthTeamGap.render();
    }
    if (tabName === 'w-customer') {
      App.WidthCustomer.render();
    }
    if (tabName === 'w-compare') {
      App.renderCompare();
    }
    if (tabName === 'w-user') {
      App.updateWidth(); App.WidthUser.render();
    }
    if (tabName === 'w-import') {
      App.ImportData.render();
    }
    // 记录子tab操作日志
    App.addLog('切换分析维度', '当前 Tab: ' + tabName);
    if (tabName === 'p-import') {
      App.ImportPotential.render();
    }
    if (tabName === 'p-gap') {
      App.renderGapAnalysis();
    }
  }
});

// ===== 辅助：读取筛选状态 =====
App.getFilterState = function(pageId) {
  var prefix = '#' + pageId + ' ';
  var deptSel  = document.querySelector(prefix + '.filter-dept');
  var groupSel = document.querySelector(prefix + '.filter-group-sel');
  var personSel = document.querySelector(prefix + '.filter-person');
  return {
    team:   deptSel  ? deptSel.value  : 'all',
    group:  groupSel ? groupSel.value : 'all',
    person: personSel ? personSel.value : 'all'
  };
};

App.getFilterLabel = function(state) {
  if (state.person !== 'all') return '个人';
  if (state.group  !== 'all') return '小组';
  if (state.team   !== 'all') return state.team;
  return '全部部门';
};

// ===== 用户菜单切换 =====
App.toggleUserMenu = function() {
  var dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};
// 点击外部关闭
document.addEventListener('click', function(e) {
  var dd = document.getElementById('userDropdown');
  var menu = document.querySelector('.user-menu');
  if (dd && menu && !menu.contains(e.target)) { dd.style.display = 'none'; }
});

// ===== 通用模态框 =====
App.showModal = function(html) {
  var overlay = document.getElementById('appModal');
  var box = document.getElementById('appModalBox');
  if (!overlay || !box) return;
  box.innerHTML = html;
  overlay.style.display = 'flex';
};
App.closeModal = function() {
  var overlay = document.getElementById('appModal');
  if (overlay) overlay.style.display = 'none';
};
// 点击遮罩关闭
document.addEventListener('click', function(e) {
  if (e.target.id === 'appModal') App.closeModal();
});

// ===== 权限过滤：获取可见部门/组/人员（增强版：严格隔离） =====
App.getVisibleDepts = function() {
  var u = App.loggedInUser;
  if (!u) return [];
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return App.DEPTS.map(function(d) { return d.n; });
  if (u.role === 'director' || u.role === 'manager') return [u.dept];
  return [];
};
App.getVisibleGroups = function() {
  var u = App.loggedInUser;
  if (!u) return [];
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return App.GROUPS.map(function(g) { return g.n; });
  if (u.role === 'director') return App.GROUPS.filter(function(g) { return g.dept === u.dept; }).map(function(g) { return g.n; });
  if (u.role === 'manager') return [u.group];
  return [];
};
App.getVisiblePersons = function() {
  var u = App.loggedInUser;
  if (!u) return [];
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return App.PERSONS.map(function(p) { return p.n; });
  if (u.role === 'director') return App.PERSONS.filter(function(p) { return p.dept === u.dept; }).map(function(p) { return p.n; });
  if (u.role === 'manager') return App.PERSONS.filter(function(p) { return p.grp === u.group; }).map(function(p) { return p.n; });
  return [];
};
App.getDataScope = function() {
  var u = App.loggedInUser;
  if (!u) return '';
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return '全部数据';
  if (u.role === 'director') return u.dept;
  if (u.role === 'manager') return u.dept + ' / ' + u.group;
  return '';
};
// 按可见部门过滤数据数组
App.filterByVisibleDepts = function(arr, deptField) {
  var u = App.loggedInUser;
  if (!u || u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return arr;
  var vd = App.getVisibleDepts();
  return arr.filter(function(item) { return vd.indexOf(typeof deptField === 'function' ? deptField(item) : item[deptField]) >= 0; });
};

// ===== 权限过滤：获取可见部门/组/人员（原函数，保持兼容） =====
App.getFilteredDepts = function() {
  var u = App.loggedInUser;
  if (!u) return App.DEPTS;
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return App.DEPTS;
  if (u.role === 'director') return App.DEPTS.filter(function(d) { return d.n === u.dept; });
  return App.DEPTS.filter(function(d) { return d.n === u.dept; });
};
App.getFilteredGroups = function(deptVal) {
  var u = App.loggedInUser;
  var groups = App.GROUPS;
  if (u && u.role === 'manager') { groups = groups.filter(function(g) { return g.dept === u.dept && g.n === u.group; }); }
  else if (u && u.role === 'director') { groups = groups.filter(function(g) { return g.dept === u.dept; }); }
  if (deptVal) { groups = groups.filter(function(g) { return g.dept === deptVal; }); }
  return groups;
};
App.getFilteredPersons = function(deptVal, grpVal) {
  var u = App.loggedInUser;
  var persons = App.PERSONS;
  if (u && u.role === 'manager') { persons = persons.filter(function(p) { return p.dept === u.dept && p.grp === u.group; }); }
  else if (u && u.role === 'director') { persons = persons.filter(function(p) { return p.dept === u.dept; }); }
  if (deptVal) { persons = persons.filter(function(p) { return p.dept === deptVal; }); }
  if (grpVal) { persons = persons.filter(function(p) { return p.grp === grpVal; }); }
  return persons;
};

// ===== 级联下拉填充（部门 → 组 → 人员） =====
App.populateDeptDropdown = function(pageId) {
  var sel = document.querySelector('#' + pageId + ' .filter-dept');
  if (!sel) return;
  var curVal = sel.value;
  var depts = App.getFilteredDepts();
  sel.innerHTML = '<option value="all">全部部门</option>' + depts.map(function(d) { return '<option value="' + d.n + '">' + d.n + '</option>'; }).join('');
  if (depts.some(function(d) { return d.n === curVal; })) sel.value = curVal;
};
App.populateGrpDropdown = function(pageId) {
  var sel = document.querySelector('#' + pageId + ' .filter-group-sel');
  if (!sel) return;
  var curVal = sel.value;
  var deptVal = (document.querySelector('#' + pageId + ' .filter-dept') || {}).value || 'all';
  var groups = App.getFilteredGroups(deptVal !== 'all' ? deptVal : null);
  sel.innerHTML = '<option value="all">全部小组</option>' + groups.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
  if (groups.some(function(g) { return g.n === curVal; })) sel.value = curVal;
  else sel.value = 'all';
};
App.populatePersonDropdown = function(pageId) {
  var sel = document.querySelector('#' + pageId + ' .filter-person');
  if (!sel) return;
  var curVal = sel.value;
  var deptVal = (document.querySelector('#' + pageId + ' .filter-dept') || {}).value || 'all';
  var grpVal = (document.querySelector('#' + pageId + ' .filter-group-sel') || {}).value || 'all';
  var persons = App.getFilteredPersons(deptVal !== 'all' ? deptVal : null, grpVal !== 'all' ? grpVal : null);
  sel.innerHTML = '<option value="all">全部成员</option>' + persons.map(function(p) { return '<option value="' + p.n + '">' + p.n + '</option>'; }).join('');
  if (persons.some(function(p) { return p.n === curVal; })) sel.value = curVal;
  else sel.value = 'all';
};

// ===== 筛选变更回调（级联刷新筛选下拉 + 数据） =====
// 强制约束：换部门 → 小组+人员重置为all；换小组 → 人员重置为all
App.onDeptChange = function(pageId) {
  // 强制重置下层筛选
  var grpSel = document.querySelector('#' + pageId + ' .filter-group-sel');
  var personSel = document.querySelector('#' + pageId + ' .filter-person');
  if (grpSel) grpSel.value = 'all';
  if (personSel) personSel.value = 'all';
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);
  App.refreshPageData(pageId);
};
App.onGrpChange = function(pageId) {
  // 强制重置下层筛选
  var personSel = document.querySelector('#' + pageId + ' .filter-person');
  if (personSel) personSel.value = 'all';
  App.populatePersonDropdown(pageId);
  App.refreshPageData(pageId);
};
App.onPersonChange = function(pageId) {
  // 换人员：上层部门、小组保持不变，不回退
  App.refreshPageData(pageId);
};

// ===== 根据筛选条件刷新对应页面数据 =====
App.refreshPageData = function(pageId) {
  if (pageId === 'page-overview') App.updateOverview();
  else if (pageId === 'page-width') App.updateWidth();
  else if (pageId === 'page-potential') App.updatePotential();
};

// ===== 初始化页面级联筛选下拉 =====
App.initPageFilters = function(pageId) {
  App.populateDeptDropdown(pageId);
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);
};

// ===== 快速日期选择: 单周 / 双周 =====
App.setQuickDate = function(prefix, type) {
  var today = new Date();
  var endStr = today.toISOString().slice(0, 10);
  var startDate = new Date(today);
  if (type === 'week') {
    startDate.setDate(today.getDate() - 7);
    startDate.setDate(startDate.getDate() + 1); // 不含当天
  } else if (type === 'biweek') {
    startDate.setDate(today.getDate() - 14);
    startDate.setDate(startDate.getDate() + 1);
  }
  var startStr = startDate.toISOString().slice(0, 10);

  var startEl = document.getElementById(prefix + '-date-start');
  var endEl = document.getElementById(prefix + '-date-end');
  if (startEl) startEl.value = startStr;
  if (endEl) endEl.value = endStr;

  // 触发数据刷新
  var pageMap = { ov: 'page-overview', w: 'page-width', p: 'page-potential' };
  App.refreshPageData(pageMap[prefix] || 'page-overview');
};

// ===== 重置筛选条件 =====
App.resetFilters = function(pageId) {
  var today = new Date();
  var startDate = new Date(today);
  startDate.setDate(1); // 本月1号
  var prefixMap = { 'page-overview': 'ov', 'page-width': 'w', 'page-potential': 'p' };
  var prefix = prefixMap[pageId] || 'ov';

  var startEl = document.getElementById(prefix + '-date-start');
  var endEl = document.getElementById(prefix + '-date-end');
  if (startEl) startEl.value = startDate.toISOString().slice(0, 10);
  if (endEl) endEl.value = today.toISOString().slice(0, 10);

  var deptSel = document.querySelector('#' + pageId + ' .filter-dept');
  var groupSel = document.querySelector('#' + pageId + ' .filter-group-sel');
  var personSel = document.querySelector('#' + pageId + ' .filter-person');
  if (deptSel) deptSel.value = 'all';
  if (groupSel) groupSel.value = 'all';
  if (personSel) personSel.value = 'all';

  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);
  App.refreshPageData(pageId);
};

// ===== 数据总览 - 筛选联动（支持部门→组→个人级联 + 时间过滤） =====
App.updateOverview = function() {
  var state = App.getFilterState('page-overview');
  var label = App.getFilterLabel(state);
  var el = document.getElementById('overview-level');
  if (el) el.textContent = '当前粒度: ' + label;

  // 读取日期范围，计算天数比例因子（默认全月 ≈30天作为基准）
  var startEl = document.getElementById('ov-date-start');
  var endEl = document.getElementById('ov-date-end');
  var dayFactor = 1;
  if (startEl && endEl && startEl.value && endEl.value) {
    var start = new Date(startEl.value);
    var end = new Date(endEl.value);
    var days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    dayFactor = days / 30; // 以30天为基准
  }

  // 根据筛选维度聚合 KPI 数据
  var team = state.team, group = state.group, person = state.person;
  var widthVal, userWidthVal, custWidthVal, potAmtVal, potRateVal, usersVal, custVal, custMoM;

  var sum = function(arr, key) { return arr.reduce(function(s, x) { return s + (x[key] || 0); }, 0); };
  var avg = function(arr, key) { return arr.length ? sum(arr, key) / arr.length : 0; };

  if (person !== 'all') {
    // 个人粒度
    var p = App.PERSONS.find(function(x) { return x.n === person; });
    widthVal = p ? p.aw : 2.0;
    userWidthVal = p ? p.aw * 1.1 : 2.2;
    custWidthVal = p ? p.aw : 2.0;
    potAmtVal = p ? Math.round(p.cw * p.aw * 2.5) : 200;
    potRateVal = p ? (p.cov * 0.5) : 25;
    usersVal = 1;
    custVal = p ? p.cw : 20;
    custMoM = Math.round(custVal * 0.05);
  } else if (group !== 'all') {
    // 小组粒度
    var grpMembers = App.PERSONS.filter(function(x) { return x.grp === group; });
    var g = App.GROUPS.find(function(x) { return x.n === group; });
    widthVal = g ? g.aw : avg(grpMembers, 'aw');
    userWidthVal = widthVal * 1.1;
    custWidthVal = widthVal;
    potAmtVal = g ? Math.round(g.cw * g.aw * 3) : Math.round(avg(grpMembers, 'cw') * widthVal * 3);
    potRateVal = g ? g.cov * 0.5 : 30;
    usersVal = grpMembers.length;
    custVal = g ? g.cw : sum(grpMembers, 'cw');
    custMoM = Math.round(custVal * 0.05);
  } else if (team !== 'all') {
    // 部门粒度
    var deptGrps = App.GROUPS.filter(function(x) { return x.dept === team; });
    var d = App.DEPTS.find(function(x) { return x.n === team; });
    widthVal = d ? d.aw : avg(deptGrps, 'aw');
    userWidthVal = widthVal * 1.1;
    custWidthVal = widthVal;
    potAmtVal = d ? Math.round(d.cw * d.aw * 3) : Math.round(sum(deptGrps, 'cw') * widthVal * 3);
    potRateVal = d ? d.cov * 0.5 : 30;
    usersVal = deptGrps.length;
    custVal = d ? d.cw : sum(deptGrps, 'cw');
    custMoM = Math.round(custVal * 0.05);
  } else {
    // 全平台粒度
    widthVal = avg(App.DEPTS, 'aw');
    userWidthVal = widthVal * 1.35;
    custWidthVal = widthVal;
    potAmtVal = sum(App.DEPTS, 'cw') * widthVal * 3;
    potAmtVal = Math.round(potAmtVal);
    potRateVal = 34.6;
    usersVal = App.PERSONS.length;
    custVal = sum(App.DEPTS, 'cw');
    custMoM = Math.round(custVal * 0.05);
  }

  // 宽度类指标不受时间影响，金额/客户数/用户数受时间范围影响
  var adjPotAmt = Math.round(potAmtVal * dayFactor);
  var adjUsers  = Math.max(1, Math.round(usersVal * dayFactor));
  var adjCust   = Math.max(1, Math.round(custVal * dayFactor));
  var adjCustMoM= Math.max(1, Math.round(custMoM * dayFactor));

  App.setText('ov-kpi-width',             widthVal.toFixed(2));
  App.setText('ov-kpi-user-width',        userWidthVal.toFixed(2));
  App.setText('ov-kpi-cust-width',        custWidthVal.toFixed(2));
  App.setText('ov-kpi-potential-amt-v',   '¥ ' + adjPotAmt.toLocaleString() + '万');
  App.setText('ov-kpi-potential-rate',    potRateVal.toFixed(1) + '%');
  App.setText('ov-kpi-users',             adjUsers);
  App.setText('ov-kpi-customers',         adjCust.toLocaleString());
  App.setText('ov-kpi-cust-mom',          '+' + adjCustMoM);
  // 备注：规上用户数 / 规上客户数
  App.setText('ov-kpi-scale-users',       adjUsers);
  App.setText('ov-kpi-scale-customers',   Math.round(adjCust * 0.71));

  // 更新柱状图（按 部门/组 切换按钮粒度）
  App._refreshOvBarCharts();

  // 更新产品宽度趋势图 — 按筛选维度动态构建数据
  var wtChart = App.charts['ov_width-trend'];
  if (wtChart) {
    try {
      var months = ['08','09','10','11','12','01','02','03','04','05','06','07'];
      var baseRef = [3.2, 3.3, 3.3, 3.4, 3.5, 3.5, 3.6, 3.7, 3.8, 3.8, 3.9, 3.96];
      var colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#0891b2'];
      var entities, sf2 = 1;

      if (person !== 'all') {
        var pFound = App.PERSONS.find(function(x){return x.n===person;});
        entities = [{ n: person, aw: (pFound && pFound.aw) ? pFound.aw : 3.0 }];
        sf2 = 0.7;
      } else if (group !== 'all') {
        entities = App.PERSONS.filter(function(x){ return x.grp === group; });
        if (!entities || !entities.length) entities = [{ n: group, aw: 3.0 }];
        sf2 = 0.8;
      } else if (team !== 'all') {
        entities = App.GROUPS.filter(function(g){ return g.dept === team; });
        if (!entities || !entities.length) entities = App.PERSONS.filter(function(p){ return p.dept === team; });
        if (!entities || !entities.length) entities = [{ n: team, aw: 3.0 }];
        sf2 = 0.9;
      } else {
        entities = App.DEPTS;
      }

      // 确保 entities 有效
      if (!entities || !entities.length) {
        entities = [{ n: '暂无数据', aw: 3.0 }];
      }

      // 清空旧数据集，逐个添加新数据集（避免引用替换可能引起的 Chart.js 更新问题）
      wtChart.data.labels = months;
      while (wtChart.data.datasets.length > 0) {
        wtChart.data.datasets.pop();
      }
      entities.forEach(function(e, i) {
        var b = (e && e.aw) ? e.aw : 3.0;
        var trendData = [b-1.0,b-0.9,b-0.8,b-0.7,b-0.6,b-0.5,b-0.4,b-0.3,b-0.2,b-0.1,b-0.05,b].map(function(v){ return Math.max(0, v * sf2); });
        var label = (e && (e.n || e.name)) ? (e.n || e.name) : ('系列' + (i+1));
        wtChart.data.datasets.push({
          label: label, data: trendData,
          borderColor: colors[i % colors.length], backgroundColor: 'transparent',
          tension: .3, fill: false, pointRadius: 4, pointBackgroundColor: colors[i % colors.length]
        });
      });
      // 添加平均宽度参考线
      wtChart.data.datasets.push({
        label: '平均宽度', data: baseRef,
        borderColor: '#94a3b8', backgroundColor: 'transparent',
        borderDash: [6,4], tension: .3, fill: false, pointRadius: 3, pointBackgroundColor: '#94a3b8'
      });
      wtChart.update('none');
    } catch(e) {
      console.warn('更新产品宽度趋势图失败:', e);
    }
  }

  // 更新潜力产品历史趋势图 — 按筛选维度动态构建数据
  var ptChart = App.charts['ov_potential-trend'];
  if (ptChart) {
    try {
      var pScale = 1;
      if (person !== 'all') pScale = 0.02;
      else if (group !== 'all') pScale = 0.10;
      else if (team !== 'all') pScale = 0.28;
      var prodNames = ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','服务器','行业软件','网络产品','专网摄像机','通用软件','新业务','出入口停车','音频产品'];
      var prodCurr  = [3210,2180,2450,1420,980,720,680,550,480,420,380,350,320,280,260,210];
      var prodPrev  = [2280,0,2350,1380,1100,850,720,580,520,430,400,380,300,180,290,240];

      // 确保 datasets 数量足够
      while (ptChart.data.datasets.length < 2) {
        ptChart.data.datasets.push({ label: '', data: [] });
      }

      ptChart.data.labels = prodNames;
      ptChart.data.datasets[0].label = '本期销售额';
      ptChart.data.datasets[0].data = prodCurr.map(function(v){ return Math.max(1, Math.round(v * pScale)); });
      ptChart.data.datasets[0].backgroundColor = '#3b82f6';
      ptChart.data.datasets[1].label = '同期销售额';
      ptChart.data.datasets[1].data = prodPrev.map(function(v){ return Math.max(0, Math.round(v * pScale)); });
      ptChart.data.datasets[1].backgroundColor = '#cbd5e1';
      // 移除多余的数据集
      while (ptChart.data.datasets.length > 2) {
        ptChart.data.datasets.pop();
      }
      ptChart.update('none');
    } catch(e) {
      console.warn('更新潜力产品趋势图失败:', e);
    }
  }
};

// 级联缩放计算：根据 部门/组/个人 选择返回缩放因子和图表数据
// 横坐标标签和数据从 App.DEPTS/GROUPS/PERSONS 动态获取
App._getCascadeScale = function(state) {
  var team = state.team, group = state.group, person = state.person;
  var s = { widthFactor: 1, salesFactor: 1, custFactor: 1, rateScale: 1,
    chartLabels: [], chartWidthData: [], chartSalesData: [],
    trendLabels: [], trendWidthSets: [], trendSalesSets: [],
    chartTitle: '客均宽度', chartTitle2: '销售额 (万)' };

  // ── 个人粒度 ──
  if (person !== 'all') {
    var found = App.PERSONS.find(function(p){ return p.n === person; });
    s.chartLabels = [person];
    s.chartWidthData = found ? [found.aw] : [2.5];
    s.chartSalesData = found ? [Math.round(found.cw * found.aw * 2.5)] : [200];
    s.trendLabels = ['08','09','10','11','12','01','02','03','04','05','06','07'];
    var bw = s.chartWidthData[0];
    s.trendWidthSets = [{ label: person, data: [bw-0.3,bw-0.25,bw-0.2,bw-0.15,bw-0.1,bw-0.05,bw-0.03,bw-0.02,bw-0.01,bw,bw,bw], color: '#3b82f6', fill: false }];
    return s;
  }

  // ── 小组粒度 ──
  if (group !== 'all') {
    var ppl = App.PERSONS.filter(function(p){ return p.grp === group; });
    var ginfo = App.GROUPS.find(function(g){ return g.n === group; });
    s.chartLabels = ppl.length ? ppl.map(function(p){ return p.n; }) : [group];
    s.chartWidthData = ppl.length ? ppl.map(function(p){ return p.aw || 3.0; }) : [ginfo ? ginfo.aw : 3.0];
    s.chartSalesData = ppl.length ? ppl.map(function(p){ return Math.round((p.cw||10) * (p.aw||3) * 2.5); }) : [ginfo ? Math.round(ginfo.cw * ginfo.aw * 3) : 300];
    s.trendLabels = ['08','09','10','11','12','01','02','03','04','05','06','07'];
    s.trendWidthSets = s.chartLabels.map(function(l, i) {
      var b = s.chartWidthData[i];
      return { label: l, data: [b-0.5,b-0.4,b-0.35,b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.02,b,b], color: ['#3b82f6','#10b981','#f59e0b'][i]||'#64748b', fill: false };
    });
    return s;
  }

  // ── 部门粒度 → 该部门下的小组趋势（无小组则展示部门下个人）──
  if (team !== 'all') {
    var grps = App.GROUPS.filter(function(g){ return g.dept === team; });
    if (grps.length) {
      s.chartLabels = grps.map(function(g){ return g.n; });
      s.chartWidthData = grps.map(function(g){ return g.aw; });
    } else {
      var dp2 = App.PERSONS.filter(function(p){ return p.dept === team; });
      s.chartLabels = dp2.length ? dp2.map(function(p){ return p.n; }) : [team];
      s.chartWidthData = dp2.length ? dp2.map(function(p){ return p.aw || 3.0; }) : [3.0];
    }
    s.trendLabels = ['08','09','10','11','12','01','02','03','04','05','06','07'];
    s.trendWidthSets = s.chartLabels.map(function(l, i) {
      var b = s.chartWidthData[i];
      return { label: l, data: [b-0.6,b-0.5,b-0.45,b-0.4,b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.02,b], color: ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed'][i%5]||'#64748b', fill: false };
    });
    return s;
  }

  // ── 全部 → 所有部门趋势 ──
  s.chartLabels = App.DEPTS.map(function(d){ return d.n; });
  s.chartWidthData = App.DEPTS.map(function(d){ return d.aw; });
  s.trendLabels = ['08','09','10','11','12','01','02','03','04','05','06','07'];
  s.trendWidthSets = s.chartLabels.map(function(dept, i) {
    var base = s.chartWidthData[i];
    return { label: dept, data: [base-1.0,base-0.9,base-0.8,base-0.7,base-0.6,base-0.5,base-0.4,base-0.3,base-0.2,base-0.1,base-0.05,base], color: ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#0891b2'][i] || '#64748b', fill: false };
  });
  return s;
};

// ===== 产品宽度 - 筛选联动 =====
App.updateWidth = function() {
  var state = App.getFilterState('page-width');
  var label = App.getFilterLabel(state);
  var el = document.getElementById('width-level');
  if (el) el.textContent = '当前粒度: ' + label;

  // 级联缩放因子
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;

  var data = App.Data.getWidth(state.team);
  if (!data) return;

  var s = function(v) { return Math.round(v * sf); };

  var kpi = data.kpi;
  App.setText('w-kpi-avgwidth',        (parseFloat(kpi.avgWidth) * (sf > 0.5 ? 1 : 0.9 + sf)).toFixed(2));
  App.setText('w-kpi-yoy',             kpi.widthYoY);
  App.setText('w-kpi-scale-users',     s(parseInt(kpi.scaleUsers) || 285));
  App.setText('w-kpi-scale-customers', s(parseInt(kpi.scaleUp) || 888));
  App.setText('w-kpi-cust-mom',        '+' + s(62));
  App.setText('w-kpi-coverage',        (parseFloat(kpi.coverage) * (sf > 0.5 ? 1 : 0.85 + sf * 0.5)).toFixed(1) + '%');
  App.setText('w-kpi-cov-yoy',         kpi.coverageYoY);

  // 缩放图表数据
  if (App.charts.wDist && data.chartDist) {
    App.charts.wDist.data.datasets[0].data = data.chartDist.data.map(function(v) { return s(v); });
    App.charts.wDist.update();
  }
  if (App.charts.wTeam && data.chartTeam) {
    App.charts.wTeam.data.labels = data.chartTeam.labels;
    App.charts.wTeam.data.datasets[0].data = data.chartTeam.data.map(function(v) { return Math.round(v * sf * 10) / 10; });
    App.charts.wTeam.update();
  }
  if (App.charts.wCov && data.chartCov) {
    App.charts.wCov.data.labels = data.chartCov.labels;
    App.charts.wCov.data.datasets[0].data = data.chartCov.data;
    App.charts.wCov.update();
  }
  // 按筛选维度的产品宽度柱状图（跟随部门→组→个人 + 部门/组切换）
  if (App.charts.wWidthBar) {
    var wl, wd;
    if (person !== 'all') {
      var wp = App.PERSONS.find(function(x) { return x.n === person; });
      wl = [person]; wd = wp ? [wp.aw || 3.0] : [3.0];
    } else if (group !== 'all') {
      var wpp = App.PERSONS.filter(function(x) { return x.grp === group; });
      wl = wpp.length ? wpp.map(function(x) { return x.n; }) : [group];
      wd = wpp.length ? wpp.map(function(x) { return x.aw || 3.0; }) : [3.0];
    } else if (team !== 'all') {
      var wg = App.GROUPS.filter(function(g) { return g.dept === team; });
      if (wg.length) { wl = wg.map(function(g) { return g.n; }); wd = wg.map(function(g) { return g.aw; }); }
      else { var wdp = App.PERSONS.filter(function(p) { return p.dept === team; }); wl = wdp.length ? wdp.map(function(p) { return p.n; }) : [team]; wd = wdp.length ? wdp.map(function(p) { return p.aw || 3.0; }) : [3.0]; }
    } else {
      // 全部部门 → 默认显示部门维度
      wl = App.DEPTS.map(function(d) { return d.n; });
      wd = App.DEPTS.map(function(d) { return d.aw; });
    }
    App.charts.wWidthBar.data.labels = wl;
    App.charts.wWidthBar.data.datasets[0].data = wd;
    App.charts.wWidthBar.update();
  }
  // 产品宽度历史趋势 — 跟随筛选维度（严格三层级联）
  if (App.charts.wWidthTrend) {
    var twl, twSets;
    if (person !== 'all') {
      var tp = App.PERSONS.find(function(x) { return x.n === person; });
      var b = tp ? (tp.aw || 3.0) : 3.0;
      twl = ['08','09','10','11','12','01','02','03','04','05','06','07'];
      twSets = [{ label: person, data: [b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.03,b-0.02,b-0.01,b,b,b], color: '#3b82f6' }];
    } else if (group !== 'all') {
      var tpp = App.PERSONS.filter(function(x) { return x.grp === group; });
      twl = ['08','09','10','11','12','01','02','03','04','05','06','07'];
      twSets = tpp.length ? tpp.map(function(p, i) {
        var b = p.aw || 3.0;
        return { label: p.n, data: [b-0.5,b-0.4,b-0.35,b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.02,b,b], color: ['#3b82f6','#10b981','#f59e0b'][i]||'#64748b' };
      }) : [{ label: group, data: [2.5,2.6,2.7,2.8,2.9,3.0,3.1,3.2,3.3,3.4,3.45,3.5], color: '#3b82f6' }];
    } else if (team !== 'all') {
      var tg = App.GROUPS.filter(function(g) { return g.dept === team; });
      twl = ['08','09','10','11','12','01','02','03','04','05','06','07'];
      if (tg.length) {
        twSets = tg.map(function(g, i) {
          var b = g.aw;
          return { label: g.n, data: [b-0.6,b-0.5,b-0.45,b-0.4,b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.02,b], color: ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed'][i%5]||'#64748b' };
        });
      } else {
        var tdp = App.PERSONS.filter(function(p) { return p.dept === team; });
        twSets = tdp.length ? tdp.map(function(p, i) {
          var b = p.aw || 3.0;
          return { label: p.n, data: [b-0.4,b-0.35,b-0.3,b-0.25,b-0.2,b-0.15,b-0.1,b-0.05,b-0.03,b-0.01,b,b], color: ['#3b82f6','#10b981','#f59e0b'][i]||'#64748b' };
        }) : [{ label: team, data: [2.8,2.9,3.0,3.1,3.2,3.3,3.4,3.5,3.6,3.7,3.78,3.85], color: '#3b82f6' }];
      }
    } else {
      // 全部部门 → 默认显示部门趋势
      twl = ['08','09','10','11','12','01','02','03','04','05','06','07'];
      twSets = App.DEPTS.map(function(d, i) {
        var b = d.aw;
        return { label: d.n, data: [b-1.0,b-0.9,b-0.8,b-0.7,b-0.6,b-0.5,b-0.4,b-0.3,b-0.2,b-0.1,b-0.05,b], color: ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#0891b2'][i]||'#64748b' };
      });
    }
    // Add average reference line
    twSets.push({ label: '平均宽度', data: [3.2,3.3,3.3,3.4,3.5,3.5,3.6,3.7,3.8,3.8,3.9,3.96], color: '#94a3b8' });
    App.charts.wWidthTrend.data.labels = twl;
    App.charts.wWidthTrend.data.datasets = twSets.map(function(ds) {
      return { label: ds.label, data: ds.data, borderColor: ds.color, backgroundColor: 'transparent', borderDash: ds.label === '平均宽度' ? [6,4] : undefined, tension: .3, fill: false, pointRadius: ds.label === '平均宽度' ? 3 : 4, pointBackgroundColor: ds.color };
    });
    App.charts.wWidthTrend.update();
  }
  // 刷新差距分析
  App.renderWidthGapAnalysis();
};

// ===== 潜力产品 - 筛选联动 =====
App.updatePotential = function() {
  try {
  var state = App.getFilterState('page-potential');
  var label = App.getFilterLabel(state);
  // 更新粒度标签
  var levelEl = document.getElementById('potential-level');
  if (!levelEl) {
    // 创建标签如果不存在
    var filterBar = document.querySelector('#page-potential .filter-bar');
    if (filterBar) {
      var span = document.createElement('span');
      span.id = 'potential-level';
      span.className = 'level-tag';
      span.style.cssText = 'font-size:11px;color:var(--text-sub);margin-left:8px';
      filterBar.appendChild(span);
    }
  }
  var el2 = document.getElementById('potential-level');
  if (el2) el2.textContent = '当前粒度: ' + label;

  // 级联缩放
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;

  var data = App.Data.getPotential(state.team);
  if (!data) { console.warn('updatePotential: getPotential 返回空数据'); return; }

  var s = function(v) { return Math.round(v * sf); };

  // ===== 经营概述 (商机预测版) =====
  try { App.renderPotentialOverview(); } catch(e) { console.warn('renderPotentialOverview 失败:', e); }

  // ===== 经营概览 KPI (乔梦杰版 5 卡) =====
  var ov = data.overview;
  if (ov) {
    try {
      App.setText('p-kpi-sales',        '¥ ' + s(ov.sales).toLocaleString() + '万');
      App.setText('p-kpi-sales-prev',   s(ov.salesPrev).toLocaleString() + '万');
      App.setText('p-kpi-prodcount',    ov.productCount);
      App.setText('p-kpi-custcount',    s(ov.customerCount));
      App.setText('p-kpi-avgprice',     ov.avgPrice.toFixed(1));
      App.setText('p-kpi-deptcount',    Math.max(1, s(ov.deptCount)));
    } catch(e) { console.warn('updatePotential KPI 更新失败:', e); }
  }

  // ===== 团队×产品矩阵 =====
  try { App.renderTeamProdMatrix('p-team-prod-body', data.teamProdMatrix); } catch(e) { console.warn('renderTeamProdMatrix 失败:', e); }

  // ===== 大部门 × 潜力产品 差距热图 (乔梦杰版) =====
  try { App.renderGapHeatmap('p-gap-heatmap-table', data.gapHeatmap); } catch(e) { console.warn('renderGapHeatmap 失败:', e); }

  // ===== 销售人员潜力产品排名 (乔梦杰版) =====
  try { App.renderSalesPotentialRank('p-sales-potential-rank-body', data.salesPotentialRank); } catch(e) { console.warn('renderSalesPotentialRank 失败:', e); }

  // ===== 产品风险分布 & 团队概况 =====
  try { App.renderTeamRiskPanel(); } catch(e) { console.warn('renderTeamRiskPanel 失败:', e); }
  // ===== 与团队均值的差距分析 =====
  try { App.renderPotentialGapDetail(); } catch(e) { console.warn('renderPotentialGapDetail 失败:', e); }

  // ===== 团队维度 (凯玲版) - 函数内部检查元素存在, 不存在则不渲染
  try { App.renderTeamDim(); } catch(e) { console.warn('renderTeamDim 失败:', e); }

  // ===== 产品维度排名表 (12 产品) =====
  try { App.renderProductRank('p-product-rank-body', data.quadrant); } catch(e) { console.warn('renderProductRank 失败:', e); }
  // ===== 销售人员潜力产品排名 =====
  try { App.renderSellerPotentialRank(); } catch(e) { console.warn('renderSellerPotentialRank 失败:', e); }
  // ===== 客户用户分析 + 用户客户关系 =====
  try { App.renderCustUserLink(); } catch(e) { console.warn('renderCustUserLink 失败:', e); }
  try { App.renderUserCustLink(); } catch(e) { console.warn('renderUserCustLink 失败:', e); }

  // 更新 TOP 10 表
  try { App.renderPotentialTop10('p-table-top10', data.top10); } catch(e) { console.warn('renderPotentialTop10 失败:', e); }

  } catch(e) {
    console.error('updatePotential 整体执行失败:', e);
  }
};

// ===== 团队×潜力产品矩阵 (经营概览) =====
App.renderTeamProdMatrix = function(tbodyId, rows) {
  var el = document.getElementById(tbodyId);
  if (!el || !rows) return;
  el.innerHTML = rows.map(function(r) {
    var sum = r.nvr + r.ai + r.ipc + r.sw + r.ac + r.it + r.st + r.lcd;
    var yoyNum = parseFloat(r.yoy);
    var yoyCls = yoyNum > 0 ? 'compare-better' : (yoyNum < 0 ? 'compare-worse' : '');
    return '<tr>' +
      '<td style="text-align:left;font-weight:600">' + r.team + '</td>' +
      '<td>' + r.nvr + '</td>' + '<td>' + r.ai + '</td>' + '<td>' + r.ipc + '</td>' +
      '<td>' + r.sw + '</td>' + '<td>' + r.ac + '</td>' + '<td>' + r.it + '</td>' +
      '<td>' + r.st + '</td>' + '<td>' + r.lcd + '</td>' +
      '<td style="font-weight:700;color:var(--primary)">' + sum + '</td>' +
      '<td>' + r.prev + '</td>' +
      '<td class="' + yoyCls + '" style="font-weight:700">' + r.yoy + '</td>' +
      '</tr>';
  }).join('');
};

// ===== 大部门 × 潜力产品 差距热图 (整合自乔梦杰版) =====
App.renderGapHeatmap = function(tableId, gap) {
  var table = document.getElementById(tableId);
  if (!table || !gap || !gap.prods || !gap.teams) return;
  var prods = gap.prods;
  var teams = gap.teams;

  // 表头
  var thead = '<thead><tr><th>大部门 \\ 产品</th>' +
    prods.map(function(p) { return '<th title="' + p + '">' + p + '</th>'; }).join('') +
    '<th>总计</th><th>覆盖数</th></tr></thead>';

  // 计算每列(产品)最大值用于色阶判定
  var colMax = prods.map(function(_, i) {
    return Math.max.apply(null, teams.map(function(t) { return t.data[i] || 0; }));
  });

  // 表体
  var rows = teams.map(function(team) {
    var total = 0, covered = 0;
    var cells = team.data.map(function(v, i) {
      total += v;
      if (v > 0) covered++;
      var max = Math.max(1, colMax[i]);
      var ratio = v / max;
      var cls = 'heat-0';
      if (v > 0) {
        cls = ratio < 0.10 ? 'heat-1' : (ratio < 0.30 ? 'heat-2' : (ratio < 0.60 ? 'heat-3' : (ratio < 0.85 ? 'heat-4' : 'heat-5')));
      }
      var display = v > 0 ? v.toFixed(0) : '-';
      return '<td class="' + cls + '" title="' + prods[i] + ' (' + team.team + '): ' + v + ' 万" style="cursor:pointer" onclick="App.showCellDrill(\'' + team.team + '\',\'' + prods[i] + '\',' + v + ')">' + display + '</td>';
    }).join('');
    return '<tr><td class="row-label">' + team.team + '</td>' + cells +
           '<td class="col-total">' + total.toFixed(0) + '</td>' +
           '<td class="col-coverage">' + covered + '/' + prods.length + '</td></tr>';
  }).join('');

  table.innerHTML = thead + '<tbody>' + rows + '</tbody>';
};

// ===== 销售人员潜力产品排名 (整合自乔梦杰版) =====
function shortenProd(name, max) {
  max = max || 8;
  return name.length > max ? (name.slice(0, max - 1) + '…') : name;
}
App.renderSalesPotentialRank = function(tbodyId, list) {
  var el = document.getElementById(tbodyId);
  if (!el || !list) return;
  el.innerHTML = list.map(function(s) {
    var rn = s.rank <= 3 ? 'rn' + s.rank : 'rn0';
    var yoyNum = parseFloat(s.yoy);
    var yoyBadge = !isNaN(yoyNum) ? (yoyNum > 0 ? 'b-up' : (yoyNum < 0 ? 'b-down' : 'b-flat')) : 'b-new';
    var coveredPills = (s.covered || []).map(function(p) {
      return '<span class="coverage-pill covered" title="' + p + '">' + shortenProd(p) + '</span>';
    }).join('');
    var uncoveredPills = (s.uncovered || []).map(function(p) {
      return '<span class="coverage-pill uncovered" title="' + p + '">' + shortenProd(p) + '</span>';
    }).join('');
    return '<tr>' +
      '<td><span class="rn ' + rn + '">' + s.rank + '</span></td>' +
      '<td><strong>' + s.name + '</strong><div style="font-size:10px;color:#9ca3af">' + s.team + '</div></td>' +
      '<td style="text-align:right;font-weight:700">' + s.sales.toFixed(0) + '</td>' +
      '<td style="text-align:right;color:#6b7280">' + s.prev.toFixed(0) + '</td>' +
      '<td><span class="badge ' + yoyBadge + '">' + s.yoy + '</span></td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary)">' + s.covered.length + '/' + (s.covered.length + s.uncovered.length) + '</td>' +
      '<td><div class="coverage-pills">' +
        '<span class="coverage-pill label covered">✓ 覆盖(' + s.covered.length + ')</span>' +
        coveredPills +
        (s.uncovered.length ? '<span class="coverage-pill label uncovered">✗ 未覆盖(' + s.uncovered.length + ')</span>' + uncoveredPills : '') +
      '</div></td>' +
      '</tr>';
  }).join('');
};

// ===== 差距分析 (整合自乔梦杰版) - 整体渲染入口 (支持3个维度切换) =====
// 注: 实际实现在下方 App.renderGapAnalysis 完整版（含 GAP_DATA 多维度切换）
// 此处保留轻量版本供 updatePotential() 调用时快速刷新

// ===== 下钻弹窗 =====
App.showCellDrill = function(team, product, value) {
  var modal = document.getElementById('drillModal');
  var titleEl = document.getElementById('drill-title');
  var bodyEl = document.getElementById('drill-body');
  if (!modal || !bodyEl) return;
  titleEl.textContent = team + ' · ' + product + ' 明细';
  var msg = value > 0
    ? '<p>销售额: <strong>¥' + value + ' 万</strong></p><p>团队: ' + team + '</p><p>产品: ' + product + '</p><p style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;color:#6b7280">建议: 关注' + product + '在' + team + '的销售走势，' + (value > 500 ? '继续保持领先优势' : '制定专项突破计划') + '</p>'
    : '<p>该团队当前在 <strong>' + product + '</strong> 无销售记录。</p><p style="margin-top:8px;color:#6b7280">建议: 评估' + team + '是否有' + product + '的潜在客户机会，优先推进入围</p>';
  bodyEl.innerHTML = msg;
  modal.classList.add('show');
};

// ===== 下钻弹窗 (凯玲版: 团队/个人统计) =====
App.showWidthDrill = function(bucket) {
  var modal = document.getElementById('widthDrillModal');
  var titleEl = document.getElementById('widthDrillTitle');
  var bodyEl = document.getElementById('widthDrillBody');
  if (!modal || !bodyEl) return;

  var stats = BASE_WIDTH_BUCKET_TEAM_STATS[bucket];
  if (!stats) {
    bodyEl.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af">该宽度区间暂无数据</p>';
    modal.classList.add('active');
    return;
  }

  titleEl.textContent = '产品宽度 ' + bucket + ' — 团队统计（共 ' + stats.total + ' 条）';

  var rows = stats.teams.map(function(t) {
    return '<tr>' +
      '<td><span class="team-link" onclick="App.showTeamDrill(\'' + bucket + '\',\'' + t.team + '\')">' + t.team + '</span></td>' +
      '<td>' + t.count + '</td>' +
      '<td><span class="avg-num">' + (1 + (t.count / stats.total * 3)).toFixed(1) + '</span></td>' +
      '<td>0</td>' +
      '<td><button class="btn-primary" style="padding:4px 10px;font-size:11px" onclick="App.showTeamDrill(\'' + bucket + '\',\'' + t.team + '\')">查看个人</button></td>' +
      '</tr>';
  }).join('');

  bodyEl.innerHTML =
    '<div style="margin-bottom:12px;font-size:13px;color:#6b7280">点击团队名称查看该团队内的个人统计 →</div>' +
    '<table class="modal-table">' +
      '<thead><tr><th>团队</th><th>客户数</th><th>平均宽度</th><th>规上数</th><th>操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';

  modal.classList.add('active');
};

// 二级下钻: 团队内个人 (凯玲版 Level 2)
App.showTeamDrill = function(bucket, team) {
  var modal = document.getElementById('widthDrillModal');
  var titleEl = document.getElementById('widthDrillTitle');
  var bodyEl = document.getElementById('widthDrillBody');
  if (!modal || !bodyEl) return;

  var stats = BASE_WIDTH_BUCKET_TEAM_STATS[bucket];
  if (!stats) return;
  var teamData = stats.teams.find(function(t) { return t.team === team; });
  if (!teamData) return;

  titleEl.textContent = '产品宽度 ' + bucket + ' — ' + team + ' 个人统计（共 ' + teamData.count + ' 条）';

  // 模拟该团队下个人分布
  var persons = [
    { name: '王志强', count: Math.max(1, Math.floor(teamData.count * 0.35)), avg: (1 + teamData.count / 50).toFixed(1), gs: 0 },
    { name: '陈思源', count: Math.max(1, Math.floor(teamData.count * 0.25)), avg: (1 + teamData.count / 60).toFixed(1), gs: 0 },
    { name: '李梦琪', count: Math.max(1, Math.floor(teamData.count * 0.20)), avg: (1 + teamData.count / 70).toFixed(1), gs: 0 },
    { name: '陈伟杰', count: Math.max(1, Math.floor(teamData.count * 0.20)), avg: (1 + teamData.count / 80).toFixed(1), gs: 0 }
  ];

  var rows = persons.map(function(p) {
    return '<tr>' +
      '<td><strong>' + p.name + '</strong></td>' +
      '<td>' + p.count + '</td>' +
      '<td><span class="avg-num">' + p.avg + '</span></td>' +
      '<td>0</td>' +
      '<td><button class="btn-primary" style="padding:4px 10px;font-size:11px" onclick="alert(\'明细数据导出中...\')">查看明细</button></td>' +
      '</tr>';
  }).join('');

  bodyEl.innerHTML =
    '<div style="margin-bottom:12px;font-size:13px;color:#6b7280">' + team + ' · 产品宽度 ' + bucket + ' 区间的个人明细 →</div>' +
    '<table class="modal-table">' +
      '<thead><tr><th>销售员</th><th>客户数</th><th>平均宽度</th><th>规上数</th><th>操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';

  modal.classList.add('active');
};

// ===== 真实数据导入 (SheetJS) =====
App.handleFileImport = function(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var data = new Uint8Array(e.target.result);
    var workbook;
    try {
      // Use global XLSX if available, otherwise fallback to CSV
      if (typeof XLSX !== 'undefined') {
        workbook = XLSX.read(data, { type: 'array' });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        var headers = json[0] || [];
        var rows = json.slice(1);
        var msg = '✅ 文件解析成功！\n\n文件名: ' + file.name + '\n表头列数: ' + headers.length + ' 列\n数据行数: ' + rows.length + ' 行\n\n表头: ' + headers.slice(0, 8).join(', ') + (headers.length > 8 ? ' …等' + headers.length + '列' : '') + '\n\n⚠ 当前为 Demo 模式，数据已加载到浏览器的开发控制台，输入 App.importedData 查看。';
        App.importedData = { headers: headers, rows: rows };
        alert(msg);
      } else {
        alert('⚠ SheetJS 库未加载。请确保 assets/design/xlsx.full.min.js 已被引用。\n\n可切换为演示模式: 使用现有虚拟数据。');
      }
    } catch(err) {
      alert('❌ 文件解析失败: ' + err.message + '\n请确认文件格式为 .xlsx / .xls / .csv');
    }
  };
  reader.readAsArrayBuffer(file);
};

// ===== 潜力产品 — 与团队均值的差距分析 =====
App.renderPotentialGapDetail = function() {
  var gt = document.getElementById('p-team-gap-detail');
  if (!gt) return;
  var data = App.Data.getPotential('all');
  if (!data || !data.gapHeatmap) return;
  var prods = data.gapHeatmap.prods;
  var teams = data.gapHeatmap.teams;

  function shortLabel(str, maxLen) { maxLen = maxLen || 6; if (!str) return ''; return str.length > maxLen ? str.substring(0, maxLen) + '…' : str; }

  var avgMap = prods.map(function(_, i) {
    var nz = teams.map(function(t) { return t.data[i] || 0; }).filter(function(v) { return v > 0; });
    return nz.length ? nz.reduce(function(s, v) { return s + v; }, 0) / nz.length : 0;
  });

  gt.innerHTML = '<tr><th>大部门 \\ 产品</th>' +
    prods.map(function(p) { return '<th title="' + p + '">' + shortLabel(p, 8) + '</th>'; }).join('') + '</tr>' +
    teams.map(function(team) {
      var cells = prods.map(function(prod, i) {
        var v = team.data[i], avg = avgMap[i];
        if (avg === 0 && v === 0) return '<td class="heat-0">-</td>';
        var diff = v - avg;
        var pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : (v > 0 ? '∞' : '0');
        var style = diff > 0 ? 'background:#d1fae5;color:#065f46' : (diff < 0 ? 'background:#fee2e2;color:#991b1b' : 'background:#f3f4f6;color:#6b7280');
        return '<td style="' + style + ';padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;font-weight:600">' + (diff >= 0 ? '+' : '') + pct + '%</td>';
      }).join('');
      return '<tr><td>' + team.team + '</td>' + cells + '</tr>';
    }).join('');
};

// ===== 与团队均值的差距分析表 =====
App.renderGapDetail = function(tableId, gap) {
  var table = document.getElementById(tableId);
  if (!table || !gap || !gap.prods || !gap.teams) return;
  var prods = gap.prods;
  var teams = gap.teams;

  // 计算每列(产品)所有非零团队的平均值
  var avgMap = prods.map(function(_, i) {
    var nz = teams.map(function(t) { return t.data[i] || 0; }).filter(function(v) { return v > 0; });
    return nz.length ? nz.reduce(function(s, v) { return s + v; }, 0) / nz.length : 0;
  });

  // 表头
  var thead = '<thead><tr><th>大部门 \\ 产品</th>' +
    prods.map(function(p) { return '<th title="' + p + '">' + shortenProd(p, 6) + '</th>'; }).join('') + '</tr></thead>';

  // 表体: 每行显示每个产品相对均值的差异百分比
  var rows = teams.map(function(team) {
    var cells = team.data.map(function(v, i) {
      var avg = avgMap[i];
      if (avg === 0 && v === 0) return '<td class="heat-0">-</td>';
      var diff = v - avg;
      var pct = avg > 0 ? ((diff / avg) * 100) : (v > 0 ? 9999 : 0);
      var style = 'padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;font-weight:600;';
      if (diff > 0)      style += 'background:#d1fae5;color:#065f46;';
      else if (diff < 0) style += 'background:#fee2e2;color:#991b1b;';
      else               style += 'background:#f3f4f6;color:#6b7280;';
      var pctText = pct > 999 ? '+∞%' : (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
      return '<td style="' + style + '" title="' + prods[i] + ': 实际 ' + v + ' / 均值 ' + avg.toFixed(0) + '">' + pctText + '</td>';
    }).join('');
    return '<tr><td class="row-label">' + team.team + '</td>' + cells + '</tr>';
  }).join('');

  table.innerHTML = thead + '<tbody>' + rows + '</tbody>';
};

// ===== 潜力产品排名表 (产品维度子Tab) =====
App.renderProductRank = function(tbodyId, list) {
  var el = document.getElementById(tbodyId);
  if (!el || !list) return;
  // 合并象限数据和销售额数据
  var salesMap = {};
  if (App.BASE_PROD_COMPOSITION_REF) {
    App.BASE_PROD_COMPOSITION_REF.forEach(function(p) { salesMap[p.product] = p.sales; });
  }
  el.innerHTML = list.map(function(p, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var yoyNum = p.amtYoY;
    var yoyBadge = yoyNum > 15 ? 'b-up' : (yoyNum > 0 ? 'b-up' : (yoyNum > -5 ? 'b-warn' : 'b-down'));
    yoyBadge = (p.type === '新增') ? 'b-new' : yoyBadge;
    var typeBadge = p.type === '量价齐升' ? 'b-up' : (p.type === '新增' ? 'b-new' : (p.type === '量跌价增' ? 'b-warn' : 'b-down'));
    var sales = salesMap[p.product] || (3210 - i * 255);
    var mainCust = ['深圳市政府','宝安公安局','罗湖教育局','招商17','高峰10','沙头','彭城12','陈思源'][i] || '多个客户';
    var yoyDisplay = p.type === '新增' ? '新增' : (p.amtYoY >= 0 ? '+' : '') + p.amtYoY.toFixed(1) + '%';
    var qtyDisplay = (p.qtyYoY >= 0 ? '+' : '') + p.qtyYoY.toFixed(1) + '%';
    return '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + p.product + '</strong></td>' +
      '<td style="font-weight:700">' + sales.toLocaleString() + '</td>' +
      '<td><span class="badge ' + yoyBadge + '">' + yoyDisplay + '</span></td>' +
      '<td><span class="' + (p.qtyYoY >= 0 ? 'delta-up' : 'delta-down') + '">' + qtyDisplay + '</span></td>' +
      '<td><span class="badge ' + typeBadge + '">' + p.type + '</span></td>' +
      '<td style="font-size:11px;color:#6b7280">' + mainCust + '</td>' +
      '</tr>';
  }).join('');
};

// ===== 通用 DOM 更新工具 =====
App.setText = function(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
};

App.setHTML = function(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
};

// ===== 表格渲染函数 =====

// 销售人员宽度排名表
App.renderRankTable = function(tbodyId, rows) {
  var html = '';
  rows.forEach(function(r, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    html += '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td>' + (i === 0 ? '<strong>' + r[0] + '</strong>' : r[0]) + '</td>' +
      '<td style="text-align:center">' + r[1] + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary)">' + r[2] + '</td>' +
      '<td style="text-align:center">' + r[3] + '</td>' +
      '<td>' + r[4] + '</td>' +
      '</tr>';
  });
  App.setHTML(tbodyId, html);
};

// 缺失分析表
App.renderMissingTable = function(tbodyId, rows) {
  var html = '';
  var warnColors = ['danger', 'danger', 'warning', 'warning', ''];
  rows.forEach(function(r, i) {
    var missingCls = i < 2 ? 'color:var(--danger);font-weight:600' : (i < 4 ? 'color:var(--warning);font-weight:600' : '');
    html += '<tr>' +
      '<td>' + r.product + '</td>' +
      '<td>' + r.covered + '</td>' +
      '<td style="' + missingCls + '">' + r.missing + '</td>' +
      '<td>' + r.rate + '</td>' +
      '<td><div class="bar-wrap"><div class="bar-bg"><div class="bar-fill" style="width:' + r.bar + '%"></div></div><span class="bar-num">' + r.rate + '</span></div></td>' +
      '</tr>';
  });
  App.setHTML(tbodyId, html);
};

// 产品覆盖热力图 (27 品类，源: 凯玲产品宽度分析)
App.renderHeatmap = function(containerId, data) {
  var el = document.getElementById(containerId);
  if (!el || !data || !data.products) return;
  el.innerHTML = data.products.map(function(p) {
    var rate = p.rate;
    var cls = rate >= 70 ? 'h-great' : (rate >= 40 ? 'h-good' : (rate >= 10 ? 'h-medium' : 'h-low'));
    return '<div class="heatmap-cell ' + cls + '" title="' + p.name + '：' + p.count + ' / ' + data.total + ' 客户">' +
             '<div class="h-name">' + p.name + '</div>' +
             '<div class="h-rate">' + p.rate + '%</div>' +
             '<div class="h-count">' + p.count + ' / ' + data.total + '</div>' +
           '</div>';
  }).join('');
};

// ===== 健康度评分卡 =====
App.renderHealthScores = function(panelId, list) {
  var el = document.getElementById(panelId);
  if (!el || !list) return;
  list.sort(function(a, b) { return b.score - a.score; });
  el.innerHTML = list.map(function(s, i) {
    var color = s.score >= 80 ? '#16a34a' : (s.score >= 60 ? '#d97706' : '#dc2626');
    var bg   = s.score >= 80 ? '#dcfce7' : (s.score >= 60 ? '#fef3c7' : '#fee2e2');
    var icon = s.score >= 80 ? '🟢' : (s.score >= 60 ? '🟡' : '🔴');
    return '<div class="hs-row" style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">' +
      '<span style="width:28px;font-size:12px;color:#9ca3af">' + (i+1) + '</span>' +
      '<span style="flex:1;font-weight:600;font-size:13px">' + s.name + '</span>' +
      '<span style="font-size:11px;color:#6b7280;margin-right:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + s.detail + '">' + s.detail + '</span>' +
      '<span style="background:' + bg + ';color:' + color + ';padding:2px 10px;border-radius:10px;font-weight:700;font-size:12px;min-width:32px;text-align:center">' + s.score + '</span>' +
      '<span style="font-size:14px;margin-left:4px">' + icon + '</span>' +
      '</div>';
  }).join('');
};

App.switchHealthTab = function(tab) {
  document.querySelectorAll('[id^="hs-"]').forEach(function(el) {
    if (el.id.indexOf('hs-') === 0 && el.id.indexOf('-panel') > 0) {
      el.style.display = 'none';
    }
  });
  var panel = document.getElementById('hs-' + tab + '-panel');
  if (panel) panel.style.display = 'block';
  var allBtns = document.querySelectorAll('[data-tab^="hs-"]');
  allBtns.forEach(function(b) { b.classList.remove('active'); });
  var activeBtn = document.querySelector('[data-tab="hs-' + tab + '"]');
  if (activeBtn) activeBtn.classList.add('active');
};

// ===== 简刚平版: 客户产品宽度覆盖 双列表渲染 =====
function buildCustTipBody(c) {
  var prods = c.sold && c.sold.length ? c.sold.join('、') : '无';
  return '<div class="ct-line">产品覆盖: <strong>' + c.soldCnt + ' / 27 类</strong></div>' +
         '<div class="ct-line">产品明细: ' + prods + '</div>';
}

App.renderCustList = function(tbodyId, list, isGood) {
  var el = document.getElementById(tbodyId);
  if (!el || !list) return;
  el.innerHTML = list.map(function(c, i) {
    var rn = isGood ? 'rn' + (i < 3 ? (i + 1) : 0) : 'rn0';
    var widthStyle = isGood
      ? 'color:var(--success);font-weight:700'
      : (c.soldCnt === 0 ? 'color:var(--danger);font-weight:700' : '');
    var tipBody = buildCustTipBody(c);
    return '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td><strong class="cust-hover" data-cust-detail=\'' + tipBody + '\' data-cust-header="📋 客户产品详情">' + c.name + '</strong></td>' +
      '<td style="text-align:center;' + widthStyle + '">' + c.avgW.toFixed(2) + '</td>' +
      '<td style="text-align:center">' + c.gsCnt + '</td>' +
      '<td style="text-align:center;font-weight:700">' + c.soldCnt + ' / 27</td>' +
      '<td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + c.person + '">' + c.person + '</td>' +
      '</tr>';
  }).join('');
};

// ===== 客户分层分类 =====
App.segmentCustomers = function(custs) {
  var salesM = 500;  // 销售额阈值 (万元)
  var widthM = 4;    // 宽度阈值 (品类数)
  var segments = { star: [], cash: [], potential: [], sleep: [] };
  custs.forEach(function(c) {
    var s = c.sales, w = c.width;
    var pt = { x: s, y: w, custName: c.name, person: c.person };
    if (s >= salesM) {
      segments[w >= widthM ? 'star' : 'cash'].push(pt);
    } else {
      segments[w >= widthM ? 'potential' : 'sleep'].push(pt);
    }
  });
  return segments;
};

// ===== 产品交叉销售关联矩阵 =====
App.renderCrossSellMatrix = function(data) {
  var el = document.getElementById('w-cross-sell-matrix');
  if (!el || !data || !data.prods || !data.matrix) return;
  var prods = data.prods, mat = data.matrix, n = prods.length;
  var html = '<table class="cross-matrix"><thead><tr><th>产品 A \\ 产品 B</th>';
  for (var i = 0; i < n; i++) { html += '<th title="' + prods[i] + '">' + prods[i] + '</th>'; }
  html += '</tr></thead><tbody>';
  for (var i = 0; i < n; i++) {
    html += '<tr><td class="row-label">' + prods[i] + '</td>';
    for (var j = 0; j < n; j++) {
      var v = (i < j) ? mat[i][j] : (j < i) ? mat[j][i] : 0;
      var cls = v >= 4 ? 'x5' : (v >= 3 ? 'x4' : (v >= 2 ? 'x3' : (v >= 1.5 ? 'x2' : 'x0')));
      var disp = v > 0 ? v.toFixed(1) : (i === j ? '' : '-');
      html += '<td class="' + cls + '"' + (v > 0 ? ' title="' + prods[i] + '+' + prods[j] + ' Lift=' + v.toFixed(1) + '"' : '') + '>' + disp + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
};

App.renderCrossBundles = function(bundles) {
  var el = document.getElementById('w-cross-bundles');
  if (!el || !bundles) return;
  el.innerHTML = bundles.map(function(b) {
    var scoreColor = b.score >= 3.5 ? '#7c3aed' : (b.score >= 2.5 ? '#dc2626' : (b.score >= 2 ? '#f59e0b' : '#10b981'));
    return '<div class="bundle-card" style="border-left:3px solid ' + scoreColor + '">' +
      '<div class="bundle-header"><strong>' + b.name + '</strong><span class="bundle-score" style="background:' + scoreColor + '">' + b.score.toFixed(1) + '</span></div>' +
      '<div class="bundle-prods">' + b.prods.map(function(p) { return '<span class="bundle-pill">' + p + '</span>'; }).join('') + '</div>' +
      '<div class="bundle-desc">覆盖率: <strong>' + b.rate + '</strong> | ' + b.desc + '</div>' +
      '</div>';
  }).join('');
};

App.renderCrossRecommend = function(data) {
  var el = document.getElementById('w-cross-recommend');
  if (!el) return;
  var prods = data.prods, mat = data.matrix, n = prods.length;
  var topPairs = [];
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      topPairs.push({ a: prods[i], b: prods[j], lift: mat[i][j] });
    }
  }
  topPairs.sort(function(a, b) { return b.lift - a.lift; });
  var items = topPairs.slice(0, 6);
  el.innerHTML = '<p style="margin-bottom:10px;font-weight:600">基于关联规则，对覆盖了A但未覆盖B的客户:</p>' +
    items.map(function(p) {
      return '<div style="padding:6px 0;border-bottom:1px solid #f3f4f6">' +
        '买了 <strong style="color:var(--primary)">' + p.a + '</strong> 的客户中，' +
        '<strong style="color:var(--danger)">' + Math.round(p.lift * 20) + '%</strong> 也买了 <strong style="color:var(--primary)">' + p.b + '</strong>，' +
        '提升度 <span style="font-weight:700;color:#7c3aed">' + p.lift.toFixed(1) + 'x</span>' +
        '</div>';
    }).join('');
};

// ===== 产品宽度 - 差距分析（团队 vs 部门均值） =====
App.renderWidthGapAnalysis = function() {
  var tbody = document.getElementById('wGapTable');
  var statsEl = document.getElementById('wGapStats');
  if (!tbody || !statsEl) return;

  var deptMap = {};
  App.DEPTS.forEach(function(d) { deptMap[d.n] = d.aw; });

  var rows = App.GROUPS.map(function(g) {
    var deptAvg = deptMap[g.dept] || 3.5;
    var gap = parseFloat((g.aw - deptAvg).toFixed(2));
    var gapRate = parseFloat(((gap / deptAvg) * 100).toFixed(1));
    var status, statusCls;
    if (gapRate > 5)      { status = '🚀 超前'; statusCls = 'b-up'; }
    else if (gapRate < -5) { status = '⚠ 落后'; statusCls = 'b-down'; }
    else                   { status = '✓ 正常'; statusCls = 'b-flat'; }
    return { name: g.n, dept: g.dept, aw: g.aw, deptAvg: deptAvg, gap: gap, gapRate: gapRate, status: status, statusCls: statusCls };
  });

  // 按差距率升序（落后在前）
  rows.sort(function(a, b) { return a.gapRate - b.gapRate; });

  // 统计卡片
  var aheadCount = rows.filter(function(r) { return r.gapRate > 5; }).length;
  var behindCount = rows.filter(function(r) { return r.gapRate < -5; }).length;
  var normalCount = rows.length - aheadCount - behindCount;
  var maxGap = Math.max.apply(null, rows.map(function(r) { return r.gap; }));
  var minGap = Math.min.apply(null, rows.map(function(r) { return r.gap; }));

  statsEl.innerHTML =
    '<div class="kpi-card k-green" style="padding:10px 14px"><div class="kpi-label">🚀 超均值团队</div><div class="kpi-value" style="font-size:20px">' + aheadCount + '</div><div class="kpi-sub">个 · 差距率 > +5%</div></div>' +
    '<div class="kpi-card" style="padding:10px 14px"><div class="kpi-label">✓ 正常团队</div><div class="kpi-value" style="font-size:20px">' + normalCount + '</div><div class="kpi-sub">个 · 差距率 ±5%</div></div>' +
    '<div class="kpi-card k-red" style="padding:10px 14px"><div class="kpi-label">⚠ 落后团队</div><div class="kpi-value" style="font-size:20px">' + behindCount + '</div><div class="kpi-sub">个 · 差距率 < -5%</div></div>' +
    '<div class="kpi-card k-orange" style="padding:10px 14px"><div class="kpi-label">📏 最大差距</div><div class="kpi-value" style="font-size:20px">' + (minGap < 0 ? minGap.toFixed(2) + ' ~ +' + maxGap.toFixed(2) : '+' + maxGap.toFixed(2)) + '</div><div class="kpi-sub">负=落后 · 正=超前</div></div>';

  // 表格
  tbody.innerHTML = rows.map(function(r, i) {
    var rnCls = i < 3 ? 'rn rn' + (i + 1) : 'rn rn0';
    var gapSign = r.gap >= 0 ? '+' : '';
    var gapRateSign = r.gapRate >= 0 ? '+' : '';
    var gapColor = r.gap >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    return '<tr>' +
      '<td><span class="' + rnCls + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + r.name + '</strong></td>' +
      '<td style="text-align:center">' + r.dept + '</td>' +
      '<td style="text-align:center;font-weight:700">' + r.aw.toFixed(2) + '</td>' +
      '<td style="text-align:center;color:#6b7280">' + r.deptAvg.toFixed(2) + '</td>' +
      '<td style="text-align:center;font-weight:700;' + gapColor + '">' + gapSign + r.gap.toFixed(2) + '</td>' +
      '<td style="text-align:center;font-weight:600;' + gapColor + '">' + gapRateSign + r.gapRate.toFixed(1) + '%</td>' +
      '<td><span class="badge ' + r.statusCls + '">' + r.status + '</span></td>' +
      '</tr>';
  }).join('');
};

// ===== 团队维度 (凯玲版) =====
App.renderTeamDim = function() {
  var data = App.Data.getWidth('all');
  if (!data || !data.teamDimension) return;
  var table = document.getElementById('w-team-dim-table');
  if (!table) return;

  var teamFilter = (document.getElementById('w-team-filter') || {}).value || 'all';
  var sortBy = (document.getElementById('w-team-sort') || {}).value || 'width_desc';

  var rows = data.teamDimension.teams.slice();
  if (teamFilter !== 'all') rows = rows.filter(function(r) { return r.name === teamFilter; });

  if (sortBy === 'width_desc') rows.sort(function(a, b) { return b.avg - a.avg; });
  else if (sortBy === 'width_asc') rows.sort(function(a, b) { return a.avg - b.avg; });
  else if (sortBy === 'count_desc') rows.sort(function(a, b) { return b.count - a.count; });
  else if (sortBy === 'guishang_desc') rows.sort(function(a, b) { return b.guishang - a.guishang; });

  var prods = data.teamDimension.prods;
  var thead = '<thead><tr>' +
    '<th class="team-col">团队</th>' +
    '<th>客户数</th>' +
    '<th>平均宽度</th>' +
    '<th>最大宽度</th>' +
    '<th>规上数</th>' +
    '<th>非规上数</th>' +
    prods.map(function(p) {
      var abbr = p.length > 4 ? (p.substring(0, 4) + '…') : p;
      return '<th title="' + p + '">' + abbr + '</th>';
    }).join('') +
    '</tr></thead>';

  var maxProd = 27;
  var tbody = '<tbody>' + rows.map(function(r) {
    var pct = (r.avg / maxProd * 100).toFixed(0);
    var cells = r.prodCnt.map(function(c) {
      if (c > 0) return '<td class="prod-cell"><span class="check">✓</span>' + c + '</td>';
      return '<td class="prod-cell empty">-</td>';
    }).join('');
    return '<tr>' +
      '<td class="team-name">' + r.name + '</td>' +
      '<td>' + r.count + '</td>' +
      '<td><div class="width-bar-wrap"><div class="width-bar"><div class="width-bar-fill" style="width:' + pct + '%"></div></div><span class="width-num">' + r.avg + '</span></div></td>' +
      '<td>' + r.max + '</td>' +
      '<td><span class="gs-badge" title="规上客户数">' + r.guishang + '</span></td>' +
      '<td><span class="ngs-badge" title="非规上客户数">' + r.nonguishang + '</span></td>' +
      cells +
      '</tr>';
  }).join('') + '</tbody>';

  table.innerHTML = thead + tbody;
};

App.exportTeamDim = function() {
  var data = App.Data.getWidth('all');
  if (!data || !data.teamDimension) return;
  var rows = [['团队','客户数','平均宽度','最大宽度','规上数','非规上数'].concat(data.teamDimension.prods)];
  data.teamDimension.teams.forEach(function(r) {
    rows.push([r.name, r.count, r.avg, r.max, r.guishang, r.nonguishang].concat(r.prodCnt));
  });
  var csv = rows.map(function(r) { return '"' + r.join('","') + '"'; }).join('\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '团队维度_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ===== 用户产品宽度覆盖 =====
function buildUserTipBody(u) {
  var prods = u.sold && u.sold.length ? u.sold.join('、') : '无';
  return '<div class="ct-line">用户宽度: <strong>' + u.avgW.toFixed(1) + '</strong></div>' +
         '<div class="ct-line">关联客户: <strong>' + u.custCnt + ' 个</strong></div>' +
         '<div class="ct-line">产品覆盖: <strong>' + u.soldCnt + ' / 27 类</strong></div>' +
         '<div class="ct-line">产品明细: ' + prods + '</div>' +
         '<div class="ct-line" style="margin-top:4px;border-top:1px solid #2d3548;padding-top:4px">代表客户: ' + u.custs + '</div>';
}

App.renderUserList = function(tbodyId, list, isGood) {
  var el = document.getElementById(tbodyId);
  if (!el || !list) return;
  el.innerHTML = list.map(function(u, i) {
    var rn = isGood ? 'rn' + (i < 3 ? (i + 1) : 0) : 'rn0';
    var widthStyle = isGood
      ? 'color:var(--primary);font-weight:700'
      : (u.avgW < 1 ? 'color:var(--danger);font-weight:700' : 'color:var(--warning);font-weight:700');
    var tipBody = buildUserTipBody(u);
    return '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td><strong class="cust-hover" data-cust-detail=\'' + tipBody + '\' data-cust-header="📋 用户产品详情">' + u.name + '</strong></td>' +
      '<td style="text-align:center;' + widthStyle + '">' + u.avgW.toFixed(1) + '</td>' +
      '<td style="text-align:center">' + u.custCnt + ' 个</td>' +
      '<td style="text-align:center;font-weight:700">' + u.soldCnt + ' / 27</td>' +
      '<td style="font-size:11px">' + u.custs + '</td>' +
      '</tr>';
  }).join('');
};

// ===== 分组对比 (整合自凯玲版) =====
function getTeamStats(team) {
  var f = SCALE[team] || SCALE['all'];
  return {
    name:      team === 'all' ? '全部团队均值' : team,
    count:     scaleKpi(BASE_WIDTH.customers, f.customers),
    avgWidth:  parseFloat((BASE_WIDTH.avgWidth * f.width).toFixed(2)),
    guishang:  scaleKpi(BASE_WIDTH.scaleUp, f.customers),
    guishangRate: parseFloat(((BASE_WIDTH.scaleUp / BASE_WIDTH.customers) * 100).toFixed(1)),
    prodRates: BASE_HEATMAP_PRODS.map(function(p) { return p.rate; })
  };
}

function getAllMeanStats() {
  var teams = ['政府行业组', '公安交警行业组', '工业企业一组', '智慧建筑组'];
  var stats = teams.map(getTeamStats);
  var count = stats.reduce(function(s, t) { return s + t.count; }, 0) / stats.length;
  var avgWidth = stats.reduce(function(s, t) { return s + t.avgWidth; }, 0) / stats.length;
  var guishang = stats.reduce(function(s, t) { return s + t.guishang; }, 0) / stats.length;
  var guishangRate = stats.reduce(function(s, t) { return s + t.guishangRate; }, 0) / stats.length;
  // 各品类平均 = BASE_HEATMAP_PRODS 的 rate（各团队比例一致，因为按 customers 缩放抵消）
  var prodRates = BASE_HEATMAP_PRODS.map(function(p) { return p.rate; });
  return {
    name: '全部团队均值', count: count, avgWidth: avgWidth, guishang: guishang,
    guishangRate: guishangRate, prodRates: prodRates
  };
}

// ===== 分组对比 (凯玲版: 3 模式 + 完整产品对比 + 智能建议) =====
App.renderCompare = function() {
  var mode = (document.getElementById('compare-mode') || {}).value || 'group';
  var wrapA = document.getElementById('compare-groupA-wrap');
  var wrapB = document.getElementById('compare-groupB-wrap');
  var wrapP = document.getElementById('compare-person-wrap');
  var wrapM = document.getElementById('compare-meanB-wrap');
  var infoEl = document.getElementById('w-compare-info');

  // 1. 动态填充下拉 (凯玲版: 根据模式切换)
  var selA = document.getElementById('compare-groupA');
  var selB = document.getElementById('compare-groupB');
  var selP = document.getElementById('compare-person');
  function fillSelect(sel, items, valueField, textField) {
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">-- 请选择 --</option>';
    items.forEach(function(it) {
      var opt = document.createElement('option');
      opt.value = it[valueField];
      opt.textContent = it[textField];
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }
  if (mode === 'person') {
    fillSelect(selP, BASE_COMPARE_PERSONS, 'name', 'name');
    if (wrapA) wrapA.style.display = 'none';
    if (wrapB) wrapB.style.display = 'none';
    if (wrapP) wrapP.style.display = '';
    if (wrapM) wrapM.style.display = 'none';
  } else if (mode === 'mean') {
    fillSelect(selA, BASE_COMPARE_TEAMS.map(function(t) { return { name: t }; }), 'name', 'name');
    if (wrapA) wrapA.style.display = '';
    if (wrapB) wrapB.style.display = 'none';
    if (wrapP) wrapP.style.display = 'none';
    if (wrapM) wrapM.style.display = '';
  } else {
    fillSelect(selA, BASE_COMPARE_TEAMS.map(function(t) { return { name: t }; }), 'name', 'name');
    fillSelect(selB, BASE_COMPARE_TEAMS.map(function(t) { return { name: t }; }), 'name', 'name');
    if (wrapA) wrapA.style.display = '';
    if (wrapB) wrapB.style.display = '';
    if (wrapP) wrapP.style.display = 'none';
    if (wrapM) wrapM.style.display = 'none';
  }

  // 2. 取当前选择值
  var gA = (document.getElementById('compare-groupA') || {}).value || '';
  var gB = (document.getElementById('compare-groupB') || {}).value || '';
  var person = (document.getElementById('compare-person') || {}).value || '';

  // 3. 校验 + 显示空状态
  function showInfo(msg) {
    // 在结果区显示提示
    var summaryEl = document.getElementById('w-compare-summary-body');
    if (summaryEl) { summaryEl.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#9ca3af;font-size:15px">' + msg + '</td></tr>'; }
    // 清空其他区域
    ['w-compare-prod-body','w-compare-ai-body'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.innerHTML = '';
    });
  }

  // 4. 校验并准备数据
  var dataA = null, dataB = null, labelA = '', labelB = '', type = mode;
  if (mode === 'person') {
    if (!person) { showInfo('请先选择个人（CRM账号）'); return; }
    dataA = getPersonCompareData(person);
    var personInfo = BASE_COMPARE_PERSONS.find(function(p) { return p.name === person; });
    dataB = personInfo ? getTeamCompareData(personInfo.team) : getAllMeanCompareData();
    labelA = person;
    labelB = personInfo ? (personInfo.team + ' 团队均值') : '全部团队均值';
  } else if (mode === 'group') {
    if (!gA) { showInfo('请先选择对比组A'); return; }
    if (!gB) { showInfo('请选择对比组B'); return; }
    if (gA === gB) { showInfo('请选择另一个不同的团队进行对比'); return; }
    dataA = getTeamCompareData(gA);
    dataB = getTeamCompareData(gB);
    labelA = gA; labelB = gB;
  } else if (mode === 'mean') {
    if (!gA) { showInfo('请先选择对比组A'); return; }
    dataA = getTeamCompareData(gA);
    dataB = getAllMeanCompareData();
    labelA = gA; labelB = '全部团队均值';
  }

  // 5. 综合指标对比表
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  setText('w-compare-th-A',  labelA);
  setText('w-compare-th-A2', labelA + ' 覆盖率');
  setText('w-compare-th-B',  labelB);
  setText('w-compare-th-B2', labelB + ' 覆盖率');
  setText('compare-level', '对比模式: ' + (mode === 'person' ? (labelA + ' vs ' + labelB) : (mode === 'mean' ? (labelA + ' vs 全部均值') : (labelA + ' vs ' + labelB))));
  setText('w-compare-radar-tag', BASE_COMPARE_PRODS.length + '品类');
  setText('w-compare-ai-title', labelA + ' vs ' + labelB + ' 诊断');

  // 个人模式多一项最大宽度
  var metrics = mode === 'person'
    ? [
      ['客户数',       dataA.count,        dataB.count,        '',         0],
      ['平均产品宽度', dataA.avgWidth,     dataB.avgWidth,     '越大越好', 2],
      ['最大产品宽度', dataA.maxWidth,     dataB.maxWidth,     '越大越好', 0],
      ['规上客户数',   dataA.guishang,     dataB.guishang,     '越大越好', 0],
      ['规上比率%',    dataA.guishangRate, dataB.guishangRate, '越大越好', 1]
    ]
    : [
      ['客户数',       dataA.count,        dataB.count,        '',         0],
      ['平均产品宽度', dataA.avgWidth,     dataB.avgWidth,     '越大越好', 2],
      ['规上客户数',   dataA.guishang,     dataB.guishang,     '越大越好', 0],
      ['规上比率%',    dataA.guishangRate, dataB.guishangRate, '越大越好', 1]
    ];
  var summaryHtml = '';
  metrics.forEach(function(m) {
    var label = m[0], va = m[1], vb = m[2], dir = m[3], dec = m[4];
    var na = parseFloat(va), nb = parseFloat(vb);
    var diff = na - nb;
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(dec);
    var vaStr = (typeof va === 'number' && dec > 0) ? va.toFixed(dec) : va;
    var vbStr = (typeof vb === 'number' && dec > 0) ? vb.toFixed(dec) : vb;
    var aCls = dir === '越大越好' ? (na > nb ? 'compare-better' : (na < nb ? 'compare-worse' : '')) : '';
    var bCls = dir === '越大越好' ? (nb > na ? 'compare-better' : (nb < na ? 'compare-worse' : '')) : '';
    var dCls = diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '');
    summaryHtml += '<tr>' +
      '<td>' + label + '</td>' +
      '<td class="' + aCls + '">' + vaStr + '</td>' +
      '<td class="' + bCls + '">' + vbStr + '</td>' +
      '<td class="' + dCls + '"><strong>' + diffStr + '</strong></td>' +
      '</tr>';
  });
  App.setHTML('w-compare-summary-body', summaryHtml);

  // 6. 27 品类覆盖率对比表
  var prodHtml = '';
  for (var i = 0; i < BASE_COMPARE_PRODS.length; i++) {
    var aRate = dataA.prodCnt[i], bRate = dataB.prodCnt[i];
    var diff = aRate - bRate;
    var dCls = diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '');
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    prodHtml += '<tr>' +
      '<td>' + BASE_COMPARE_PRODS[i] + '</td>' +
      '<td>' + aRate + '%</td>' +
      '<td>' + bRate + '%</td>' +
      '<td class="' + dCls + '"><strong>' + diffStr + '</strong></td>' +
      '</tr>';
  }
  App.setHTML('w-compare-prod-body', prodHtml);

  // 7. 雷达图 (15 品类)
  var radarLabels = BASE_COMPARE_PRODS.slice(0, 15);
  var radarDataA = dataA.prodCnt.slice(0, 15);
  var radarDataB = dataB.prodCnt.slice(0, 15);
  if (App.charts.wCompareRadar) {
    App.charts.wCompareRadar.data.labels = radarLabels;
    App.charts.wCompareRadar.data.datasets[0].label = labelA;
    App.charts.wCompareRadar.data.datasets[0].data = radarDataA;
    App.charts.wCompareRadar.data.datasets[1].label = labelB;
    App.charts.wCompareRadar.data.datasets[1].data = radarDataB;
    App.charts.wCompareRadar.update();
  }

  // 8. 宽度分布对比柱图 (0/1-3/4-6/7-10/11-15/16+)
  var buckets = ['0', '1-3', '4-6', '7-10', '11-15', '16+'];
  // 凯玲版: 用团队客户数 * 覆盖率比例估算分布
  var baseDist = [42, 302, 66, 34, 18, 9];
  var totalAll = 1247;
  var distA = baseDist.map(function(b) { return Math.round(b * (dataA.count / totalAll)); });
  var distB = baseDist.map(function(b) { return Math.round(b * (dataB.count / totalAll)); });
  if (App.charts.wCompareDist) {
    App.charts.wCompareDist.data.labels = buckets;
    App.charts.wCompareDist.data.datasets[0].label = labelA;
    App.charts.wCompareDist.data.datasets[0].data = distA;
    App.charts.wCompareDist.data.datasets[1].label = labelB;
    App.charts.wCompareDist.data.datasets[1].data = distB;
    App.charts.wCompareDist.update();
  }

  // 9. AI 智能分析 (凯玲版: 3 模式分支 + 强/弱产品列表)
  var avgDiff = dataA.avgWidth - dataB.avgWidth;
  var weakProds = [], strongProds = [];
  for (var j = 0; j < BASE_COMPARE_PRODS.length; j++) {
    var aR = dataA.prodCnt[j], bR = dataB.prodCnt[j];
    if (aR < bR - 10) weakProds.push({ name: BASE_COMPARE_PRODS[j], gap: (bR - aR).toFixed(1) });
    else if (aR > bR + 10) strongProds.push({ name: BASE_COMPARE_PRODS[j], lead: (aR - bR).toFixed(1) });
  }

  var aiBody = '';
  var suggestClass = avgDiff > 0 ? 'zheng-fu' : (avgDiff < 0 ? 'gong-an' : 'wen-jiao');
  var titlePrefix = mode === 'mean' ? ' vs 全部团队均值' : ' vs ' + labelB;

  if (avgDiff > 0) {
    aiBody += '<div class="suggestion-card ' + suggestClass + '">' +
      '<h3>📊 ' + labelA + titlePrefix + ' — 分析建议</h3>' +
      '<p><strong>✅ 整体表现' + (mode === 'mean' ? '优于均值' : '领先') + '：</strong>平均产品宽度 <strong>' + dataA.avgWidth.toFixed(2) + '</strong>' +
      (mode === 'mean' ? '，高于全部均值' : '，高于' + labelB) + ' <strong>' + dataB.avgWidth.toFixed(2) + '</strong>（+' + avgDiff.toFixed(2) + '）。' +
      (mode === 'mean' ? '该团队整体产品覆盖能力较强。' : '') + '</p>';
  } else if (avgDiff < 0) {
    aiBody += '<div class="suggestion-card ' + suggestClass + '">' +
      '<h3>📊 ' + labelA + titlePrefix + ' — 分析建议</h3>' +
      '<p><strong>⚠️ 整体表现' + (mode === 'mean' ? '低于均值' : '落后') + '：</strong>平均产品宽度 <strong>' + dataA.avgWidth.toFixed(2) + '</strong>' +
      (mode === 'mean' ? '，低于全部均值' : '，低于' + labelB) + ' <strong>' + dataB.avgWidth.toFixed(2) + '</strong>（' + avgDiff.toFixed(2) + '）。' +
      (mode === 'mean' ? '该团队产品覆盖能力有待提升。' : '') + '</p>';
  } else {
    aiBody += '<div class="suggestion-card ' + suggestClass + '">' +
      '<h3>📊 ' + labelA + titlePrefix + ' — 分析建议</h3>' +
      '<p><strong>➡️ 整体持平：</strong>平均产品宽度 <strong>' + dataA.avgWidth.toFixed(2) + '</strong>，与 ' + labelB + ' 基本一致。</p>';
  }

  if (strongProds.length) {
    aiBody += '<p><strong>🏆 ' + (mode === 'mean' ? '优势产品（领先均值 10% 以上）' : (mode === 'group' ? '领先产品' : '领先团队')) + '：</strong>' +
      strongProds.slice(0, 5).map(function(x) { return x.name + ' (+' + x.lead + '%)'; }).join('、') + '</p>';
  }
  if (weakProds.length) {
    aiBody += '<p><strong>⚠️ ' + (mode === 'mean' ? '待提升产品（低于均值 10% 以上）' : (mode === 'group' ? '落后产品' : '差距产品')) + '：</strong>' +
      weakProds.slice(0, 5).map(function(x) { return x.name + ' (-' + x.gap + '%)'; }).join('、') + '</p>';
  }

  // 凯玲版建议语
  if (mode === 'mean') {
    if (avgDiff > 0) {
      aiBody += '<p><strong>💡 建议：</strong>继续保持优势产品覆盖，同时' + (weakProds.length ? '重点补齐 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等短板产品' : '巩固现有优势') + '，提升整体产品宽度。</p>';
    } else if (avgDiff < 0) {
      aiBody += '<p><strong>💡 建议：</strong>' + (weakProds.length ? '优先推进 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等产品覆盖' : '补齐短板') + '，缩小与均值的差距；' +
        (strongProds.length ? '发挥 ' + strongProds.slice(0, 2).map(function(x) { return x.name; }).join('、') + ' 等优势产品经验' : '从核心基础产品入手') + '。</p>';
    } else {
      aiBody += '<p><strong>💡 建议：</strong>对标均值找出差距，' + (weakProds.length ? '重点补齐 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等薄弱产品' : '保持现有产品覆盖') + '。</p>';
    }
  } else if (mode === 'group') {
    if (avgDiff > 0) {
      aiBody += '<p><strong>💡 建议：</strong>保持领先优势，' + (weakProds.length ? '同时关注 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等差距产品' : '全面巩固产品覆盖') + '。</p>';
    } else if (avgDiff < 0) {
      aiBody += '<p><strong>💡 建议：</strong>' + (weakProds.length ? '重点突破 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等差距产品' : '对标团队') + '；' +
        (strongProds.length ? '以 ' + strongProds.slice(0, 2).map(function(x) { return x.name; }).join('、') + ' 为突破口' : '复制对标团队经验') + '。</p>';
    } else {
      aiBody += '<p><strong>💡 建议：</strong>' + (weakProds.length ? '重点补齐 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等薄弱产品' : '寻求差异化优势') + '。</p>';
    }
  } else {
    // person
    if (avgDiff > 0) {
      aiBody += '<p><strong>💡 建议：</strong>个人表现领先团队均值，' + (weakProds.length ? '重点补齐 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等产品' : '继续保持') + '。</p>';
    } else {
      aiBody += '<p><strong>💡 建议：</strong>' + (weakProds.length ? '优先突破 ' + weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') + ' 等产品' : '提升客户覆盖广度') + '。</p>';
    }
  }
  aiBody += '</div>';
  App.setHTML('w-compare-ai-body', aiBody);
};

// ===== 分组对比 - 数据获取辅助函数 =====
function getTeamCompareData(team) {
  var stats = BASE_COMPARE_TEAM_STATS[team] || BASE_COMPARE_TEAM_STATS['政府行业组'];
  var prodCnt = BASE_COMPARE_TEAM_PROD[team] || BASE_COMPARE_TEAM_PROD['政府行业组'];
  return {
    name: team,
    count: stats.count,
    avgWidth: stats.avgWidth,
    maxWidth: stats.maxWidth,
    guishang: stats.guishang,
    guishangRate: stats.guishangRate,
    prodCnt: prodCnt
  };
}

function getPersonCompareData(person) {
  var stats = BASE_COMPARE_PERSON_STATS[person] || BASE_COMPARE_PERSON_STATS['陈思源'];
  var prodCnt = BASE_COMPARE_PERSON_PROD[person] || BASE_COMPARE_PERSON_PROD['陈思源'];
  return {
    name: person,
    count: stats.count,
    avgWidth: stats.avgWidth,
    maxWidth: stats.maxWidth,
    guishang: stats.guishang,
    guishangRate: stats.guishangRate,
    prodCnt: prodCnt
  };
}

function getAllMeanCompareData() {
  return {
    name: '全部团队均值',
    count: BASE_COMPARE_ALL_MEAN.count,
    avgWidth: BASE_COMPARE_ALL_MEAN.avgWidth,
    maxWidth: BASE_COMPARE_ALL_MEAN.maxWidth,
    guishang: BASE_COMPARE_ALL_MEAN.guishang,
    guishangRate: BASE_COMPARE_ALL_MEAN.guishangRate,
    // 全部均值: 4 团队覆盖率取平均
    prodCnt: BASE_COMPARE_PRODS.map(function(p, i) {
      var vals = ['政府行业组', '公安交警行业组', '工业企业一组', '智慧建筑组'].map(function(t) {
        return BASE_COMPARE_TEAM_PROD[t][i];
      });
      return Math.round(vals.reduce(function(s, v) { return s + v; }, 0) / 4);
    })
  };
}

// ===== 导出对比结果 =====
App.exportCompareResult = function() {
  var rows = [['指标', '对比组A', '对比组B', '差异']];
  document.querySelectorAll('#w-compare-summary-body tr').forEach(function(tr) {
    var tds = tr.querySelectorAll('td');
    var r = [];
    tds.forEach(function(td) { r.push(td.textContent.trim()); });
    rows.push(r);
  });
  rows.push([]);
  rows.push(['产品类别', 'A 覆盖率', 'B 覆盖率', '差异']);
  document.querySelectorAll('#w-compare-prod-body tr').forEach(function(tr) {
    var tds = tr.querySelectorAll('td');
    var r = [];
    tds.forEach(function(td) { r.push(td.textContent.trim()); });
    rows.push(r);
  });
  var csv = rows.map(function(r) { return '"' + r.join('","') + '"'; }).join('\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '对比结果_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ===== 客户/用户悬浮详情 Tooltip (参考简刚平版) =====
App.initCustTooltip = function() {
  var ct = document.getElementById('custTooltip');
  if (!ct) return;
  var hideTimer = null;

  function showTip(el, x, y) {
    clearTimeout(hideTimer);
    var raw = el.getAttribute('data-cust-detail');
    var header = el.getAttribute('data-cust-header') || '📋 客户产品详情';
    if (!raw) return;
    ct.innerHTML = '<div class="ct-header">' + header + '</div><div class="ct-body">' + raw + '</div>';
    ct.style.display = 'block';
    var W = window.innerWidth, H = window.innerHeight;
    var tw = ct.offsetWidth || 260, th = ct.offsetHeight || 80;
    var left = x + 14, top = y + 8;
    if (left + tw > W - 10) left = x - tw - 10;
    if (top + th > H - 10) top = y - th - 6;
    ct.style.left = left + 'px';
    ct.style.top = top + 'px';
    requestAnimationFrame(function() { ct.classList.add('visible'); });
  }

  function hideTip() {
    hideTimer = setTimeout(function() { ct.classList.remove('visible'); }, 120);
  }

  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-cust-detail]');
    if (el) showTip(el, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', function(e) {
    var el = e.target.closest('[data-cust-detail]');
    if (el && ct.classList.contains('visible')) {
      var W = window.innerWidth, H = window.innerHeight;
      var tw = ct.offsetWidth || 260, th = ct.offsetHeight || 80;
      var left = e.clientX + 14, top = e.clientY + 8;
      if (left + tw > W - 10) left = e.clientX - tw - 10;
      if (top + th > H - 10) top = e.clientY - th - 6;
      ct.style.left = left + 'px';
      ct.style.top = top + 'px';
    }
  });
  document.addEventListener('mouseout', function(e) {
    var el = e.target.closest('[data-cust-detail]');
    if (el) hideTip();
  });
};
// 启动 Tooltip 系统（脚本在 body 末尾，DOM 已就绪）
App.initCustTooltip();

// 潜力产品 TOP 10 表
App.renderPotentialTop10 = function(tbodyId, products) {
  var html = '';
  products.forEach(function(p, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var yoyBadge = p.yoy.indexOf('+') === 0 ? 'b-up' : (p.yoy.indexOf('-') === 0 ? 'b-down' : (p.yoy === '新增' ? 'b-new' : 'b-warn'));
    var qtyCls = p.qty.indexOf('+') === 0 ? 'delta-up' : 'delta-down';
    var typeBadge = p.type === '量价齐升' ? 'b-up' : (p.type === '量价齐跌' ? 'b-down' : (p.type === '新增' ? 'b-new' : 'b-warn'));
    html += '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td>' + (i < 2 ? '<strong>' + p.product + '</strong>' : p.product) + '</td>' +
      '<td>' + p.sales + '</td>' +
      '<td><span class="badge ' + yoyBadge + '">' + p.yoy + '</span></td>' +
      '<td><span class="' + qtyCls + '">' + p.qty + '</span></td>' +
      '<td><span class="badge ' + typeBadge + '">' + p.type + '</span></td>' +
      '</tr>';
  });
  App.setHTML(tbodyId, html);
};

// ===== 级联筛选入口函数（供 HTML onchange 调用） =====
App.updateOverviewCascade  = function() { App.updateOverview(); };
App.updateWidthCascade     = function() { App.updateWidth(); };
App.updatePotentialCascade = function() { App.updatePotential(); };

// ===== 低宽度筛选统计 =====
App.filterLowWidth = function() {
  var input = document.getElementById('width-threshold');
  var threshold = input ? parseInt(input.value) || 3 : 3;

  // Demo 数据：模拟不同阈值下的统计结果
  var demoMap = {
    1: { count: 42,  rate: '3.4%',  avg: '0.5',  gap: '-3.46' },
    2: { count: 218, rate: '17.5%', avg: '1.1',  gap: '-2.86' },
    3: { count: 586, rate: '47.0%', avg: '1.62', gap: '-2.34' },
    4: { count: 812, rate: '65.1%', avg: '2.15', gap: '-1.81' },
    5: { count: 968, rate: '77.6%', avg: '2.78', gap: '-1.18' },
    6: { count: 1082, rate: '86.8%', avg: '3.25', gap: '-0.71' },
    7: { count: 1156, rate: '92.7%', avg: '3.82', gap: '-0.14' },
    8: { count: 1202, rate: '96.4%', avg: '4.15', gap: '+0.19' },
    9: { count: 1232, rate: '98.8%', avg: '4.52', gap: '+0.56' },
    10: { count: 1247, rate: '100%',  avg: '4.85', gap: '+0.89' }
  };

  var demo = demoMap[Math.min(10, Math.max(1, threshold))] || demoMap[3];

  App.setText('w-low-count', demo.count);
  App.setText('w-low-rate', demo.rate);
  App.setText('w-low-avg', demo.avg);
  var gapEl = document.getElementById('w-low-gap');
  if (gapEl) {
    gapEl.textContent = demo.gap;
    gapEl.className = parseFloat(demo.gap) < 0 ? 'delta-down' : 'delta-up';
  }

};

// ===== 数据总览 — 导出 PDF（仅导出总览页内容） =====
App.exportOverviewPDF = function() {
  var ov = document.getElementById('page-overview');
  if (!ov) return;
  // 隐藏其他页面
  var allPages = document.querySelectorAll('.page');
  allPages.forEach(function(p) { if (p.id !== 'page-overview') p.style.display = 'none'; });
  // 克隆总览页
  var clone = ov.cloneNode(true);
  clone.style.display = 'block';
  clone.style.position = 'absolute';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = '210mm';
  clone.style.background = '#fff';
  clone.style.zIndex = '99999';
  clone.style.padding = '12px';
  // 移除不需要的元素
  var rm = clone.querySelectorAll('.filter-bar, .ai-box, button, .dim-btns, .page-header-tabs, .flex');
  rm.forEach(function(el) { el.remove(); });
  // canvas 转图片
  clone.querySelectorAll('canvas').forEach(function(c) {
    var img = document.createElement('img');
    try { img.src = c.toDataURL('image/png'); } catch(e) {}
    img.style.width = '100%';
    img.style.maxHeight = '260px';
    img.style.objectFit = 'contain';
    c.parentNode.replaceChild(img, c);
  });
  document.body.appendChild(clone);

  var style = document.createElement('style');
  style.textContent = '@media print { body > *:not(#' + clone.id + ') { display: none !important; } }';
  document.head.appendChild(style);

  window.print();

  document.body.removeChild(clone);
  document.head.removeChild(style);
  allPages.forEach(function(p) { p.style.display = ''; });
};

// ===== 通用导出 PDF =====
App.exportPDF = function() {
  window.print();
};

// ===== 数据总览 — 导出 Excel（KPI 汇总 + 部门明细 + 小组明细） =====
App.exportOverviewExcel = function() {
  var d = new Date();
  var dateStr = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
  var rows = [];

  // 读取当前筛选状态
  var state = App.getFilterState('page-overview');
  var startEl = document.getElementById('ov-date-start');
  var endEl = document.getElementById('ov-date-end');

  rows.push(['数据总览报表', '', '', '', '']);
  rows.push(['导出时间', dateStr, '', '', '']);
  rows.push(['时间范围', (startEl?startEl.value:'') + ' ~ ' + (endEl?endEl.value:''), '', '', '']);
  rows.push(['筛选粒度', App.getFilterLabel(state), '', '', '']);
  rows.push(['', '', '', '', '']);

  // KPI 指标
  rows.push(['指标', '数值', '备注', '', '']);
  var kpis = [
    ['产品宽度',         document.getElementById('ov-kpi-width') ? document.getElementById('ov-kpi-width').textContent : '', '平均宽度'],
    ['用户产品宽度',     document.getElementById('ov-kpi-user-width') ? document.getElementById('ov-kpi-user-width').textContent : '', '终端使用方'],
    ['客户产品宽度',     document.getElementById('ov-kpi-cust-width') ? document.getElementById('ov-kpi-cust-width').textContent : '', '售达方'],
    ['潜力产品销售额',   document.getElementById('ov-kpi-potential-amt-v') ? document.getElementById('ov-kpi-potential-amt-v').textContent : '', ''],
    ['覆盖用户数',       document.getElementById('ov-kpi-users') ? document.getElementById('ov-kpi-users').textContent : '', ''],
    ['覆盖客户数',       document.getElementById('ov-kpi-customers') ? document.getElementById('ov-kpi-customers').textContent : '', '环比 ' + (document.getElementById('ov-kpi-cust-mom') ? document.getElementById('ov-kpi-cust-mom').textContent : '')]
  ];
  kpis.forEach(function(r) { rows.push(r); });
  rows.push(['', '', '', '', '']);

  // 部门维度
  rows.push(['部门', '负责人', '客均宽度', '客户数', '覆盖率']);
  App.DEPTS.forEach(function(d) { rows.push([d.n, d.ld, d.aw, d.cw, d.cov + '%']); });
  rows.push(['', '', '', '', '']);

  // 小组维度
  rows.push(['小组', '所属部门', '组长', '客均宽度', '客户数']);
  App.GROUPS.forEach(function(g) { rows.push([g.n, g.dept, g.ld, g.aw, g.cw]); });
  rows.push(['', '', '', '', '']);

  // 个人维度
  rows.push(['姓名', '所属部门', '所属小组', '客均宽度', '客户数']);
  App.PERSONS.forEach(function(p) { rows.push([p.n, p.dept, p.grp, p.aw, p.cw]); });

  var bom = '﻿';
  var csv = bom + rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = '数据总览_' + d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2) + ('0'+d.getDate()).slice(-2) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ===== 导出 Excel (CSV) — 通用 =====
App.exportExcel = function(pageId) {
  var page = document.getElementById(pageId);
  if (!page) return;

  // 找到当前可见的表格
  var tables = page.querySelectorAll('table.table:not(.tight-table), table.mini-table');
  if (tables.length === 0) {
    alert('当前页面无数据表格可导出');
    return;
  }

  var csvRows = [];
  tables.forEach(function(table) {
    // 表头
    var headers = [];
    table.querySelectorAll('thead th').forEach(function(th) {
      headers.push('"' + th.textContent.trim().replace(/"/g, '""') + '"');
    });
    if (headers.length > 0) csvRows.push(headers.join(','));

    // 表体
    table.querySelectorAll('tbody tr').forEach(function(tr) {
      var cells = [];
      tr.querySelectorAll('td').forEach(function(td) {
        cells.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
      });
      if (cells.length > 0) csvRows.push(cells.join(','));
    });

    // 表格之间空一行
    csvRows.push('');
  });

  // 生成 BOM + CSV
  var csv = '﻿' + csvRows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'export_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ===== 全局导出按钮绑定 =====
document.addEventListener('click', function(e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var text = btn.textContent || '';
  // 导出 PDF 按钮（通过文本匹配）
  if (text.indexOf('导出PDF') !== -1 || text.indexOf('导出报告') !== -1) {
    App.exportPDF();
    return;
  }
  // 导出 Excel 按钮
  if (text.indexOf('导出Excel') !== -1) {
    var page = btn.closest('.page');
    App.exportExcel(page ? page.id : 'page-overview');
  }
});

// ===== 产品宽度 — 团队维度：数据明细（部门/组/个人 钻取表） =====
App.WidthDetail = {
  dim: 'dept',
  expanded: -1,

  // 切换维度 tab
  switchDim: function(d) {
    App.WidthDetail.dim = d;
    App.WidthDetail.expanded = -1;
    // 更新 tab active 样式
    var tabs = document.querySelectorAll('#wTeamTabs .subtab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.querySelector('#wTeamTabs [data-d="' + d + '"]');
    if (activeTab) activeTab.classList.add('active');
    App.WidthDetail.render();
  },

  // 获取当前维度数据
  getData: function() {
    if (App.WidthDetail.dim === 'dept') return App.getFilteredDepts();
    if (App.WidthDetail.dim === 'group') return App.getFilteredGroups();
    return App.getFilteredPersons();
  },

  // 获取钻取子数据
  getChildren: function(entity) {
    if (App.WidthDetail.dim === 'dept') {
      // 部门下钻 → 该部门下属组
      return App.GROUPS.filter(function(g) { return g.dept === entity.n; });
    }
    if (App.WidthDetail.dim === 'group') {
      // 组下钻 → 该组下属人员
      return App.PERSONS.filter(function(p) { return p.grp === entity.n; });
    }
    // 个人下钻 → 模拟负责客户明细
    return [
      { cust: '深圳市政府',  width: 10, cov: '100%', yoy: '+15%' },
      { cust: '深圳市公安局', width: 8,  cov: '87.5%', yoy: '+10%' },
      { cust: '深圳大学',    width: 6,  cov: '75.0%', yoy: '+5%' },
      { cust: '深圳地铁',    width: 5,  cov: '62.5%', yoy: '-2%' },
      { cust: '深圳机场',    width: 4,  cov: '50.0%', yoy: '-5%' }
    ].slice(0, Math.floor(Math.random() * 3) + 3);
  },

  // 展开/收起
  toggle: function(i) {
    App.WidthDetail.expanded = App.WidthDetail.expanded === i ? -1 : i;
    App.WidthDetail.render();
  },

  // 渲染 yoy 徽章
  yoyBadge: function(yoy) {
    var s = String(yoy);
    if (s.charAt(0) === '+') return '<span class="badge b-up">' + s + '</span>';
    if (s.charAt(0) === '-') return '<span class="badge b-down">' + s + '</span>';
    return '<span class="badge b-flat">' + s + '</span>';
  },

  // 渲染表格
  render: function() {
    var data = App.WidthDetail.getData();
    var dim = App.WidthDetail.dim;
    var exp = App.WidthDetail.expanded;
    var h = '';

    data.forEach(function(r, i) {
      var rankClass = i < 3 ? 'rn rn' + (i + 1) : 'rn rn0';
      var isExpanded = i === exp;
      var parentLabel = '';
      if (dim === 'group') parentLabel = ' <span style="font-size:10px;color:#94a3b8">(' + r.dept + ')</span>';
      if (dim === 'person') parentLabel = ' <span style="font-size:10px;color:#94a3b8">(' + r.grp + ')</span>';

      h += '<tr class="clickable" onclick="App.WidthDetail.toggle(' + i + ')" style="cursor:pointer">';
      h += '<td><span class="' + rankClass + '">' + (i + 1) + '</span></td>';
      h += '<td><strong>' + r.n + '</strong>' + parentLabel + '</td>';
      h += '<td style="text-align:center">' + (r.cw || '-') + '</td>';
      h += '<td style="text-align:center;font-weight:700;color:var(--primary)">' + (r.aw != null ? r.aw.toFixed(2) : '-') + '</td>';
      h += '<td style="text-align:center">' + (r.mw || '-') + '</td>';
      h += '<td style="text-align:center">' + (r.cov != null ? r.cov.toFixed(1) + '%' : '-') + '</td>';
      h += '<td style="text-align:center">' + App.WidthDetail.yoyBadge(r.yoy || '0%') + '</td>';
      h += '</tr>';

      // 展开钻取行
      if (isExpanded) {
        var children = App.WidthDetail.getChildren(r);
        if (children.length > 0) {
          h += '<tr class="w-drill-row"><td colspan="7"><div class="w-drill-wrap">';
          if (dim === 'person') {
            // 个人 → 负责客户明细
            h += '<table class="table w-drill-tbl"><thead><tr><th>客户名称</th><th style="text-align:center">产品宽度</th><th style="text-align:center">覆盖率</th><th style="text-align:center">同比变化</th></tr></thead><tbody>';
            children.forEach(function(c) {
              h += '<tr><td><strong>' + c.cust + '</strong></td><td style="text-align:center">' + c.width + '</td><td style="text-align:center">' + c.cov + '</td><td style="text-align:center">' + App.WidthDetail.yoyBadge(c.yoy) + '</td></tr>';
            });
            h += '</tbody></table>';
          } else {
            // 部门/组 → 下属汇总
            var childLabel = dim === 'dept' ? '组名' : '姓名';
            h += '<table class="table w-drill-tbl"><thead><tr><th>' + childLabel + '</th><th style="text-align:center">覆盖客户数</th><th style="text-align:center">客均宽度</th><th style="text-align:center">最大宽度</th><th style="text-align:center">覆盖率</th><th style="text-align:center">同比变化</th></tr></thead><tbody>';
            children.forEach(function(c) {
              h += '<tr><td><strong>' + c.n + '</strong></td><td style="text-align:center">' + (c.cw || '-') + '</td><td style="text-align:center;font-weight:600;color:var(--primary)">' + (c.aw != null ? c.aw.toFixed(2) : '-') + '</td><td style="text-align:center">' + (c.mw || '-') + '</td><td style="text-align:center">' + (c.cov != null ? c.cov.toFixed(1) + '%' : '-') + '</td><td style="text-align:center">' + App.WidthDetail.yoyBadge(c.yoy || '0%') + '</td></tr>';
            });
            h += '</tbody></table>';
          }
          h += '</div></td></tr>';
        } else {
          h += '<tr class="w-drill-row"><td colspan="7"><div class="w-drill-wrap"><div style="padding:12px;color:#94a3b8;font-size:12px">暂无下属数据</div></div></td></tr>';
        }
      }
    });

    var tbody = document.getElementById('wTeamTable');
    if (tbody) tbody.innerHTML = h;
  }
};

// 筛选变更时刷新团队明细
App.WidthDetail.refresh = function() {
  App.WidthDetail.expanded = -1;
  App.WidthDetail.render();
};

// ===== 产品宽度 — 客户维度：客户产品覆盖明细（团队分析） =====
// data.js 中已预置 App.WidthCustomer.RAW / PRODUCTS / getTeams()，此处追加渲染方法
App.WidthCustomer.shortProds = ['IPC','NVR','门禁','球机','LCD','新业务','通用','网络','存储','智交','移端','停车','报警','服务器','行软'];
App.WidthCustomer.prodMap = { 'IPC':'IPC','NVR':'NVR','门禁':'门禁','球机':'球机','LCD':'LCD与解码','新业务':'新业务','通用':'通用软件','网络':'网络产品','存储':'存储','智交':'智能交通','移端':'移动终端','停车':'出入口停车','报警':'报警','服务器':'服务器','行软':'行业软件' };

App.WidthCustomer.init = function() {
  var teamSel = document.getElementById('wCustTeamFilter');
  if (teamSel) {
    var teams = App.WidthCustomer.getTeams();
    teamSel.innerHTML = '<option value="">全部团队</option>' + teams.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }
  App.WidthCustomer.render();
};

App.WidthCustomer.getFiltered = function() {
  var data = App.WidthCustomer.RAW.slice();
  var teamFilter = (document.getElementById('wCustTeamFilter') || {}).value || '';
  var gsFilter = (document.getElementById('wCustGsFilter') || {}).value || '';
  var search = ((document.getElementById('wCustSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('wCustSort') || {}).value || 'width_desc';

  if (teamFilter) data = data.filter(function(r) { return r.team === teamFilter; });
  if (gsFilter !== '') data = data.filter(function(r) { return String(r.guishang) === gsFilter; });
  if (search) data = data.filter(function(r) { return r.user.toLowerCase().indexOf(search) >= 0 || r.account.toLowerCase().indexOf(search) >= 0; });

  if (sort === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (sort === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });
  else if (sort === 'team') data.sort(function(a,b) { return a.team.localeCompare(b.team) || b.width - a.width; });

  return data;
};

App.WidthCustomer.render = function() {
  var data = App.WidthCustomer.getFiltered();
  var maxW = 10;
  var html = '';

  var countEl = document.getElementById('w-cust-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  data.forEach(function(r) {
    var pct = Math.round(r.width / maxW * 100);
    var barColor = r.guishang ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)';
    var gsBadge = r.guishang
      ? '<span class="badge badge-on">规上</span>'
      : '<span class="badge badge-off" style="cursor:pointer;text-decoration:underline" title="点击查看详情" onclick="App.WidthCustomer.showDetail(\'' + r.user.replace(/'/g,"\\'") + '\')">非规上</span>';

    html += '<tr>';
    html += '<td><strong>' + r.user + '</strong></td>';
    html += '<td>' + r.team + '</td>';
    html += '<td><span style="font-size:11px;color:#64748b">' + r.account + '</span></td>';
    html += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:6px;justify-content:center"><div style="width:60px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:3px"></div></div><span style="font-weight:700;color:#2563eb;min-width:20px">' + r.width + '</span></div></td>';
    html += '<td style="text-align:center">' + gsBadge + '</td>';
    App.WidthCustomer.shortProds.forEach(function(sp) {
      var lp = App.WidthCustomer.prodMap[sp];
      var val = (r.prods[lp] || 0);
      html += '<td style="text-align:center;color:' + (val > 0 ? '#059669' : '#d1d5db') + '">' + (val > 0 ? '✓' : '-') + '</td>';
    });
    html += '</tr>';
  });

  if (data.length === 0) {
    html = '<tr><td colspan="20" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('wCustTable');
  if (tbody) tbody.innerHTML = html;

  // 同步更新售达方关联分析
  App.WidthCustomer.renderAccountLink();
};

// ===== 团队维度 — 团队小组 × 潜力产品 · 本期 vs 同期对照表（乔梦杰版） =====
App.WidthTeamMatrix.render = function() {
  var thead = document.getElementById('w-team-cross-thead');
  var tbody = document.getElementById('w-team-cross-tbody');
  if (!thead || !tbody) return;

  var prods = App.WidthTeamMatrix.PRODUCTS;
  var raw = App.WidthTeamMatrix.RAW;

  // 帮助函数: 短标签
  function shortLabel(str, maxLen) {
    maxLen = maxLen || 7;
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  }

  // 团队聚合
  var teamAgg = {};
  raw.forEach(function(d) {
    if (!teamAgg[d.team]) teamAgg[d.team] = {};
    if (!teamAgg[d.team][d.product]) teamAgg[d.team][d.product] = { amount: 0, amountPrev: 0 };
    teamAgg[d.team][d.product].amount += d.amount;
    teamAgg[d.team][d.product].amountPrev += d.amountPrev;
  });
  var teamList = Object.keys(teamAgg).sort();

  // 表头
  thead.innerHTML = '<tr><th>团队小组 \\ 产品</th>' +
    prods.map(function(p) { return '<th title="' + p + '">' + shortLabel(p, 7) + '</th>'; }).join('') +
    '<th>本期总计</th><th>同期总计</th><th>整体同比</th></tr>';

  // 表体
  var rows = '';
  var grandCur = 0, grandPrev = 0;
  teamList.forEach(function(team) {
    var rowCur = 0, rowPrev = 0;
    var cells = '';
    prods.forEach(function(prod) {
      var v = teamAgg[team][prod] || { amount: 0, amountPrev: 0 };
      rowCur += v.amount; rowPrev += v.amountPrev;
      var cls = 'cell-zero', display = '-', yoyStr = '';
      if (v.amount > 0 && v.amountPrev > 0) {
        var yoy = ((v.amount - v.amountPrev) / v.amountPrev * 100);
        if (yoy >= 0) {
          cls = 'cell-up';
          yoyStr = '<span class="c-yoy c-yoy-up">▲+' + yoy.toFixed(0) + '%</span>';
        } else {
          cls = 'cell-down';
          yoyStr = '<span class="c-yoy c-yoy-down">▼' + yoy.toFixed(0) + '%</span>';
        }
        display = '<strong>' + v.amount.toFixed(1) + '</strong><br>' + yoyStr;
      } else if (v.amount > 0 && v.amountPrev === 0) {
        cls = 'cell-new';
        display = '<strong>' + v.amount.toFixed(1) + '</strong><br><span class="c-yoy c-yoy-new">+新增</span>';
      } else if (v.amount === 0 && v.amountPrev > 0) {
        cls = 'cell-down';
        display = '<strong>0</strong><br><span class="c-yoy c-yoy-down">流失</span>';
      }
      cells += '<td class="' + cls + '">' + display + '</td>';
    });
    grandCur += rowCur; grandPrev += rowPrev;
    var rowYoy = rowPrev > 0 ? ((rowCur - rowPrev) / rowPrev * 100) : (rowCur > 0 ? 100 : 0);
    var rowCls = rowYoy >= 0 ? 'cell-up' : 'cell-down';
    rows += '<tr><td>' + team + '</td>' + cells +
      '<td><strong>' + rowCur.toFixed(1) + '</strong></td>' +
      '<td>' + rowPrev.toFixed(1) + '</td>' +
      '<td class="' + rowCls + '"><strong>' + (rowYoy >= 0 ? '+' : '') + rowYoy.toFixed(1) + '%</strong></td></tr>';
  });

  // 总计行
  var grandYoy = grandPrev > 0 ? ((grandCur - grandPrev) / grandPrev * 100) : (grandCur > 0 ? 100 : 0);
  var gCls = grandYoy >= 0 ? 'cell-up' : 'cell-down';
  rows += '<tr class="total-row"><td><strong>总计</strong></td>' +
    prods.map(function(prod) {
      var v = raw.filter(function(d) { return d.product === prod; }).reduce(function(s, d) { return s + d.amount; }, 0);
      return '<td><strong>' + v.toFixed(1) + '</strong></td>';
    }).join('') +
    '<td><strong>' + grandCur.toFixed(1) + '</strong></td>' +
    '<td><strong>' + grandPrev.toFixed(1) + '</strong></td>' +
    '<td class="' + gCls + '"><strong>' + (grandYoy >= 0 ? '+' : '') + grandYoy.toFixed(1) + '%</strong></td></tr>';

  tbody.innerHTML = rows;
};

// ===== 团队维度 — 大部门 × 产品 差距热图 + 与团队均值的差距分析（乔梦杰版） =====
App.WidthTeamGap.render = function() {
  var prods = App.WidthTeamGap.PRODUCTS;
  var teams = App.WidthTeamGap.TEAMS;

  function shortLabel(str, maxLen) {
    maxLen = maxLen || 6;
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  }

  // 1. 差距热图
  var ht = document.getElementById('w-team-gap-heatmap');
  if (ht) {
    // 计算每列最大值
    var colMax = prods.map(function(_, i) {
      return Math.max.apply(null, teams.map(function(t) { return t.data[i] || 0; }));
    });

    ht.innerHTML = '<tr><th>大部门 \\ 产品</th>' +
      prods.map(function(p) { return '<th title="' + p + '">' + shortLabel(p, 8) + '</th>'; }).join('') +
      '<th>总计</th><th>覆盖数</th></tr>' +
      teams.map(function(team) {
        var cells = prods.map(function(prod, i) {
          var v = team.data[i];
          var max = Math.max(1, colMax[i]);
          var ratio = v / max;
          var cls = 'heat-0';
          if (v > 0) {
            cls = ratio < 0.10 ? 'heat-1' : (ratio < 0.30 ? 'heat-2' : (ratio < 0.60 ? 'heat-3' : (ratio < 0.85 ? 'heat-4' : 'heat-5')));
          }
          return '<td class="' + cls + '" title="' + prod + ': ' + v + ' 客户">' + (v > 0 ? v : '-') + '</td>';
        }).join('');
        var total = team.data.reduce(function(s, v) { return s + v; }, 0);
        var covered = team.data.filter(function(v) { return v > 0; }).length;
        return '<tr><td>' + team.name + '</td>' + cells +
          '<td><strong>' + total + '</strong></td>' +
          '<td>' + covered + '/' + prods.length + '</td></tr>';
      }).join('');
  }

  // 2. 与团队均值的差距分析
  var gt = document.getElementById('w-team-gap-detail');
  if (gt) {
    // 计算每列均值（仅非零团队）
    var avgMap = prods.map(function(prod, i) {
      var nz = teams.map(function(t) { return t.data[i] || 0; }).filter(function(v) { return v > 0; });
      return nz.length ? nz.reduce(function(s, v) { return s + v; }, 0) / nz.length : 0;
    });

    gt.innerHTML = '<tr><th>大部门 \\ 产品</th>' +
      prods.map(function(p) { return '<th title="' + p + '">' + shortLabel(p, 8) + '</th>'; }).join('') + '</tr>' +
      teams.map(function(team) {
        var cells = prods.map(function(prod, i) {
          var v = team.data[i], avg = avgMap[i];
          if (avg === 0 && v === 0) return '<td class="heat-0">-</td>';
          var diff = v - avg;
          var pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : (v > 0 ? '∞' : '0');
          var style = diff > 0 ? 'background:#d1fae5;color:#065f46' : (diff < 0 ? 'background:#fee2e2;color:#991b1b' : 'background:#f3f4f6;color:#6b7280');
          return '<td style="' + style + ';padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-size:11px;font-weight:600">' + (diff >= 0 ? '+' : '') + pct + '%</td>';
        }).join('');
        return '<tr><td>' + team.name + '</td>' + cells + '</tr>';
      }).join('');
  }
};

App.WidthCustomer.showDetail = function(userName) {
  var rec = App.WidthCustomer.RAW.find(function(r) { return r.user === userName; });
  if (!rec) return;
  var products = [];
  Object.keys(rec.prods).forEach(function(p) { if (rec.prods[p]) products.push(p); });
  var allProds = App.WidthCustomer.PRODUCTS;
  var missing = allProds.filter(function(p) { return !rec.prods[p]; });
  var msg = '客户: ' + rec.user + '\n团队: ' + rec.team + '\n账号: ' + rec.account + '\n产品宽度: ' + rec.width + '\n\n已覆盖产品(' + products.length + '):\n  ' + products.join('、') + '\n\n未覆盖产品(' + missing.length + '):\n  ' + missing.slice(0,10).join('、') + (missing.length > 10 ? '...等' + missing.length + '个' : '') + '\n\n提升建议: 建议从' + missing.slice(0,3).join('、') + '等产品入手扩展宽度';
  alert(msg);
};

// 售达方(CRM账号) → 客户关联分析
App.WidthCustomer.renderAccountLink = function() {
  var data = App.WidthCustomer.getFiltered();
  var tbody = document.getElementById('wAcctLinkTable');
  var countEl = document.getElementById('w-acct-link-count');
  if (!tbody) return;

  // 按账号聚合: account → { team, users: [{user,width,guishang,prods}] }
  var acctMap = {};
  data.forEach(function(r) {
    if (!acctMap[r.account]) {
      acctMap[r.account] = { team: r.team, users: [] };
    }
    acctMap[r.account].users.push({ user: r.user, width: r.width, guishang: r.guishang, prods: r.prods });
  });

  // 转为数组并排序: 按总宽度降序
  var accounts = Object.keys(acctMap).map(function(key) {
    var a = acctMap[key];
    var totalW = 0;
    a.users.forEach(function(u) { totalW += u.width; });
    return {
      account: key,
      team: a.team,
      users: a.users,
      custCount: a.users.length,
      totalWidth: totalW,
      avgWidth: parseFloat((totalW / a.users.length).toFixed(2))
    };
  }).sort(function(a, b) { return b.totalWidth - a.totalWidth; });

  if (countEl) countEl.textContent = accounts.length + ' 个售达方 · ' + data.length + ' 个用户';

  if (accounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">无关联数据</td></tr>';
    return;
  }

  var maxW = 0;
  accounts.forEach(function(a) { if (a.totalWidth > maxW) maxW = a.totalWidth; });

  var html = '';
  accounts.forEach(function(a, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var pct = Math.round(a.totalWidth / Math.max(1, maxW) * 100);
    // 客户名称列表（带宽度）
    var custTags = a.users.map(function(u) {
      var gsIcon = u.guishang ? '⭐' : '';
      return '<span style="display:inline-block;background:#f1f5f9;padding:2px 8px;border-radius:4px;margin:1px 2px;font-size:11px;cursor:pointer" title="' + u.user + ' 宽度:' + u.width + (u.guishang ? ' 规上' : '') + '" onclick="App.WidthCustomer.showDetail(\'' + u.user.replace(/'/g,"\\'") + '\')">' + gsIcon + u.user + ' <strong style="color:#2563eb">' + u.width + '</strong></span>';
    }).join('');

    html += '<tr>';
    html += '<td><span class="' + rn + '">' + (i + 1) + '</span></td>';
    // 从 MOCK_USERS 查找真实姓名
    var realName = a.account;
    var found = App.MOCK_USERS.find(function(u) { return u.username === a.account; });
    if (found) realName = found.name;
    html += '<td><strong>' + realName + '</strong><div style="font-size:10px;color:#94a3b8">' + a.account + '</div></td>';
    html += '<td style="text-align:center">' + a.team + '</td>';
    html += '<td style="text-align:center;font-weight:700">' + a.custCount + '</td>';
    html += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:6px;justify-content:center"><div style="width:50px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:3px"></div></div><span style="font-weight:700;color:#7c3aed">' + a.totalWidth + '</span></div></td>';
    html += '<td style="text-align:center;font-weight:600;color:var(--primary)">' + a.avgWidth + '</td>';
    html += '<td style="max-width:400px"><div style="display:flex;flex-wrap:wrap;gap:2px">' + custTags + '</div></td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
};

// ===== 产品宽度 — 用户维度：用户产品覆盖明细 =====
App.WidthUser = {};
App.WidthUser.shortProds = ['IPC','NVR','门禁','球机','LCD','新业务','通用','网络','存储','智交','移端','停车','报警','服务器','行软'];
App.WidthUser.prodMap = { 'IPC':'IPC','NVR':'NVR','门禁':'门禁','球机':'球机','LCD':'LCD与解码','新业务':'新业务','通用':'通用软件','网络':'网络产品','存储':'存储','智交':'智能交通','移端':'移动终端','停车':'出入口停车','报警':'报警','服务器':'服务器','行软':'行业软件' };

App.WidthUser.init = function() {
  var teamSel = document.getElementById('wUserTeamFilter');
  if (teamSel) {
    var teams = App.WidthCustomer.getTeams();
    teamSel.innerHTML = '<option value="">全部团队</option>' + teams.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }
  App.WidthUser.render();
};

App.WidthUser.getFiltered = function() {
  var data = App.WidthCustomer.RAW.slice();
  var teamFilter = (document.getElementById('wUserTeamFilter') || {}).value || '';
  var gsFilter = (document.getElementById('wUserGsFilter') || {}).value || '';
  var search = ((document.getElementById('wUserSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('wUserSort') || {}).value || 'width_desc';

  if (teamFilter) data = data.filter(function(r) { return r.team === teamFilter; });
  if (gsFilter !== '') data = data.filter(function(r) { return String(r.guishang) === gsFilter; });
  if (search) data = data.filter(function(r) { return r.user.toLowerCase().indexOf(search) >= 0 || r.account.toLowerCase().indexOf(search) >= 0; });

  if (sort === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (sort === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });
  else if (sort === 'team') data.sort(function(a,b) { return a.team.localeCompare(b.team) || b.width - a.width; });

  return data;
};

App.WidthUser.render = function() {
  var data = App.WidthUser.getFiltered();
  var maxW = 10;
  var html = '';

  var countEl = document.getElementById('w-user-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  // 账号→姓名映射
  var nameMap = {};
  App.MOCK_USERS.forEach(function(u) { nameMap[u.username] = u.name; });

  data.forEach(function(r) {
    var pct = Math.round(r.width / maxW * 100);
    var barColor = r.guishang ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)';
    var gsBadge = r.guishang
      ? '<span class="badge badge-on">规上</span>'
      : '<span class="badge badge-off" style="cursor:pointer;text-decoration:underline" title="点击查看详情" onclick="App.WidthCustomer.showDetail(\'' + r.user.replace(/'/g,"\\'") + '\')">非规上</span>';
    var realName = nameMap[r.account] || r.account;

    html += '<tr>';
    html += '<td><strong>' + r.user + '</strong></td>';
    html += '<td>' + r.team + '</td>';
    html += '<td><span style="font-size:12px;font-weight:500">' + realName + '</span><div style="font-size:10px;color:#94a3b8">' + r.account + '</div></td>';
    html += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:6px;justify-content:center"><div style="width:60px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:3px"></div></div><span style="font-weight:700;color:#2563eb;min-width:20px">' + r.width + '</span></div></td>';
    html += '<td style="text-align:center">' + gsBadge + '</td>';
    App.WidthUser.shortProds.forEach(function(sp) {
      var lp = App.WidthUser.prodMap[sp];
      var val = (r.prods[lp] || 0);
      html += '<td style="text-align:center;color:' + (val > 0 ? '#059669' : '#d1d5db') + '">' + (val > 0 ? '✓' : '-') + '</td>';
    });
    html += '</tr>';
  });

  if (data.length === 0) {
    html = '<tr><td colspan="20" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('wUserTable');
  if (tbody) tbody.innerHTML = html;
};

// ===== 数据导入与管理 — 数据源切换与渲染 =====
App.ImportData = App.ImportData || {};

App.ImportData.init = function() {
  var teamSel = document.getElementById('wImportTeamFilter');
  if (teamSel) {
    var teams = App.ImportData.getTeams();
    teamSel.innerHTML = '<option value="">全部团队</option>' + teams.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }
  App.ImportData.render();
};

App.switchDataSource = function(ds) {
  App.ImportData.currentDS = ds;
  var tabs = document.querySelectorAll('#wImportTabs .subtab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var activeTab = document.querySelector('#wImportTabs [data-ds="' + ds + '"]');
  if (activeTab) activeTab.classList.add('active');
  var titleEl = document.getElementById('w-import-ds-title');
  if (titleEl) titleEl.textContent = ds === 'user' ? '📋 规上用户-产品线宽度' : '📋 客户产品线覆盖';
  var teamSel = document.getElementById('wImportTeamFilter');
  if (teamSel) {
    var teams = App.ImportData.getTeams();
    teamSel.innerHTML = '<option value="">全部团队</option>' + teams.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }
  App.ImportData.render();
};

App.refreshImportData = function() {
  App.ImportData.render();
};

// Alias for HTML onchange handlers
App.renderImportData = function() {
  App.ImportData.render();
};

App.ImportData.render = function() {
  var isUser = App.ImportData.currentDS === 'user';
  var data = (isUser ? App.ImportData.UserGS : App.ImportData.CustGS).slice();
  var teamFilter = (document.getElementById('wImportTeamFilter') || {}).value || '';
  var search = ((document.getElementById('wImportSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('wImportSort') || {}).value || 'width_desc';

  if (teamFilter) data = data.filter(function(r) { return r.dept === teamFilter; });
  if (search) data = data.filter(function(r) {
    return (r.user || r.name || '').toLowerCase().indexOf(search) >= 0 ||
           (r.sales || '').toLowerCase().indexOf(search) >= 0 ||
           (r.siebel || '').toLowerCase().indexOf(search) >= 0;
  });

  if (sort === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (sort === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });
  else if (sort === 'name') data.sort(function(a,b) { return (a.user||a.name).localeCompare(b.user||b.name); });

  var countEl = document.getElementById('w-import-ds-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  var prods = App.ImportData.PRODS;
  var shortProds = App.ImportData.shortProds;

  // 表头（与导入模版一致）
  var thead = document.getElementById('wImportDataThead');
  if (thead) {
    var headers = '';
    if (isUser) {
      headers += '<th style="min-width:80px">最终用户-行业</th>';
      headers += '<th style="min-width:90px">siebel编码</th>';
      headers += '<th style="min-width:130px">最终用户</th>';
      headers += '<th>销售</th>';
      headers += '<th>销售部门</th>';
      headers += '<th style="text-align:center">是否规上</th>';
      headers += '<th style="text-align:center">产品线合计</th>';
    } else {
      headers += '<th style="min-width:90px">siebel编码</th>';
      headers += '<th style="min-width:150px">售达方描述（客户）</th>';
      headers += '<th>销售</th>';
      headers += '<th>销售部门</th>';
      headers += '<th style="text-align:center">是否规上</th>';
      headers += '<th style="text-align:center">产品线合计</th>';
    }
    shortProds.forEach(function(sp, i) {
      headers += '<th style="text-align:center" title="' + prods[i] + '">' + sp + '</th>';
    });
    if (isUser) {
      headers += '<th>接口人</th>';
      headers += '<th style="text-align:center">用户等级</th>';
    } else {
      headers += '<th>接口人</th>';
      headers += '<th style="text-align:center">客户等级</th>';
    }
    thead.innerHTML = '<tr>' + headers + '</tr>';
  }

  // 表体
  var html = '';
  var maxW = Math.max.apply(null, data.map(function(r) { return r.width; }).concat([1]));

  data.forEach(function(r) {
    var pct = Math.round(r.width / Math.max(1, maxW) * 100);
    html += '<tr>';
    if (isUser) {
      html += '<td>' + (r.industry || '-') + '</td>';
      html += '<td style="font-size:11px">' + (r.siebel || '-') + '</td>';
      html += '<td><strong>' + r.user + '</strong></td>';
    } else {
      html += '<td style="font-size:11px">' + (r.siebel || '-') + '</td>';
      html += '<td><strong>' + r.name + '</strong></td>';
    }
    html += '<td>' + (r.sales || '-') + '</td>';
    html += '<td>' + (r.dept || '-') + '</td>';
    html += '<td style="text-align:center"><span class="badge badge-on">' + (r.guishang || '是') + '</span></td>';
    html += '<td style="text-align:center"><div style="display:flex;align-items:center;gap:4px;justify-content:center"><div style="width:50px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:3px"></div></div><span style="font-weight:700;color:#2563eb;min-width:22px">' + r.width + '</span></div></td>';
    prods.forEach(function(p) {
      var val = (r.prods[p] || 0);
      html += '<td style="text-align:center;color:' + (val > 0 ? '#059669' : '#d1d5db') + '">' + (val > 0 ? '✓' : '-') + '</td>';
    });
    html += '<td>' + (r.contact || '-') + '</td>';
    html += '<td style="text-align:center"><span style="font-size:11px">' + (r.level || '-') + '</span></td>';
    html += '</tr>';
  });

  if (data.length === 0) {
    var totalCols = isUser ? (8 + shortProds.length + 2) : (6 + shortProds.length + 2);
    html = '<tr><td colspan="' + totalCols + '" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('wImportDataTbody');
  if (tbody) tbody.innerHTML = html;
};

// ===== 潜力产品 — 总览分析：经营概述（商机预测版） =====
App.renderPotentialOverview = function() {
  var data = App.Data.getPotential('all');
  if (!data) return;

  // 6 指标卡
  var ov = data.overview;
  var deptRank = data.deptRank;
  var totalAmt = ov ? ov.sales : 9830;
  var totalPrev = ov ? ov.salesPrev : 7650;
  var prodCount = ov ? ov.productCount : 12;
  var custCount = ov ? ov.customerCount : 386;
  var deptCount = ov ? ov.deptCount : 4;
  var avgPrice = ov ? ov.avgPrice : 25.5;
  var yoyPct = totalPrev > 0 ? ((totalAmt - totalPrev) / totalPrev * 100).toFixed(1) : 0;

  // 风险数据
  var hiRisk = 2, mdRisk = 5, loRisk = 5;

  // 部门排名（全部部门）
  var dr = deptRank.slice().sort(function(a, b) { return b.sales - a.sales; });
  var drh = '';
  dr.forEach(function(r, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var yoyCls = r.yoy >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    var yoySign = r.yoy >= 0 ? '+' : '';
    var prevSales = Math.round(r.sales / (1 + r.yoy / 100));
    drh += '<tr>' +
      '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + r.dept + '</strong></td>' +
      '<td style="text-align:right;font-weight:700">' + r.sales.toFixed(0) + '</td>' +
      '<td style="text-align:right;color:#6b7280">' + prevSales + '</td>' +
      '<td style="text-align:center;' + yoyCls + ';font-weight:600">' + yoySign + r.yoy.toFixed(1) + '%</td>' +
      '<td style="text-align:center;font-weight:600;color:#1a56db">' + (62 + (i * 3) % 20).toFixed(1) + '%</td>' +
      '</tr>';
  });
  var rankEl = document.getElementById('pOvDeptRank');
  if (rankEl) rankEl.innerHTML = drh;

};

// 产品风险分布 & 团队概况（p-team）
App.renderTeamRiskPanel = function() {
  var el = document.getElementById('pTeamRiskPanel');
  if (!el) return;
  var data = App.Data.getPotential('all');
  var deptRank = data ? data.deptRank : [];
  var deptCount = deptRank.length || 9;
  var totalTeams = 15;
  var hiRisk = 2, mdRisk = 5, loRisk = 5;

  el.innerHTML =
    '<div class="stat-grid col3" style="margin-bottom:12px">' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">二级部门</div><div style="font-size:22px;font-weight:700;color:#1a56db;margin-top:4px">' + deptCount + '</div><div class="s-sub">个部门</div></div>' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">团队小组</div><div style="font-size:22px;font-weight:700;color:#16a34a;margin-top:4px">' + totalTeams + '</div><div class="s-sub">个小组</div></div>' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">产品风险分布</div><div style="display:flex;gap:8px;margin-top:6px"><span class="badge bg-red">高风险 ' + hiRisk + '</span><span class="badge bg-amber">中风险 ' + mdRisk + '</span><span class="badge bg-green">低风险 ' + loRisk + '</span></div><div class="s-sub">共 ' + (hiRisk + mdRisk + loRisk) + ' 个潜力产品</div></div>' +
    '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>退化产品</th><th style="text-align:center;width:80px">同比跌幅</th><th style="text-align:center;width:80px">风险等级</th><th>主要影响团队</th><th>建议措施</th></tr></thead><tbody>' +
    '<tr><td><strong>门禁</strong></td><td style="text-align:center;color:#dc2626;font-weight:700">-23.5%</td><td style="text-align:center"><span class="badge bg-red">高风险</span></td><td>政府行业组、公安交警行业组</td><td>门禁+NVR联动打包，TOP10客户专项突破</td></tr>' +
    '<tr><td><strong>智能交通</strong></td><td style="text-align:center;color:#dc2626;font-weight:700">-11.2%</td><td style="text-align:center"><span class="badge bg-amber">中风险</span></td><td>智慧建筑组</td><td>与技术中心联动挖掘新场景</td></tr>' +
    '<tr><td><strong>平台软件</strong></td><td style="text-align:center;color:#dc2626">-3.2%</td><td style="text-align:center"><span class="badge bg-amber">中风险</span></td><td>全部门</td><td>平衡价格策略与客户覆盖</td></tr>' +
    '<tr><td><strong>出入口停车</strong></td><td style="text-align:center;color:#ca8a04">-1.5%</td><td style="text-align:center"><span class="badge bg-green">低风险</span></td><td>智慧建筑组</td><td>持续关注，暂不需要干预</td></tr>' +
    '<tr><td><strong>音频产品</strong></td><td style="text-align:center;color:#ca8a04">-0.8%</td><td style="text-align:center"><span class="badge bg-green">低风险</span></td><td>工业企业一组</td><td>维持现有覆盖水平</td></tr>' +
    '</tbody></table></div>';
};
App.renderSellerPotentialRank = function() {
  var tbody = document.getElementById('p-seller-rank-body');
  if (!tbody) return;
  var data = App.Data.getPotential('all');
  if (!data || !data.salesPotentialRank) return;
  var rank = data.salesPotentialRank;
  var allProds = App.ImportPotential.PRODUCTS || ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','出入口停车','音频产品','人员通道','行业软件'];

  function shortLabel(str, maxLen) { maxLen = maxLen || 8; if (!str) return ''; return str.length > maxLen ? str.substring(0, maxLen) + '…' : str; }

  tbody.innerHTML = rank.map(function(s, i) {
    var rnCls = i === 0 ? 'rn rn1' : i === 1 ? 'rn rn2' : i === 2 ? 'rn rn3' : 'rn rn0';
    var yoyNum = parseFloat(s.yoy);
    var yoyBadge = !isNaN(yoyNum) ? (yoyNum > 0 ? 'b-up' : 'b-down') : 'b-new';
    var yoyHtml = '<span class="badge ' + yoyBadge + '">' + s.yoy + '</span>';
    var covered = s.covered || [];
    var uncovered = s.uncovered || [];
    var totalProd = covered.length + uncovered.length;
    var covHtml = covered.map(function(p) { return '<span class="prod-chip covered">' + shortLabel(p, 8) + '</span>'; }).join('');
    var uncovHtml = uncovered.map(function(p) { return '<span class="prod-chip uncovered">' + shortLabel(p, 8) + '</span>'; }).join('');
    return '<tr>' +
      '<td><span class="' + rnCls + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + s.name + '</strong><div style="font-size:10px;color:#9ca3af">' + s.team + '</div></td>' +
      '<td style="text-align:right;font-weight:700">' + s.sales.toFixed(0) + '</td>' +
      '<td style="text-align:right;color:#6b7280">' + s.prev.toFixed(0) + '</td>' +
      '<td style="text-align:center">' + yoyHtml + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary)">' + covered.length + '/' + totalProd + '</td>' +
      '<td style="padding:4px 6px;max-width:400px">' +
        (covered.length ? '<div style="margin-bottom:2px"><span class="pd-label pd-cov">✓ 覆盖<small>(' + covered.length + ')</small></span>' + covHtml + '</div>' : '') +
        (uncovered.length ? '<div><span class="pd-label pd-uncov">✗ 未覆盖<small>(' + uncovered.length + ')</small></span>' + uncovHtml + '</div>' : '') +
      '</td></tr>';
  }).join('');
};

// ===== 潜力产品 — 数据导入与管理 =====
App.ImportPotential = App.ImportPotential || {};

App.ImportPotential.init = function() {
  var deptSel = document.getElementById('pImportDeptFilter');
  if (deptSel) {
    var depts = App.ImportPotential.getDepts();
    deptSel.innerHTML = '<option value="">全部部门</option>' + depts.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
  }
  var prodSel = document.getElementById('pImportProdFilter');
  if (prodSel) {
    var prods = App.ImportPotential.getProducts();
    prodSel.innerHTML = '<option value="">全部产品</option>' + prods.map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
  App.ImportPotential.render();
};

App.ImportPotential.switchDS = function(ds) {
  App.ImportPotential.currentDS = ds;
  var tabs = document.querySelectorAll('#pImportTabs .subtab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var activeTab = document.querySelector('#pImportTabs [data-pds="' + ds + '"]');
  if (activeTab) activeTab.classList.add('active');
  var titleEl = document.getElementById('p-import-ds-title');
  if (titleEl) titleEl.textContent = ds === 'cust' ? '📋 潜力产品-客户' : '📋 潜力产品-用户';
  // 刷新筛选下拉
  var deptSel = document.getElementById('pImportDeptFilter');
  if (deptSel) {
    var depts = App.ImportPotential.getDepts();
    deptSel.innerHTML = '<option value="">全部部门</option>' + depts.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
  }
  var prodSel = document.getElementById('pImportProdFilter');
  if (prodSel) {
    var prods = App.ImportPotential.getProducts();
    prodSel.innerHTML = '<option value="">全部产品</option>' + prods.map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  }
  App.ImportPotential.render();
};

App.ImportPotential.render = function() {
  var isCust = App.ImportPotential.currentDS === 'cust';
  var data = (isCust ? App.ImportPotential.CustRAW : App.ImportPotential.UserRAW).slice();
  var deptFilter = (document.getElementById('pImportDeptFilter') || {}).value || '';
  var prodFilter = (document.getElementById('pImportProdFilter') || {}).value || '';
  var search = ((document.getElementById('pImportSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('pImportSort') || {}).value || 'sales_desc';

  if (deptFilter) data = data.filter(function(r) { return (r.dept4 || r.dept3) === deptFilter; });
  if (prodFilter) data = data.filter(function(r) { return r.product === prodFilter; });
  if (search) data = data.filter(function(r) {
    return (r.custName || r.userName || '').toLowerCase().indexOf(search) >= 0 ||
           (r.sales || '').toLowerCase().indexOf(search) >= 0 ||
           (r.product || '').toLowerCase().indexOf(search) >= 0;
  });

  var sortField = isCust ? 'amount' : 'outAmt';
  if (sort === 'sales_desc') data.sort(function(a,b) { return (b[sortField]||0) - (a[sortField]||0); });
  else if (sort === 'sales_asc') data.sort(function(a,b) { return (a[sortField]||0) - (b[sortField]||0); });
  else if (sort === 'name') data.sort(function(a,b) { return (a.custName||a.userName).localeCompare(b.custName||b.userName); });

  var countEl = document.getElementById('p-import-ds-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  // 表头（与导入模版一致）
  var thead = document.getElementById('pImportDataThead');
  if (thead) {
    var headers = '';
    if (isCust) {
      headers += '<th>二级部门</th><th>三级部门</th><th>四级部门</th><th>五级部门</th>';
      headers += '<th>销售雇员</th><th>潜力产品</th>';
      headers += '<th style="min-width:150px">售达方描述</th>';
      headers += '<th style="min-width:130px">最终用户描述</th>';
      headers += '<th style="text-align:center">销售额(万)</th>';
      headers += '<th style="text-align:center">同期销售额(万)</th>';
      headers += '<th style="text-align:center">同比</th>';
      headers += '<th style="text-align:center">销售数量</th>';
      headers += '<th style="text-align:center">同期销售数量</th>';
      headers += '<th style="text-align:center">销售数量同比</th>';
      headers += '<th style="text-align:center">交易商机数</th>';
      headers += '<th style="text-align:center">交易商机数同期</th>';
      headers += '<th style="text-align:center">交易商机数同比</th>';
      headers += '<th style="text-align:center">交易用户数</th>';
      headers += '<th style="text-align:center">交易用户数-同期</th>';
      headers += '<th style="text-align:center">用户数同比</th>';
      headers += '<th>对接人</th><th style="text-align:center">客户等级</th>';
    } else {
      headers += '<th>业务中心</th><th>三级部门</th><th>四级部门</th>';
      headers += '<th>负责销售</th><th>对接人</th>';
      headers += '<th style="min-width:130px">最终用户描述</th>';
      headers += '<th>行业</th><th>潜力产品</th>';
      headers += '<th style="text-align:center">产品出库额</th>';
      headers += '<th style="text-align:center">产品出库额同期</th>';
      headers += '<th style="text-align:center">产品出库额同比</th>';
      headers += '<th style="text-align:center">出库数量</th>';
      headers += '<th style="text-align:center">出库数量同期</th>';
      headers += '<th style="text-align:center">出库数量同比</th>';
      headers += '<th style="text-align:center">交易商机数</th>';
      headers += '<th style="text-align:center">交易商机数同期</th>';
      headers += '<th style="text-align:center">交易商机数同比</th>';
      headers += '<th style="text-align:center">交易用户数</th>';
      headers += '<th style="text-align:center">交易用户数同期</th>';
      headers += '<th style="text-align:center">交易用户数同比</th>';
      headers += '<th style="text-align:center">交易客户数</th>';
      headers += '<th style="text-align:center">交易客户数同期</th>';
      headers += '<th style="text-align:center">交易客户数同比</th>';
      headers += '<th style="text-align:center">用户等级</th>';
    }
    thead.innerHTML = '<tr>' + headers + '</tr>';
  }

  // 表体
  var html = '';
  data.forEach(function(r) {
    var yoyStr = r.yoy || r.outYoy || '';
    var yoyBadge = '';
    if (yoyStr === '新增') yoyBadge = '<span class="badge b-new">新增</span>';
    else if (yoyStr.indexOf('+') === 0) yoyBadge = '<span class="badge b-up">' + yoyStr + '</span>';
    else if (yoyStr.indexOf('-') === 0) yoyBadge = '<span class="badge b-down">' + yoyStr + '</span>';
    else yoyBadge = yoyStr;

    html += '<tr>';
    if (isCust) {
      html += '<td>' + (r.dept2 || '-') + '</td>';
      html += '<td>' + (r.dept3 || '-') + '</td>';
      html += '<td>' + (r.dept4 || '-') + '</td>';
      html += '<td>' + (r.dept5 || '-') + '</td>';
      html += '<td>' + (r.sales || '-') + '</td>';
      html += '<td><strong>' + (r.product || '-') + '</strong></td>';
      html += '<td>' + (r.custName || '-') + '</td>';
      html += '<td>' + (r.userName || '-') + '</td>';
      html += '<td style="text-align:right;font-weight:700">' + (r.amount || 0) + '</td>';
      html += '<td style="text-align:right;color:#6b7280">' + (r.amountPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + yoyBadge + '</td>';
      html += '<td style="text-align:center">' + (r.qty || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.qtyPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.qtyYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.opps || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.oppsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.oppsYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.users || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.usersPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.usersYoy || '-') + '</td>';
      html += '<td>' + (r.contact || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.level || '-') + '</td>';
    } else {
      html += '<td>' + (r.center || '-') + '</td>';
      html += '<td>' + (r.dept3 || '-') + '</td>';
      html += '<td>' + (r.dept4 || '-') + '</td>';
      html += '<td>' + (r.sales || '-') + '</td>';
      html += '<td>' + (r.contact || '-') + '</td>';
      html += '<td>' + (r.userName || '-') + '</td>';
      html += '<td>' + (r.industry || '-') + '</td>';
      html += '<td><strong>' + (r.product || '-') + '</strong></td>';
      html += '<td style="text-align:right;font-weight:700">' + (r.outAmt || 0) + '</td>';
      html += '<td style="text-align:right;color:#6b7280">' + (r.outAmtPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + yoyBadge + '</td>';
      html += '<td style="text-align:center">' + (r.outQty || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.outQtyPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.outQtyYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.opps || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.oppsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.oppsYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.users || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.usersPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.usersYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.custs || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.custsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + (r.custsYoy || '-') + '</td>';
      html += '<td style="text-align:center">' + (r.level || '-') + '</td>';
    }
    html += '</tr>';
  });

  if (data.length === 0) {
    var totalCols = isCust ? 22 : 24;
    html = '<tr><td colspan="' + totalCols + '" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('pImportDataTbody');
  if (tbody) tbody.innerHTML = html;
};

// ===== 权限设置模态框（商机预测版） =====
App.showPermModal = function() {
  var users = App.MOCK_USERS;
  var roles = App.USER_ROLES;
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  h += '<h3 style="margin:0;font-size:16px">⚙️ 用户权限设置</h3>';
  h += '<button onclick="App.showUserForm()" style="padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500">＋ 新增用户</button>';
  h += '</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  h += '<thead><tr style="border-bottom:2px solid #e2e8f0;text-align:left;color:#64748b;font-size:12px"><th style="padding:8px 6px">用户名</th><th style="padding:8px 6px">姓名</th><th style="padding:8px 6px">角色</th><th style="padding:8px 6px">部门</th><th style="padding:8px 6px">所属组</th><th style="padding:8px 6px;width:200px">操作</th></tr></thead><tbody>';

  users.forEach(function(u) {
    var r = roles[u.role] || {};
    var roleTag = '<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;background:' + (r.color || '#64748b') + '18;color:' + (r.color || '#64748b') + '">' + (r.badge || u.role) + '</span>';
    h += '<tr style="border-bottom:1px solid #f1f5f9">';
    h += '<td style="padding:8px 6px"><strong>' + u.username + '</strong></td>';
    h += '<td style="padding:8px 6px">' + u.name + '</td>';
    h += '<td style="padding:8px 6px">' + roleTag + '</td>';
    h += '<td style="padding:8px 6px;color:#64748b;font-size:12px">' + u.dept + '</td>';
    h += '<td style="padding:8px 6px;color:#64748b;font-size:12px">' + (u.group !== '-' ? u.group : '<span style="color:#cbd5e1">-</span>') + '</td>';
    h += '<td style="padding:8px 6px;white-space:nowrap">';
    h += '<select onchange="App.changeUserRole(' + u.id + ',this.value)" style="padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:11px;margin-right:4px">';
    for (var rk in roles) {
      h += '<option value="' + rk + '"' + (u.role === rk ? ' selected' : '') + '>' + roles[rk].badge + '</option>';
    }
    h += '</select>';
    h += '<button onclick="App.showUserForm(' + u.id + ')" style="padding:3px 7px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#2563eb;margin-right:2px" title="编辑">✎</button>';
    if (u.username !== 'admin') {
      h += '<button onclick="App.deleteUser(' + u.id + ')" style="padding:3px 7px;border:1px solid #fee2e2;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#dc2626" title="删除">✕</button>';
    } else {
      h += '<span style="font-size:10px;color:#94a3b8;margin-left:4px">内置</span>';
    }
    h += '</td></tr>';
  });

  h += '</tbody></table>';
  h += '<div style="margin-top:12px;font-size:11px;color:#94a3b8">共 ' + users.length + ' 个用户 · admin 为内置管理员不可删除</div>';
  h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:right"><button onclick="App.closeModal()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">关闭</button></div>';
  App.showModal(h);
};

// 新增/编辑用户
App.showUserForm = function(id) {
  var isEdit = (typeof id !== 'undefined');
  var u = isEdit ? App.MOCK_USERS.find(function(x) { return x.id === id; }) : null;
  var title = isEdit ? '✎ 编辑用户 — ' + u.name : '＋ 新增用户';
  var roles = App.USER_ROLES;
  var depts = App.DEPT_LIST;

  var h = '<h3 style="margin:0 0 16px;font-size:16px">' + title + '</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">用户名 <span style="color:#dc2626">*</span></label>';
  h += '<input id="ufUsername" value="' + (isEdit ? u.username : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b" placeholder="英文+数字"' + (isEdit ? ' disabled' : '') + '></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">显示姓名 <span style="color:#dc2626">*</span></label>';
  h += '<input id="ufName" value="' + (isEdit ? u.name : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b" placeholder="中文姓名"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">' + (isEdit ? '新密码（留空不修改）' : '登录密码 <span style="color:#dc2626">*</span>') + '</label>';
  h += '<input id="ufPwd" type="password" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b" placeholder="' + (isEdit ? '留空则不修改密码' : '至少6位') + '"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">角色 <span style="color:#dc2626">*</span></label>';
  h += '<select id="ufRole" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;background:#fff;cursor:pointer;color:#1e293b">';
  for (var rk in roles) {
    var r = roles[rk];
    h += '<option value="' + rk + '"' + (isEdit && u.role === rk ? ' selected' : '') + '>' + r.badge + ' · ' + r.perms + '</option>';
  }
  h += '</select></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">所属部门</label>';
  h += '<select id="ufDept" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;background:#fff;cursor:pointer;color:#1e293b">';
  depts.forEach(function(d) { h += '<option value="' + d + '"' + (isEdit && u.dept === d ? ' selected' : '') + '>' + d + '</option>'; });
  h += '</select></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">所属组</label>';
  h += '<input id="ufGroup" value="' + (isEdit && u.group !== '-' ? u.group : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b" placeholder="组名（可选）"></div>';
  h += '</div>';
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">';
  h += '<button onclick="App.showPermModal()" style="padding:7px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px">取消</button>';
  h += '<button onclick="App.saveUser(' + (isEdit ? id : 'null') + ')" style="padding:7px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">' + (isEdit ? '保存修改' : '确认新增') + '</button>';
  h += '</div>';
  App.showModal(h);
};

// 保存用户
App.saveUser = function(id) {
  var isEdit = (typeof id === 'number');
  var username = (document.getElementById('ufUsername') || {}).value || '';
  var name = (document.getElementById('ufName') || {}).value || '';
  var pwd = (document.getElementById('ufPwd') || {}).value || '';
  var role = (document.getElementById('ufRole') || {}).value || 'manager';
  var dept = (document.getElementById('ufDept') || {}).value || App.DEPT_LIST[0];
  var group = (document.getElementById('ufGroup') || {}).value || '-';

  if (!username || !name) { alert('用户名和姓名不能为空'); return; }
  if (!isEdit && !pwd) { alert('新用户必须设置密码'); return; }

  if (isEdit) {
    var u = App.MOCK_USERS.find(function(x) { return x.id === id; });
    if (u) {
      u.name = name;
      if (pwd) { /* 生产环境应更新密码 */ }
      u.role = role;
      u.dept = dept;
      u.group = group;
      u.ld = '-';
    }
  } else {
    if (App.MOCK_USERS.find(function(x) { return x.username === username; })) { alert('用户名已存在'); return; }
    var newId = Math.max.apply(null, App.MOCK_USERS.map(function(x) { return x.id; })) + 1;
    App.MOCK_USERS.push({ id: newId, username: username, name: name, role: role, dept: dept, group: group, ld: '-' });
  }
  // 刷新当前登录信息
  if (App.loggedInUser && isEdit && App.loggedInUser.id === id) {
    var refreshed = App.MOCK_USERS.find(function(x) { return x.id === id; });
    if (refreshed) {
      App.loggedInUser = refreshed;
      sessionStorage.setItem('pa_login', JSON.stringify({ username: refreshed.username, role: refreshed.role, name: refreshed.name }));
      App.applyRoleUI(refreshed.role, refreshed.name, refreshed.dept, refreshed.group);
    }
  }
  App.showPermModal();
};

// 变更用户角色
App.changeUserRole = function(id, newRole) {
  var u = App.MOCK_USERS.find(function(x) { return x.id === id; });
  if (u) { u.role = newRole; }
  App.showPermModal();
};

// 删除用户
App.deleteUser = function(id) {
  var u = App.MOCK_USERS.find(function(x) { return x.id === id; });
  if (!u) return;
  if (u.username === 'admin') { alert('admin 为内置管理员，不可删除'); return; }
  if (!confirm('确定删除用户「' + u.name + '」吗？此操作不可撤销。')) return;
  App.MOCK_USERS = App.MOCK_USERS.filter(function(x) { return x.id !== id; });
  App.showPermModal();
};

// ===== 修改密码模态框 =====
App.showPwdModal = function() {
  if (!App.loggedInUser) return;
  var h = '<h3 style="margin:0 0 16px;font-size:16px">🔑 修改密码</h3>';
  h += '<div style="display:flex;flex-direction:column;gap:12px">';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">当前密码</label>';
  h += '<input id="cpOldPwd" type="password" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">新密码</label>';
  h += '<input id="cpNewPwd" type="password" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b" placeholder="至少6位"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">确认新密码</label>';
  h += '<input id="cpConfirmPwd" type="password" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;color:#1e293b"></div>';
  h += '</div>';
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">';
  h += '<button onclick="App.closeModal()" style="padding:7px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px">取消</button>';
  h += '<button onclick="App.changePwd()" style="padding:7px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">确认修改</button>';
  h += '</div>';
  App.showModal(h);
};

App.changePwd = function() {
  var oldPwd = (document.getElementById('cpOldPwd') || {}).value || '';
  var newPwd = (document.getElementById('cpNewPwd') || {}).value || '';
  var confirmPwd = (document.getElementById('cpConfirmPwd') || {}).value || '';
  if (!oldPwd) { alert('请输入当前密码'); return; }
  if (oldPwd !== 'admin123') { alert('当前密码错误'); return; }
  if (newPwd.length < 6) { alert('新密码至少6位'); return; }
  if (newPwd !== confirmPwd) { alert('两次新密码不一致'); return; }
  alert('✅ 密码修改成功！');
  App.closeModal();
};

// ===== 潜力产品 — 客户维度：客户交易的用户分析 =====
App.renderCustUserLink = function() {
  var tbody = document.getElementById('pCustUserBody');
  if (!tbody) return;
  var raw = App.ImportPotential.CustRAW;
  var search = ((document.getElementById('pCustUserSearch') || {}).value || '').trim().toLowerCase();

  // 按售达方聚合: custName → { users: { userName → { prods: Set, totalAmt } } }
  var custMap = {};
  raw.forEach(function(r) {
    var cust = r.custName || '未知';
    if (!custMap[cust]) custMap[cust] = { users: {}, dept: r.dept4 || r.dept3 || '' };
    if (!custMap[cust].users[r.userName]) custMap[cust].users[r.userName] = { prods: {}, totalAmt: 0 };
    custMap[cust].users[r.userName].prods[r.product] = (custMap[cust].users[r.userName].prods[r.product] || 0) + (r.amount || 0);
    custMap[cust].users[r.userName].totalAmt += (r.amount || 0);
  });

  var custList = Object.keys(custMap).map(function(c) {
    var users = Object.keys(custMap[c].users).map(function(u) {
      var prods = Object.keys(custMap[c].users[u].prods);
      return { name: u, amt: custMap[c].users[u].totalAmt, prods: prods };
    }).sort(function(a, b) { return b.amt - a.amt; });
    var totalAmt = users.reduce(function(s, u) { return s + u.amt; }, 0);
    var allProds = new Set();
    users.forEach(function(u) { u.prods.forEach(function(p) { allProds.add(p); }); });
    return { cust: c, dept: custMap[c].dept, users: users, userCount: users.length, prodCount: allProds.size, totalAmt: totalAmt };
  }).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  if (search) custList = custList.filter(function(c) { return c.cust.toLowerCase().indexOf(search) >= 0; });

  var countEl = document.getElementById('p-cust-user-count');
  if (countEl) countEl.textContent = custList.length + ' 个客户 · ' + custList.reduce(function(s, c) { return s + c.userCount; }, 0) + ' 个用户';

  var html = '';
  custList.forEach(function(c, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var userTags = c.users.map(function(u) {
      var prodTags = u.prods.map(function(p) { return '<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;background:#dbeafe;color:#1e40af;margin:1px">' + p + '</span>'; }).join('');
      return '<div style="padding:3px 6px;margin:2px 0;background:#f8fafc;border-radius:4px;font-size:11px"><strong>' + u.name + '</strong> · ¥' + u.amt.toFixed(0) + '万 <span style="margin-left:4px">' + prodTags + '</span></div>';
    }).join('');
    html += '<tr><td><span class="' + rn + '">' + (i + 1) + '</span></td><td><strong>' + c.cust + '</strong><div style="font-size:10px;color:#94a3b8">' + c.dept + '</div></td><td style="text-align:center;font-weight:700">' + c.userCount + '</td><td style="text-align:center;font-weight:700;color:var(--primary)">' + c.prodCount + '</td><td style="text-align:center;font-weight:700;color:#2563eb">' + c.totalAmt.toFixed(0) + '</td><td style="max-width:500px">' + userTags + '</td></tr>';
  });

  if (custList.length === 0) html = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  tbody.innerHTML = html;
};

// ===== 潜力产品 — 用户维度：用户背后的客户关系 =====
App.renderUserCustLink = function() {
  var tbody = document.getElementById('pUserCustBody');
  if (!tbody) return;
  var raw = App.ImportPotential.UserRAW.length > 0 ? App.ImportPotential.UserRAW : App.ImportPotential.CustRAW;
  var search = ((document.getElementById('pUserCustSearch') || {}).value || '').trim().toLowerCase();

  // 按最终用户聚合: userName → { custs: { custName → { prods: Set, totalAmt } } }
  var userMap = {};
  raw.forEach(function(r) {
    var user = r.userName || '未知';
    var cust = r.custName || r.seller || '未知';
    if (!userMap[user]) userMap[user] = { custs: {}, dept: r.dept4 || r.dept3 || '' };
    if (!userMap[user].custs[cust]) userMap[user].custs[cust] = { prods: {}, totalAmt: 0 };
    var amt = r.outAmt || r.amount || 0;
    userMap[user].custs[cust].prods[r.product] = (userMap[user].custs[cust].prods[r.product] || 0) + amt;
    userMap[user].custs[cust].totalAmt += amt;
  });

  var userList = Object.keys(userMap).map(function(u) {
    var custs = Object.keys(userMap[u].custs).map(function(c) {
      var prods = Object.keys(userMap[u].custs[c].prods);
      return { name: c, amt: userMap[u].custs[c].totalAmt, prods: prods };
    }).sort(function(a, b) { return b.amt - a.amt; });
    var totalAmt = custs.reduce(function(s, c) { return s + c.amt; }, 0);
    var allProds = new Set();
    custs.forEach(function(c) { c.prods.forEach(function(p) { allProds.add(p); }); });
    return { user: u, dept: userMap[u].dept, custs: custs, custCount: custs.length, prodCount: allProds.size, totalAmt: totalAmt };
  }).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  if (search) userList = userList.filter(function(u) { return u.user.toLowerCase().indexOf(search) >= 0; });

  var countEl = document.getElementById('p-user-cust-count');
  if (countEl) countEl.textContent = userList.length + ' 个用户 · ' + userList.reduce(function(s, u) { return s + u.custCount; }, 0) + ' 个客户';

  var html = '';
  userList.forEach(function(u, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var custTags = u.custs.map(function(c) {
      var prodTags = c.prods.map(function(p) { return '<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;background:#dcfce7;color:#166534;margin:1px">' + p + '</span>'; }).join('');
      return '<div style="padding:3px 6px;margin:2px 0;background:#f8fafc;border-radius:4px;font-size:11px"><strong>' + c.name + '</strong> · ¥' + c.amt.toFixed(0) + '万 <span style="margin-left:4px">' + prodTags + '</span></div>';
    }).join('');
    html += '<tr><td><span class="' + rn + '">' + (i + 1) + '</span></td><td><strong>' + u.user + '</strong><div style="font-size:10px;color:#94a3b8">' + u.dept + '</div></td><td style="text-align:center;font-weight:700">' + u.custCount + '</td><td style="text-align:center;font-weight:700;color:var(--primary)">' + u.prodCount + '</td><td style="text-align:center;font-weight:700;color:#2563eb">' + u.totalAmt.toFixed(0) + '</td><td style="max-width:500px">' + custTags + '</td></tr>';
  });

  if (userList.length === 0) html = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  tbody.innerHTML = html;
};

// ===== 角色权限渲染 =====
App.renderRoles = function() {
  var tbody = document.getElementById('aRolesTableBody');
  if (!tbody || !App.ROLE_PERMISSIONS) return;
  var modKeys = ['overview','width','potential','admin','users','roles','products','params','audit','backup','export'];
  var modLabels = { overview:'数据总览', width:'产品宽度', potential:'潜力产品', admin:'账号管理', users:'用户管理', roles:'角色权限', products:'产品字典', params:'业务参数', audit:'审计日志', backup:'数据备份', export:'数据导出' };
  var scopeMap = { admin:'全部数据', gm:'全部数据', operation:'全部数据', director:'本部门', manager:'本小组', sales:'本人' };

  tbody.innerHTML = App.ROLE_PERMISSIONS.map(function(r) {
    var cells = modKeys.map(function(k) {
      var val = r.modules[k];
      if (val === 1) return '<td style="text-align:center"><span style="color:#16a34a;font-size:14px">✓</span></td>';
      if (val === 0) return '<td style="text-align:center"><span style="color:#d1d5db;font-size:14px">-</span></td>';
      return '<td style="text-align:center">-</td>';
    }).join('');
    return '<tr>' +
      '<td><span class="badge" style="background:#dbeafe;color:#1e40af">' + r.role + '</span></td>' +
      '<td><strong>' + r.name + '</strong><div style="font-size:10px;color:#94a3b8">' + r.desc + '</div></td>' +
      cells +
      '<td><span style="font-size:11px;color:#6b7280">' + (scopeMap[r.role] || '-') + '</span></td>' +
      '</tr>';
  }).join('');
};

// ===== 产品字典渲染 =====
App.renderProductDict = function() {
  var tbody = document.getElementById('aProdTableBody');
  if (!tbody || !App.PRODUCT_DICT) return;
  var search = ((document.getElementById('aProdSearch') || {}).value || '').trim().toLowerCase();
  var catFilter = (document.getElementById('aProdCatFilter') || {}).value || '';
  var potFilter = (document.getElementById('aProdPotFilter') || {}).value || '';

  var data = App.PRODUCT_DICT.slice();
  if (search) data = data.filter(function(p) { return p.name.toLowerCase().indexOf(search) >= 0 || (p.alias||'').toLowerCase().indexOf(search) >= 0; });
  if (catFilter) data = data.filter(function(p) { return p.category === catFilter; });
  if (potFilter !== '') data = data.filter(function(p) { return p.is_potential === parseInt(potFilter); });

  var countEl = document.getElementById('aProdCount');
  if (countEl) countEl.textContent = data.length + ' 个产品';

  tbody.innerHTML = data.map(function(p, i) {
    var potBadge = p.is_potential ? '<span class="badge" style="background:#dcfce7;color:#166534">是</span>' : '<span class="badge" style="background:#f3f4f6;color:#6b7280">否</span>';
    return '<tr>' +
      '<td><span class="rn rn0">' + (i + 1) + '</span></td>' +
      '<td><strong>' + p.name + '</strong></td>' +
      '<td>' + (p.alias || '-') + '</td>' +
      '<td><span style="font-size:11px;background:#f1f5f9;padding:2px 8px;border-radius:4px">' + p.category + '</span></td>' +
      '<td style="text-align:center">' + p.sort + '</td>' +
      '<td style="text-align:center">' + potBadge + '</td>' +
      '<td><a style="color:var(--primary);cursor:pointer;font-size:11px;margin-right:6px" onclick="App.showProductForm(' + p.id + ')">编辑</a><a style="color:var(--danger);cursor:pointer;font-size:11px" onclick="App.deleteProduct(' + p.id + ')">删除</a></td>' +
      '</tr>';
  }).join('');
};

App.showProductForm = function(id) {
  var isEdit = typeof id === 'number';
  var p = isEdit ? App.PRODUCT_DICT.find(function(x) { return x.id === id; }) : null;
  var title = isEdit ? '编辑产品 — ' + p.name : '新增产品';
  var h = '<h3 style="margin:0 0 16px;font-size:16px">' + title + '</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">产品名称 <span style="color:#dc2626">*</span></label><input id="pfName" value="' + (isEdit ? p.name : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px" placeholder="如: IPC"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">别名</label><input id="pfAlias" value="' + (isEdit ? (p.alias||'') : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px" placeholder="如: 网络摄像机"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">分类</label><select id="pfCat" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px"><option value="前端">前端</option><option value="后端">后端</option><option value="显示">显示</option><option value="软件">软件</option><option value="网络">网络</option><option value="创新">创新</option></select></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">排序号</label><input id="pfSort" type="number" value="' + (isEdit ? p.sort : '99') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">潜力产品</label><select id="pfPot" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px"><option value="1">是</option><option value="0">否</option></select></div>';
  h += '</div>';
  if (isEdit) {
    h += '<script>setTimeout(function(){document.getElementById("pfCat").value="' + p.category + '";document.getElementById("pfPot").value="' + p.is_potential + '";},50);</script>';
  }
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><button onclick="App.closeModal()" style="padding:7px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px">取消</button><button onclick="App.saveProduct(' + (isEdit ? id : 'null') + ')" style="padding:7px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">' + (isEdit ? '保存' : '新增') + '</button></div>';
  App.showModal(h);
};

App.saveProduct = function(id) {
  var isEdit = typeof id === 'number';
  var name = (document.getElementById('pfName')||{}).value || '';
  var alias = (document.getElementById('pfAlias')||{}).value || '';
  var cat = (document.getElementById('pfCat')||{}).value || '前端';
  var sort = parseInt((document.getElementById('pfSort')||{}).value) || 99;
  var pot = parseInt((document.getElementById('pfPot')||{}).value) || 0;
  if (!name) { alert('产品名称不能为空'); return; }
  if (isEdit) {
    var p = App.PRODUCT_DICT.find(function(x) { return x.id === id; });
    if (p) { p.name = name; p.alias = alias; p.category = cat; p.sort = sort; p.is_potential = pot; }
  } else {
    var newId = Math.max.apply(null, App.PRODUCT_DICT.map(function(x) { return x.id; })) + 1;
    App.PRODUCT_DICT.push({ id: newId, name: name, alias: alias, category: cat, is_potential: pot, sort: sort });
  }
  App.closeModal();
  App.renderProductDict();
};

App.deleteProduct = function(id) {
  var p = App.PRODUCT_DICT.find(function(x) { return x.id === id; });
  if (!p) return;
  if (!confirm('确定删除产品「' + p.name + '」吗？')) return;
  App.PRODUCT_DICT = App.PRODUCT_DICT.filter(function(x) { return x.id !== id; });
  App.renderProductDict();
};

// ===== 业务参数渲染 =====
App.renderBusinessParams = function() {
  var el = document.getElementById('aParamsContainer');
  if (!el || !App.BUSINESS_PARAMS) return;
  var params = App.BUSINESS_PARAMS;
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  Object.keys(params).forEach(function(key) {
    var p = params[key];
    var inputType = typeof p.value === 'number' ? 'number' : 'text';
    html += '<div style="padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<span style="font-weight:600;font-size:13px;color:#1e293b">' + p.label + '</span>';
    html += '<span style="font-size:11px;color:#94a3b8">' + p.unit + '</span>';
    html += '</div>';
    html += '<input type="' + inputType + '" id="bp_' + key + '" value="' + p.value + '" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;color:#1e293b;outline:none">';
    html += '<div style="font-size:11px;color:#94a3b8;margin-top:4px">' + p.desc + '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
};

App.saveBusinessParams = function() {
  if (!App.BUSINESS_PARAMS) return;
  var saved = 0;
  Object.keys(App.BUSINESS_PARAMS).forEach(function(key) {
    var el = document.getElementById('bp_' + key);
    if (el) {
      var val = el.value;
      if (typeof App.BUSINESS_PARAMS[key].value === 'number') val = parseFloat(val) || 0;
      if (val !== App.BUSINESS_PARAMS[key].value) {
        App.BUSINESS_PARAMS[key].value = val;
        saved++;
      }
    }
  });
  alert('✅ 已保存 ' + saved + ' 项参数变更');
  App.renderBusinessParams();
};

// ===== 审计日志渲染 =====
App.renderAuditLog = function() {
  var tbody = document.getElementById('aAuditTableBody');
  if (!tbody || !App.AUDIT_LOGS) return;
  var userFilter = ((document.getElementById('aAuditUser')||{}).value||'').trim().toLowerCase();
  var actionFilter = (document.getElementById('aAuditAction')||{}).value||'';
  var dateStart = (document.getElementById('aAuditDateStart')||{}).value||'';
  var dateEnd = (document.getElementById('aAuditDateEnd')||{}).value||'';

  var data = App.AUDIT_LOGS.slice();
  if (userFilter) data = data.filter(function(l) { return l.user.toLowerCase().indexOf(userFilter) >= 0 || l.name.indexOf(userFilter) >= 0; });
  if (actionFilter) data = data.filter(function(l) { return l.action === actionFilter; });
  if (dateStart) data = data.filter(function(l) { return l.time >= dateStart; });
  if (dateEnd) data = data.filter(function(l) { return l.time <= dateEnd + ' 23:59:59'; });

  var countEl = document.getElementById('aAuditCount');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">无匹配日志记录</td></tr>';
    return;
  }

  var actionColors = {
    '用户登录':'#dbeafe','用户登出':'#f3f4f6','查看页面':'#f3f4f6','数据导出':'#dcfce7',
    '数据导入':'#fef3c7','新增用户':'#dcfce7','修改用户':'#fef3c7','修改密码':'#fee2e2',
    '创建备份':'#dbeafe','恢复备份':'#fef3c7','删除备份':'#fee2e2','系统配置':'#f3f4f6'
  };

  tbody.innerHTML = data.map(function(l) {
    var bg = actionColors[l.action] || '#f3f4f6';
    return '<tr>' +
      '<td style="font-size:11px;white-space:nowrap">' + l.time + '</td>' +
      '<td><strong>' + l.name + '</strong><div style="font-size:10px;color:#94a3b8">' + l.user + '</div></td>' +
      '<td><span class="badge" style="background:' + bg + ';color:#1e293b;font-size:11px">' + l.action + '</span></td>' +
      '<td>' + l.target + '</td>' +
      '<td style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + l.detail + '">' + l.detail + '</td>' +
      '<td style="font-size:10px;color:#94a3b8">' + l.ip + '</td>' +
      '</tr>';
  }).join('');
};

App.exportAuditLog = function() {
  var data = App.AUDIT_LOGS;
  var csv = '﻿"时间","操作用户","操作类型","操作对象","详情","IP"\n' +
    data.map(function(l) { return '"' + [l.time, l.name+'('+l.user+')', l.action, l.target, l.detail, l.ip].join('","') + '"'; }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '审计日志_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ===== 租户设置渲染 =====
App.renderTenantInfo = function() {
  var el = document.getElementById('aTenantInfo');
  if (!el || !App.TENANT_INFO) return;
  var t = App.TENANT_INFO;
  var statusBadge = t.status === 'active' ? '<span class="status-pill status-active">运行中</span>' : '<span class="status-pill status-paused">已停用</span>';
  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">' +
    '<div><span style="color:#94a3b8">租户名称</span><div style="font-weight:600;margin-top:2px">' + t.name + '</div></div>' +
    '<div><span style="color:#94a3b8">租户编码</span><div style="font-weight:600;margin-top:2px">' + t.code + '</div></div>' +
    '<div style="grid-column:1/-1"><span style="color:#94a3b8">全称</span><div style="font-weight:600;margin-top:2px">' + t.fullName + '</div></div>' +
    '<div><span style="color:#94a3b8">行业</span><div style="margin-top:2px">' + t.industry + '</div></div>' +
    '<div><span style="color:#94a3b8">创建时间</span><div style="margin-top:2px">' + t.createdAt + '</div></div>' +
    '<div><span style="color:#94a3b8">管理员</span><div style="margin-top:2px">' + t.admin + '</div></div>' +
    '<div><span style="color:#94a3b8">状态</span><div style="margin-top:2px">' + statusBadge + '</div></div>' +
    '<div style="grid-column:1/-1"><span style="color:#94a3b8">说明</span><div style="margin-top:2px;color:#6b7280">' + t.desc + '</div></div>' +
    '</div>';
};

App.renderTenantOrgs = function() {
  var tbody = document.getElementById('aTenantOrgBody');
  if (!tbody || !App.TENANT_ORGS) return;
  tbody.innerHTML = App.TENANT_ORGS.map(function(o, i) {
    var groupsHtml = o.groups.length > 0
      ? o.groups.map(function(g) { return '<span style="display:inline-block;background:#f1f5f9;padding:2px 8px;border-radius:4px;margin:1px 2px;font-size:11px">' + g + '</span>'; }).join('')
      : '<span style="color:#cbd5e1;font-size:11px">-</span>';
    return '<tr>' +
      '<td><strong>' + o.name + '</strong></td>' +
      '<td>' + o.leader + '</td>' +
      '<td style="text-align:center">' + groupsHtml + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary)">' + o.memberCount + '</td>' +
      '<td style="font-size:11px;color:#6b7280">' + o.desc + '</td>' +
      '</tr>';
  }).join('');
};

// ===== 差距分析维度切换 (修复) =====
var _origRenderGapAnalysis = App.renderGapAnalysis;
App.renderGapAnalysis = function() {
  var dimEl = document.getElementById('gap-dim');
  var dim = dimEl ? dimEl.value : 'dept3';
  var gapData = App.GAP_DATA[dim] || App.GAP_DATA['dept3'];

  // 更新粒度提示
  var labelMap = { dept3: '大部门', dept4: '团队小组', person: '销售人员' };
  var levelEl = document.getElementById('gap-level');
  if (levelEl) levelEl.textContent = '当前粒度: ' + (labelMap[dim] || '大部门');

  // 1. 渲染差距热图
  if (gapData && gapData.prods && gapData.teams) {
    App.renderGapHeatmap('p-gap-heatmap-table-main', gapData);
    App.renderGapDetail('p-gap-detail-table', gapData);
  }

  // 2. 渲染空白产品率 & 待突破率综合对比图
  if (App.charts.pGapCombined && gapData) {
    var teams = gapData.teams;
    var prods = gapData.prods;
    var blankRates = teams.map(function(t) {
      var zeros = t.data.filter(function(v) { return v === 0; }).length;
      return parseFloat((zeros / prods.length * 100).toFixed(1));
    });
    var breakRates = teams.map(function(t) {
      var avg = t.data.reduce(function(s,v){return s+v;},0) / prods.length;
      var lows = t.data.filter(function(v) { return v > 0 && v < avg * 0.3; }).length;
      return parseFloat((lows / prods.length * 100).toFixed(1));
    });
    App.charts.pGapCombined.data.labels = teams.map(function(t) { return t.team; });
    App.charts.pGapCombined.data.datasets[0].data = blankRates;
    App.charts.pGapCombined.data.datasets[1].data = breakRates;
    App.charts.pGapCombined.update();
  }
};

// ===== 数据穿透: 总览KPI卡片点击下钻 =====
App.drillToWidth = function() {
  App.showPage('width');
  var btn = document.querySelector('#page-width .subtab[data-tab="w-overview"]');
  if (btn) btn.click();
};

App.drillToPotential = function() {
  App.showPage('potential');
  var btn = document.querySelector('#page-potential .subtab[data-tab="p-overview"]');
  if (btn) btn.click();
};

App.drillToPotentialCustomer = function() {
  App.showPage('potential');
  var btn = document.querySelector('#page-potential .subtab[data-tab="p-customer"]');
  if (btn) btn.click();
};

App.drillToDeptRank = function() {
  App.showPage('potential');
  var btn = document.querySelector('#page-potential .subtab[data-tab="p-team"]');
  if (btn) btn.click();
};

App.drillToUsers = function() {
  App.showPage('width');
  var btn = document.querySelector('#page-width .subtab[data-tab="w-user"]');
  if (btn) btn.click();
};

App.drillToWidthCustomer = function() {
  App.showPage('width');
  var btn = document.querySelector('#page-width .subtab[data-tab="w-customer"]');
  if (btn) btn.click();
};

// ===== 数据穿透: 宽度分布图点击下钻 =====
App.drillWidthDist = function(bucket) {
  App.showPage('width');
  var btn = document.querySelector('#page-width .subtab[data-tab="w-team"]');
  if (btn) btn.click();
  if (App.WidthDetail) {
    App.WidthDetail.switchDim('person');
  }
};

// ===== 数据穿透: 产品覆盖率排名点击 =====
App.drillProductDetail = function(productName) {
  var btn = document.querySelector('#page-width .subtab[data-tab="w-product"]');
  if (btn) btn.click();
  var tables = document.querySelectorAll('#page-width [data-tab-content="w-product"] table');
  tables.forEach(function(table) {
    var rows = table.querySelectorAll('tbody tr');
    rows.forEach(function(row) {
      var firstCell = row.querySelector('td:nth-child(2)');
      if (firstCell && firstCell.textContent.trim().indexOf(productName) >= 0) {
        row.style.background = '#fef3c7';
        row.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
  });
};

// ===== 集中初始化所有 Admin 子Tab 渲染 =====
App.initAdminTabs = function() {
  App.renderRoles();
  App.renderProductDict();
  App.renderBusinessParams();
  App.renderAuditLog();
  App.renderTenantInfo();
  App.renderTenantOrgs();
};
App.operationLogs = [];

App.addLog = function(action, detail) {
  var now = new Date();
  var t = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
  App.operationLogs.unshift({ t: t, a: action, d: detail });
  if (App.operationLogs.length > 50) App.operationLogs.length = 50;
};

// 自动记录关键操作
(function() {
  var origDoLogin = App.doLogin;
  App.doLogin = function() {
    var userEl = document.getElementById('loginUser');
    var username = userEl ? userEl.value : '';
    origDoLogin.apply(this, arguments);
    if (App.loggedInUser) {
      App.addLog('用户登录', App.loggedInUser.name + '（' + App.USER_ROLES[App.loggedInUser.role].badge + '）登录系统');
    }
  };

  var origDoLogout = App.doLogout;
  App.doLogout = function() {
    if (App.loggedInUser) {
      App.addLog('用户登出', App.loggedInUser.name + ' 退出系统');
    }
    origDoLogout.apply(this, arguments);
  };

  var origShowPage = App.showPage;
  App.showPage = function(p) {
    var pageNames = { overview: '数据总览', width: '产品宽度', potential: '潜力产品', admin: '账号管理' };
    App.addLog('页面切换', '进入「' + (pageNames[p] || p) + '」');
    origShowPage.apply(this, arguments);
  };
})();

// ===== 数据备份与导出辅助函数 =====
App.createBackup = function() {
  App.API.createBackup().then(function(r) {
    alert('备份创建成功!\n文件: ' + r.filename + '\n大小: ' + (r.size_bytes / 1024).toFixed(1) + ' KB');
  }).catch(function(err) {
    alert('备份失败: ' + err.message + '\n请确保后端服务已启动');
  });
};

App.loadBackupList = function() {
  var area = document.getElementById('backupListArea');
  if (!area) return;
  App.API.listBackups().then(function(list) {
    if (list.length === 0) {
      area.innerHTML = '<div style="padding:8px">暂无备份记录</div>';
      return;
    }
    area.innerHTML = '<table style="width:100%;font-size:12px"><thead><tr><th>文件名</th><th>大小</th><th>操作</th></tr></thead><tbody>' +
      list.map(function(b) {
        return '<tr><td>' + b.filename + '</td><td>' + (b.size_bytes / 1024).toFixed(1) + ' KB</td><td>' +
          '<a style="color:var(--primary);cursor:pointer;margin-right:8px" onclick="App.restoreBackup(\'' + b.filename + '\')">恢复</a>' +
          '<a style="color:var(--danger);cursor:pointer" onclick="App.removeBackup(\'' + b.filename + '\')">删除</a></td></tr>';
      }).join('') +
      '</tbody></table>';
  }).catch(function(err) {
    area.innerHTML = '<div style="color:#dc2626;padding:8px">加载失败: ' + err.message + '</div>';
  });
};

App.restoreBackup = function(filename) {
  if (!confirm('确定要从备份 ' + filename + ' 恢复数据？当前数据将被覆盖！')) return;
  App.API.restoreBackup(filename).then(function(r) {
    alert('数据恢复成功！请刷新页面查看。');
    location.reload();
  }).catch(function(err) {
    alert('恢复失败: ' + err.message);
  });
};

App.removeBackup = function(filename) {
  if (!confirm('确定删除备份 ' + filename + '？')) return;
  App.API.deleteBackup(filename).then(function() {
    App.loadBackupList();
  }).catch(function(err) {
    alert('删除失败: ' + err.message);
  });
};

// ===== 总览看板维度快速切换 =====
App._ovDimData = {
  // 产品宽度 — 按部门
  'dept-width': {
    dept:   { labels: ['政府行业组','公安交警行业组','工业企业一组','智慧建筑组'], data: [4.28, 3.76, 3.48, 3.24], colors: ['#3b82f6','#10b981','#f59e0b','#ef4444'] },
    group:  { labels: ['政府1组','政府2组','交警1组','交警2组','教育1组','教育2组','交通1组','交通2组'], data: [4.6, 3.9, 4.1, 3.4, 3.7, 3.2, 3.5, 2.9], colors: ['#3b82f6','#60a5fa','#10b981','#6ee7b7','#f59e0b','#fbbf24','#ef4444','#f87171'] },
    person: { labels: ['张伟','李娜','王强','赵敏','陈刚','刘洋','周明','孙莉'], data: [5.2, 4.8, 3.1, 4.3, 2.7, 3.9, 3.3, 2.4], colors: ['#3b82f6','#60a5fa','#10b981','#6ee7b7','#f59e0b','#fbbf24','#ef4444','#f87171'] }
  },
  // 潜力产品 — 按部门
  'dept-potential': {
    dept:   { labels: ['政府行业组','公安交警行业组','工业企业一组','智慧建筑组'], data: [3850, 2620, 1740, 1320], colors: ['#3b82f6','#10b981','#f59e0b','#ef4444'] },
    group:  { labels: ['政府1组','政府2组','交警1组','交警2组','教育1组','教育2组','交通1组','交通2组'], data: [2150, 1700, 1480, 1140, 980, 760, 720, 600], colors: ['#3b82f6','#60a5fa','#10b981','#6ee7b7','#f59e0b','#fbbf24','#ef4444','#f87171'] },
    person: { labels: ['张伟','李娜','王强','赵敏','陈刚','刘洋','周明','孙莉'], data: [1100, 980, 860, 720, 650, 580, 440, 380], colors: ['#3b82f6','#60a5fa','#10b981','#6ee7b7','#f59e0b','#fbbf24','#ef4444','#f87171'] }
  },
  // 产品宽度历史趋势
  'width-trend': {
    dept:   { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'平均产品宽度', data:[3.2,3.3,3.3,3.4,3.5,3.5,3.6,3.7,3.8,3.8,3.9,3.96], color:'#1a56db', fill:true },{ label:'规上客户平均宽度', data:[5.1,5.2,5.2,5.3,5.3,5.4,5.5,5.6,5.7,5.8,5.9,6.0], color:'#10b981', fill:false },{ label:'非规上客户平均宽度', data:[1.2,1.2,1.3,1.3,1.4,1.4,1.4,1.5,1.5,1.5,1.6,1.6], color:'#f59e0b', fill:false }] },
    group:  { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'政府1组', data:[3.4,3.5,3.5,3.6,3.7,3.7,3.8,3.9,4.0,4.2,4.4,4.6], color:'#3b82f6', fill:false },{ label:'交警1组', data:[3.1,3.2,3.3,3.4,3.4,3.5,3.6,3.7,3.8,3.9,4.0,4.1], color:'#10b981', fill:false },{ label:'教育1组', data:[2.8,2.9,3.0,3.0,3.1,3.2,3.3,3.4,3.5,3.6,3.6,3.7], color:'#f59e0b', fill:false }] },
    person: { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'张伟', data:[3.6,3.7,3.8,3.9,4.1,4.2,4.4,4.5,4.6,4.8,5.0,5.2], color:'#3b82f6', fill:false },{ label:'李娜', data:[3.2,3.3,3.4,3.5,3.6,3.7,3.8,3.9,4.0,4.2,4.5,4.8], color:'#10b981', fill:false },{ label:'王强', data:[2.5,2.6,2.7,2.8,2.8,2.9,2.9,3.0,3.0,3.0,3.1,3.1], color:'#f59e0b', fill:false }] }
  },
  // 潜力产品历史趋势
  'potential-trend': {
    dept:   { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'NVR', data:[1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210], color:'#1a56db' },{ label:'智能计算', data:[0,0,0,0,80,160,280,420,620,890,1450,2180], color:'#10b981' },{ label:'IPC', data:[1800,1850,1900,1950,2000,2100,2200,2250,2300,2350,2400,2450], color:'#f59e0b' }] },
    group:  { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'政府1组-NVR', data:[680,740,800,780,850,920,1000,1080,1200,1350,1600,1850], color:'#3b82f6' },{ label:'交警1组-NVR', data:[350,380,400,390,420,450,480,520,560,620,720,850], color:'#10b981' },{ label:'政府1组-智能计算', data:[0,0,0,0,40,80,150,220,350,500,820,1250], color:'#f59e0b' }] },
    person: { months: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [{ label:'张伟-NVR', data:[420,460,500,490,530,580,630,690,760,860,1050,1200], color:'#3b82f6' },{ label:'李娜-NVR', data:[260,280,300,290,310,330,370,390,430,490,550,650], color:'#10b981' },{ label:'张伟-智能计算', data:[0,0,0,0,30,60,110,170,260,380,620,950], color:'#f59e0b' }] }
  }
};

App.onOvDimChange = function(chartKey, dim) {
  var chart = App.charts['ov_' + chartKey];
  if (!chart) return;
  var dimData = (App._ovDimData[chartKey] || {})[dim];
  if (!dimData) return;

  var isTrend = (chartKey === 'width-trend' || chartKey === 'potential-trend');

  if (isTrend) {
    chart.data.labels = dimData.months;
    chart.data.datasets = dimData.datasets.map(function(ds) {
      return {
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: ds.fill ? (ds.color + '15') : 'transparent',
        tension: .3,
        fill: ds.fill || false,
        pointRadius: 4,
        pointBackgroundColor: ds.color
      };
    });
  } else {
    chart.data.labels = dimData.labels;
    chart.data.datasets[0].data = dimData.data;
    chart.data.datasets[0].backgroundColor = dimData.colors;
  }
  chart.update();
};

// ===== 柱状图 部门/组 切换按钮 =====
App._ovBarDim = 'dept'; // 当前粒度

App.setOvBarDim = function(dim, btn) {
  App._ovBarDim = dim;
  // 切换按钮激活态（两个卡片同步）
  document.querySelectorAll('.dim-btn').forEach(function(b) { b.classList.remove('active'); });
  var card = btn.closest('.card');
  if (card) {
    card.querySelectorAll('.dim-btn[onclick*="' + dim + '"]').forEach(function(b) { b.classList.add('active'); });
  }
  // 同步另一个卡片
  document.querySelectorAll('.dim-btn').forEach(function(b) {
    if (b.onclick && b.onclick.toString().indexOf("'" + dim + "'") !== -1) b.classList.add('active');
  });
  // 刷新两个柱状图
  App._refreshOvBarCharts();
};

// 根据筛选器级联状态更新柱状图（全部 → 部门 → 小组 → 个人）
App._refreshOvBarCharts = function() {
  var state = App.getFilterState('page-overview');
  var team = state.team, group = state.group, person = state.person;
  var labels, widthData;

  if (person !== 'all') {
    labels = [person];
    var p = App.PERSONS.find(function(x) { return x.n === person; });
    widthData = p ? [p.aw || 3.0] : [3.0];
  } else if (group !== 'all') {
    var ppl = App.PERSONS.filter(function(x) { return x.grp === group; });
    labels = ppl.length ? ppl.map(function(x) { return x.n; }) : [group];
    widthData = ppl.length ? ppl.map(function(x) { return x.aw || 3.0; }) : [3.0];
  } else if (team !== 'all') {
    var grps = App.GROUPS.filter(function(g) { return g.dept === team; });
    if (grps.length) {
      labels = grps.map(function(g) { return g.n; });
      widthData = grps.map(function(g) { return g.aw; });
    } else {
      var deptPersons = App.PERSONS.filter(function(p) { return p.dept === team; });
      labels = deptPersons.length ? deptPersons.map(function(p) { return p.n; }) : [team];
      widthData = deptPersons.length ? deptPersons.map(function(p) { return p.aw || 3.0; }) : [3.0];
    }
  } else {
    // 全部部门 → 默认显示部门维度
    labels = App.DEPTS.map(function(d) { return d.n; });
    widthData = App.DEPTS.map(function(d) { return d.aw; });
  }

  var bw = App.charts['ov_dept-width'] || App.charts.ovDeptWidth;
  if (bw) {
    bw.data.labels = labels;
    bw.data.datasets[0].data = widthData;
    bw.data.datasets[0].backgroundColor = '#3b82f6';
    bw.update();
  }

  // 同步更新产品宽度页面的 📐产品宽度 图表（复用同一套数据逻辑）
  if (App.charts.wWidthBar) {
    App.charts.wWidthBar.data.labels = labels;
    App.charts.wWidthBar.data.datasets[0].data = widthData;
    App.charts.wWidthBar.data.datasets[0].backgroundColor = '#3b82f6';
    App.charts.wWidthBar.update();
  }

  var bp = App.charts['ov_dept-potential'] || App.charts.ovDeptPotential;
  if (bp) {
    var scale = 1;
    if (person !== 'all') scale = 0.02;
    else if (group !== 'all') scale = 0.10;
    else if (team !== 'all') scale = 0.28;

    var prodLabels = ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','服务器','行业软件','网络产品','专网摄像机','通用软件','新业务','出入口停车','音频产品'];
    var prodSales = [3210,2180,2450,1420,980,720,680,550,480,420,380,350,320,280,260,210];
    bp.data.labels = prodLabels;
    bp.data.datasets[0].data = prodSales.map(function(v) { return Math.round(v * scale); });
    bp.data.datasets[0].backgroundColor = '#3b82f6';
    bp.update();
  }
};

App.initAll = function() {
  // 初始化所有页面的级联筛选下拉
  App.initPageFilters('page-overview');
  App.initPageFilters('page-width');
  App.initPageFilters('page-potential');
  // 加载数据
  App.updateOverview();
  App.updateWidth();
  App.updatePotential();
  App.renderCompare();
  App.renderGapAnalysis();
  // 初始化客户维度数据明细
  App.WidthCustomer.init();
  // 初始化用户维度数据明细
  App.WidthUser.init();
  // 初始化数据导入与管理
  App.ImportData.init();
  // 初始化潜力产品数据导入
  App.ImportPotential.init();
  // 初始化 Admin 子Tab
  App.initAdminTabs();

  // 记录系统启动
  if (App.operationLogs.length === 0 && App.loggedInUser) {
    App.addLog('系统启动', App.loggedInUser.name + ' 登录后初始化完成，数据源已加载');
  }
};

// ===== 自动登录检查（放在 initAll 定义之后，确保函数已定义） =====
(function() {
  var saved = sessionStorage.getItem('pa_login');
  if (saved) {
    try {
      var data = JSON.parse(saved);
      // 有后端 token：优先用后端数据
      if (data.token) {
        App.API.restoreToken();
        App.loggedInUser = {
          id: data.id, username: data.username, name: data.name, role: data.role,
          dept: data.dept || '-', group: data.group || '-'
        };
        var overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.classList.add('hidden');
        App.applyRoleUI(data.role, data.name, data.dept, data.group);
        App.initAll();
        return;
      }
      // 无 token：用本地 Mock
      var user = App.MOCK_USERS.find(function(u) { return u.username === data.username; });
      if (user) {
        App.loggedInUser = user;
        var overlay2 = document.getElementById('loginOverlay');
        if (overlay2) overlay2.classList.add('hidden');
        App.applyRoleUI(user.role, user.name, user.dept, user.group);
        App.initAll();
        return;
      }
    } catch(e) {}
  }
  // 未登录: 显示登录页
  var overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.remove('hidden');
})();
