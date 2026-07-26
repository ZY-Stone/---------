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

  // 同步顶栏导航按钮 active 状态
  document.querySelectorAll('.topbar-nav-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-page') === p);
  });

  window.scrollTo(0, 0);

  // 切到产品宽度/潜力产品页时刷新数据（解决隐藏容器中图表初始化后尺寸为 0 的问题）
  if (p === 'width') { App.updateWidth(); }
  else if (p === 'potential') { App.updatePotential(); }
  else if (p === 'overview') { App.updateOverview(); }

  // 自动激活当前页面的默认子Tab（模拟点击第一个 active 的 subtab）
  if (page) {
    var defaultTab = page.querySelector('.subtabs-inline .subtab.active');
    if (defaultTab) { defaultTab.click(); }
  }

  // 页面切换后，触发该页面所有图表的 resize
  setTimeout(function() {
    Object.keys(App.charts).forEach(function(key) {
      var chart = App.charts[key];
      if (chart && typeof chart.resize === 'function') {
        try { chart.resize(); } catch(e) {}
      }
    });
  }, 150);
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
      App.WidthDetail.render(); App.renderWidthGapAnalysis();
    }
    if (tabName === 'w-customer') {
      App.WidthCustomer.render();
    }
    if (tabName === 'w-compare') {
      App.initCompare();
    }
    if (tabName === 'w-user') {
      App.updateWidth(); App.WidthUser.render(); App.renderWidthUserTab();
      setTimeout(function() { App.filterLowWidthUser(); }, 150);
    }
    if (tabName === 'w-import') {
      App.ImportData.render();
    }
    if (tabName === 'w-ai') {
      if (App.AI && App.AI.init) App.AI.init();
    }
    if (tabName === 'w-product') {
      App.renderWidthProductTab();
      var cs = (App.Data.getWidth(App.getFilterState('page-width').team) || {}).crossSell;
      if (cs) {
        App.renderCrossSellMatrix(cs);
        App.renderCrossBundles(cs.bundles);
        App.renderCrossRecommend(cs);
      }
    }
    // 潜力产品子Tab
    if (tabName === 'p-product') {
      App.renderPotentialProductCoverage();
      // 图表在隐藏容器创建后需刷新
      setTimeout(function() {
        try { App._updateQuad2Chart(); } catch(e) {}
        try { if (App.charts.potQuad2) App.charts.potQuad2.resize(); } catch(e) {}
      }, 200);
    }
    if (tabName === 'p-team') {
      App.renderPotentialTeamTab();
      try { App.renderSellerPotentialRank(App.getFilterState('page-potential')); } catch(e) {}
    }
    if (tabName === 'p-customer') {
      App.renderPotentialCustTab();
    }
    if (tabName === 'p-user') {
      App.renderPotentialUserTab();
    }
    // 记录子tab操作日志
    App.addLog('切换分析维度', '当前 Tab: ' + tabName);
    if (tabName === 'p-import') {
      App.ImportPotential.render();
    }
    if (tabName === 'p-ai') {
      if (App.PotAI && App.PotAI.init) App.PotAI.init();
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
App.showModal = function(title, bodyHtml, footerHtml) {
  var overlay = document.getElementById('appModal');
  if (!overlay) return;
  var titleEl = document.getElementById('appModalTitle');
  var bodyEl = document.getElementById('appModalBody');
  if (titleEl) titleEl.textContent = title || '详情';
  if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
  // footer 默认保留关闭按钮，可追加额外按钮
  var footerEl = document.querySelector('#appModalBox .modal-footer');
  if (footerEl) {
    footerEl.innerHTML = (footerHtml || '') +
      '<button class="btn-ghost" onclick="App.closeModal()" style="padding:6px 16px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:12px">关闭</button>';
  }
  overlay.style.display = 'flex';
};
App.closeModal = function() {
  var overlay = document.getElementById('appModal');
  if (overlay) overlay.style.display = 'none';
};
// HTML 转义
App.escapeHtml = function(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  else if (pageId === 'page-potential') {
    App.updatePotential();
    // 确保关键图表在筛选变化后立即刷新
    setTimeout(function() {
      try { App._updateCompositionChart(); } catch(e) {}
      try { App._updateYoyChart(); } catch(e) {}
    }, 50);
  }
};

// ===== 初始化页面级联筛选下拉 =====
App.initPageFilters = function(pageId) {
  App.populateDeptDropdown(pageId);
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);
};

// ===== 日期范围选择器 =====
App.toggleDatePicker = function(prefix, ev) {
  ev.stopPropagation();
  var panel = document.getElementById(prefix + '-date-panel');
  if (!panel) return;
  document.querySelectorAll('[id$="-date-panel"]').forEach(function(p) { if (p !== panel) p.style.display = 'none'; });
  if (panel.style.display === 'none') {
    // 固定定位到按钮下方，避免被卡片裁剪
    var btn = ev.currentTarget;
    var rect = btn.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = rect.left + 'px';
    panel.style.top = (rect.bottom + 6) + 'px';
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
};

App.closeDatePicker = function(prefix) {
  var panel = document.getElementById(prefix + '-date-panel');
  if (panel) panel.style.display = 'none';
  if (prefix === 'ov') App.updateOverview();
  else if (prefix === 'w') App.updateWidth();
  else if (prefix === 'p') App.updatePotential();
};

App.onDateChange = function(prefix) {
  var s = (document.getElementById(prefix + '-date-start')||{}).value;
  var e = (document.getElementById(prefix + '-date-end')||{}).value;
  var textEl = document.getElementById(prefix + '-date-text');
  if (textEl) textEl.textContent = (s || '2026-07-01') + ' ~ ' + (e || '2026-07-16');
};

document.addEventListener('click', function(e) {
  if (!e.target.closest('[id$="-date-range"]') && !e.target.closest('[id$="-date-panel"]')) {
    document.querySelectorAll('[id$="-date-panel"]').forEach(function(p) { p.style.display = 'none'; });
  }
});

// ===== 快速日期选择: 单周 / 双周 =====
App.setQuickDatePanel = function(prefix, type) {
  var today = new Date();
  var endStr = today.toISOString().slice(0, 10);
  var startDate = new Date(today);
  if (type === 'week') startDate.setDate(today.getDate() - 7);
  else if (type === 'biweek') startDate.setDate(today.getDate() - 14);
  else if (type === 'month') startDate.setDate(today.getDate() - 30);
  startDate.setDate(startDate.getDate() + 1);
  var startStr = startDate.toISOString().slice(0, 10);
  var s = document.getElementById(prefix + '-date-start');
  var e = document.getElementById(prefix + '-date-end');
  var t = document.getElementById(prefix + '-date-text');
  if (s) s.value = startStr;
  if (e) e.value = endStr;
  if (t) t.textContent = startStr + ' ~ ' + endStr;
  App.closeDatePicker(prefix);
};

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

  var startEl = document.getElementById('ov-date-start');
  var endEl = document.getElementById('ov-date-end');
  var dayFactor = 1;
  if (startEl && endEl && startEl.value && endEl.value) {
    var start = new Date(startEl.value);
    var end = new Date(endEl.value);
    var days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    dayFactor = days / 30;
  }

  var team = state.team;
  var wData = App.Data.getWidth(team);
  var pData = App.Data.getPotential(team);
  var hasWidth = wData && wData.kpi && wData.kpi.customers > 0;
  var hasPot = pData && pData.kpi && pData.overview && pData.overview.sales > 0;
  var widthVal = 0, userWidthVal = 0, custWidthVal = 0, potAmtVal = 0, potRateVal = 0, usersVal = 0, custVal = 0;

  if (hasWidth || hasPot) {
    widthVal = hasWidth ? parseFloat(wData.kpi.avgWidth) || 0 : 0;
    userWidthVal = widthVal;
    custWidthVal = widthVal;
    potAmtVal = hasPot ? (pData.overview.sales || 0) : 0;
    custVal = hasWidth ? wData.kpi.customers : 0;
    usersVal = Math.round(custVal * 0.32);
    potRateVal = custVal > 0 && hasPot ? (pData.overview.customerCount || 0) / custVal * 100 : 0;
  }

  var adjPotAmt = Math.round(potAmtVal * dayFactor);
  var adjUsers  = Math.round(usersVal * dayFactor);
  var adjCust   = Math.round(custVal * dayFactor);

  App.setText('ov-kpi-width',             widthVal.toFixed(2));
  App.setText('ov-kpi-user-width',        userWidthVal.toFixed(2));
  App.setText('ov-kpi-cust-width',        custWidthVal.toFixed(2));
  App.setText('ov-kpi-potential-amt-v',   '\u00a5 ' + adjPotAmt.toLocaleString() + '\u4e07');
  App.setText('ov-kpi-potential-rate',    potRateVal.toFixed(1) + '%');
  App.setText('ov-kpi-users',             adjUsers);
  App.setText('ov-kpi-customers',         adjCust.toLocaleString());
  App.setText('ov-kpi-cust-mom',          '-');
  App.setText('ov-kpi-scale-users',       adjUsers);
  App.setText('ov-kpi-scale-customers',   Math.round(adjCust * 0.71));

  App._refreshOvBarCharts();


  // 更新产品宽度趋势图（跟随筛选联动）
  App._updateOvWidthTrend();

  // 更新潜力产品历史趋势图 — 按筛选维度动态构建数据
  var ptChart = App.charts['ov_potential-trend'];
  if (ptChart) {
    try {
      var pScale = 1;
      if (person !== 'all') pScale = 0.02;
      else if (group !== 'all') pScale = 0.10;
      else if (team !== 'all') pScale = 0.28;
      var prodNames = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
      var prodCurr  = [1100,420,980,600,650,180,450,400,380,480,320];
      var prodPrev  = [880,380,0,520,0,170,360,300,260,320,280];

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

// ===== 总览页产品宽度维度切换：部门 / 组 =====
App._ovWidthDim = 'dept';
App.switchOvWidthDim = function(type) {
  App._ovWidthDim = type;
  document.querySelectorAll('#page-overview [data-ov-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-ov-dim') === type);
  });
  App._refreshOvBarCharts();
};

// ===== 潜力产品销售额排名（跟随页级筛选 + 维度切换） =====
App._potDim = 'dept';
App.switchPotDim = function(type) {
  App._potDim = type;
  document.querySelectorAll('#page-potential [data-p-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-p-dim') === type);
  });
  App.renderPotSalesRank();
};

App.renderPotSalesRank = function() {
  var rankEl = document.getElementById('pOvDeptRank');
  if (!rankEl) return;
  var dim = App._potDim || 'dept';
  var state = App.getFilterState('page-potential');
  var raw = App.WidthTeamMatrix.RAW || [];
  var colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];

  var aggMap = {};
  raw.forEach(function(r) {
    var key = dim === 'dept' ? ((App.GROUPS.find(function(g){return g.n===r.team;})||{}).dept || r.team) :
              dim === 'group' ? r.team : r.team;
    // 页级筛选：部门 → 组 → 个人
    if (state.team !== 'all') {
      var gDept = (App.GROUPS.find(function(g){return g.n===r.team;})||{}).dept;
      if (gDept !== state.team) return;
    }
    if (state.group !== 'all' && r.team !== state.group) return;
    if (state.person !== 'all') {
      var pInfo = App.PERSONS.find(function(p){return p.n===state.person;});
      if (pInfo && r.team !== pInfo.grp) return;
    }
    if (!aggMap[key]) aggMap[key] = { name: key, sales: 0, prev: 0 };
    aggMap[key].sales += r.amount || 0;
    aggMap[key].prev += r.amountPrev || 0;
  });

  // 按 DEPTS / GROUPS 顺序排列
  var rows = [];
  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) { if (aggMap[d.n]) rows.push(aggMap[d.n]); });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) { if (aggMap[g.n]) rows.push(aggMap[g.n]); });
  } else {
    rows = Object.values(aggMap);
  }
  // demo fallback — 跟随筛选
  if (rows.length === 0) {
    var dl, dd;
    if (dim === 'dept') {
      dl = state.team !== 'all' ? [state.team] : App.DEPTS.map(function(d){return d.n;});
      var deptSales = { '客户销售一部':760, '客户销售二部':980, '大客户销售部':1350, '场景数字化销售部':1880, '行业一部':2450, '行业二部':3210 };
      dd = dl.map(function(d){ return deptSales[d] || 500; });
    } else if (dim === 'group') {
      var allGrps = App.GROUPS;
      if (state.team !== 'all') allGrps = allGrps.filter(function(g){ return g.dept === state.team; });
      if (state.group !== 'all') allGrps = allGrps.filter(function(g){ return g.n === state.group; });
      dl = allGrps.map(function(g){ return g.n; });
      dd = dl.map(function(){ return 500 + 0; });
    } else {
      dl = ['陈思源','王志强','潘仲楠','张伟','李梦琪'];
      dd = [1200,980,750,620,480];
    }
    rows = dl.map(function(l,i){ return {name:l, sales:dd[i]||100, prev:Math.round((dd[i]||100)*0.78)}; });
  }

  // 保持与筛选下拉一致的顺序，不重排
  var maxS = Math.max.apply(null, rows.map(function(r){return r.sales;}).concat([1]));
  var html = '';
  rows.forEach(function(r,i){
    var rn = i<3?'rn'+(i+1):'rn0';
    var yoy = r.prev>0?((r.sales-r.prev)/r.prev*100).toFixed(1):0;
    var yoyC = yoy>=0?'color:#16a34a':'color:#dc2626';
    var pct = (r.sales/maxS*100).toFixed(0);
    html += '<tr><td><span class=\"'+rn+'\">'+(i+1)+'</span></td>'+
      '<td><strong>'+r.name+'</strong></td>'+
      '<td style=\"text-align:right;font-weight:700;font-size:13px\">¥'+r.sales.toLocaleString()+'<span style=\"font-size:10px;color:#94a3b8;font-weight:400\">万</span></td>'+
      '<td style=\"text-align:center;'+yoyC+';font-weight:600\">'+(yoy>=0?'+':'')+yoy+'%</td></tr>';
  });
  rankEl.innerHTML = html;
};

// ===== 总览页产品宽度历史趋势 — 跟随筛选联动（总体数据变化） =====
App._updateOvWidthTrend = function() {
  var chart = App.charts['ov_width-trend'];
  if (!chart) return;
  var state = App.getFilterState('page-overview');
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;

  // 基础数据：平均、规上客户、规上用户 三条趋势线
  var baseAvg  = [3.2, 3.3, 3.3, 3.4, 3.5, 3.5, 3.6, 3.7, 3.8, 3.8, 3.9, 3.96];
  var baseCust = [5.1, 5.2, 5.2, 5.3, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0];
  var baseUser = [4.5, 4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6];

  var s = function(arr) { return arr.map(function(v) { return +(v * (sf > 0.5 ? 1 : 0.85 + sf * 0.5)).toFixed(2); }); };

  chart.data.datasets[0].data = s(baseAvg);
  chart.data.datasets[1].data = s(baseCust);
  chart.data.datasets[2].data = s(baseUser);
  chart.update();
};

// ===== 产品宽度页维度切换：部门 / 组 =====
App._wWidthDim = 'dept';
App.switchWidthDim = function(type) {
  App._wWidthDim = type;
  document.querySelectorAll('#page-width [data-w-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-w-dim') === type);
  });
  App._updateDimBarChart('page-width', 'wWidthBar');
};

// ===== 产品覆盖率切换：客户 / 用户 =====
App._covType = 'cust';
App.switchCovType = function(type) {
  App._covType = type;
  var chart = App.charts.wCov;
  if (!chart) return;
  // 切换数据集显隐（强制只显示选中维度）
  chart.setDatasetVisibility(0, type === 'cust');
  chart.setDatasetVisibility(1, type === 'user');
  chart.update();
  // 切换按钮 active 状态
  document.querySelectorAll('#page-width [data-cov]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-cov') === type);
  });
};

// ===== 产品宽度 - 筛选联动 =====
App.updateWidth = function() {
  var state = App.getFilterState('page-width');
  var label = App.getFilterLabel(state);

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
  App.setText('w-user-scale-count',     s(parseInt(kpi.scaleUsers) || 285));
  App.setText('w-kpi-scale-customers', s(parseInt(kpi.scaleUp) || 888));
  App.setText('w-cust-scale-count', s(parseInt(kpi.scaleUp) || 888));
  App.setText('w-kpi-cust-mom',        '+' + s(62));
  App.setText('w-kpi-coverage',        (parseFloat(kpi.coverage) * (sf > 0.5 ? 1 : 0.85 + sf * 0.5)).toFixed(1) + '%');
  App.setText('w-kpi-cov-yoy',         kpi.coverageYoY);

  // 缩放图表数据
  // 销售人员人均宽度区间分布（跟随部门→组级联筛选）
  if (App.charts.wDist) {
    var distPersons;
    if (person !== 'all') {
      distPersons = App.PERSONS.filter(function(p) { return p.n === person; });
    } else if (group !== 'all') {
      distPersons = App.PERSONS.filter(function(p) { return p.grp === group; });
    } else if (team !== 'all') {
      distPersons = App.PERSONS.filter(function(p) { return p.dept === team; });
    } else {
      distPersons = App.PERSONS.slice();
    }
    var distBuckets = [0, 0, 0, 0, 0, 0]; // 0-2, 2-3, 3-4, 4-5, 5-6, 6+
    var bucketPersons = [[], [], [], [], [], []]; // 各区间的销售人员明细
    distPersons.forEach(function(p) {
      var aw = p.aw;
      if (aw < 2) { distBuckets[0]++; bucketPersons[0].push(p); }
      else if (aw < 3) { distBuckets[1]++; bucketPersons[1].push(p); }
      else if (aw < 4) { distBuckets[2]++; bucketPersons[2].push(p); }
      else if (aw < 5) { distBuckets[3]++; bucketPersons[3].push(p); }
      else if (aw < 6) { distBuckets[4]++; bucketPersons[4].push(p); }
      else { distBuckets[5]++; bucketPersons[5].push(p); }
    });
    App.charts.wDist._bucketPersons = bucketPersons;
    App.charts.wDist.data.datasets[0].data = distBuckets.map(function(v) { return s(v); });
    App.charts.wDist.update();
  }
  if (App.charts.wTeam && data.chartTeam) {
    App.charts.wTeam.data.labels = data.chartTeam.labels;
    App.charts.wTeam.data.datasets[0].data = data.chartTeam.data.map(function(v) { return Math.round(v * sf * 10) / 10; });
    App.charts.wTeam.update();
  }
  // 产品覆盖率图表（客户/用户覆盖率切换，跟随筛选联动）
  if (App.charts.wCov && data.chartCov) {
    App.charts.wCov.data.labels = data.chartCov.labels;
    App.charts.wCov.data.datasets[0].data = data.chartCov.data.map(function(v) { return Math.round(v * sf); });
    // 用户覆盖率数据跟随缩放
    if (App.charts.wCov._userData) {
      App.charts.wCov.data.datasets[1].data = App.charts.wCov._userData.map(function(v) { return Math.round(v * sf); });
    }
    // 保持当前选中维度显隐状态
    App.charts.wCov.setDatasetVisibility(0, App._covType === 'cust');
    App.charts.wCov.setDatasetVisibility(1, App._covType === 'user');
    App.charts.wCov.update();
  }
  // 按筛选维度的产品宽度柱状图（复用总览页同款逻辑）
  App._updateDimBarChart('page-width', 'wWidthBar');
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
  // 刷新问题诊断表
  try { App.renderWidthProblemDiag(); } catch(e) {}

  // 刷新产品覆盖热力图（跟随筛选）
  // 刷新产品覆盖热力图（跟随筛选联动）
  if (data.heatmap) {
    var hmScaled = {
      total: s(data.heatmap.total),
      products: data.heatmap.products.map(function(p) {
        return { name: p.name, count: s(p.count), rate: Math.round(p.rate * (sf > 0.5 ? 1 : 0.85 + sf * 0.5)) };
      })
    };
    App.renderHeatmap('w-heatmap', hmScaled);
  }

  // 刷新子Tab数据（如果当前在客户维度/用户维度tab，自动刷新明细表）
  if (App.WidthCustomer && typeof App.WidthCustomer.render === 'function') {
    try { App.WidthCustomer.render(); } catch(e) {}
  }
  if (App.WidthUser && typeof App.WidthUser.render === 'function') {
    try { App.WidthUser.render(); } catch(e) {}
  }
  try { App.renderWidthUserTab(); } catch(e) {}
  // 刷新团队维度明细表（清缓存 + 跟随筛选）
  if (App.WidthDetail && typeof App.WidthDetail.refresh === 'function') {
    try { App.WidthDetail.refresh(); } catch(e) {}
  }
  // 刷新产品维度覆盖率排名表（如果元素存在）
  try { App.renderWidthProductTab(); } catch(e) {}
  // 刷新低宽度客户统计（跟随筛选联动）
  try { App.filterLowWidth(); } catch(e) {}
  try { App.filterLowWidthUser(); } catch(e) {}
};

// ===== 潜力产品 - 筛选联动 =====
App.updatePotential = function() {
  try {
  var state = App.getFilterState('page-potential');
  var label = App.getFilterLabel(state);
  // 更新粒度标签
  var levelEl = document.getElementById('potential-level');
  if (!levelEl) {
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

  // 根据筛选状态获取数据（不再硬编码 'all'）
  var dataTeam = team !== 'all' ? team : 'all';
  var data = App.Data.getPotential(dataTeam);
  if (!data) { console.warn('updatePotential: getPotential 返回空数据'); return; }

  var s = function(v) { return Math.round(v * sf); };

  // ===== 经营概述 (商机预测版) — 传入筛选状态 =====
  try { App.renderPotentialOverview(state); } catch(e) { console.warn('renderPotentialOverview 失败:', e); }

  // ===== 经营概览 KPI (5 卡) — 按筛选缩放 =====
  var ov = data.overview;
  if (ov) {
    try {
      App.setText('p-kpi-sales',        '¥ ' + s(ov.sales).toLocaleString() + '万');
      App.setText('p-kpi-sales-prev',   s(ov.salesPrev).toLocaleString() + '万');
      App.setText('p-kpi-prodcount',    ov.productCount);
      App.setText('p-kpi-custcount',    s(ov.customerCount));
      App.setText('p-kpi-avgprice',     ov.avgPrice.toFixed(1));
      var userCnt = (App.ImportData.UserGS || []).length || (App.WidthCustomer.RAW.filter(function(r){return r.guishang===1;}).length);
      App.setText('p-kpi-usercount',    userCnt);
      App.setText('p-kpi-usercount-prev', Math.round(userCnt * 0.94));
      App.renderPotSalesRank();
    } catch(e) { console.warn('updatePotential KPI 更新失败:', e); }
  }

  // ===== 团队×产品矩阵 — 传入筛选状态 =====
  try { App.WidthTeamMatrix.render(); } catch(e) { console.warn('WidthTeamMatrix 失败:', e); }
  // ===== 团队维度 (凯玲版) =====
  try { App.renderTeamDim(); } catch(e) { console.warn('renderTeamDim 失败:', e); }
  // 差距看板 + 增长结构 跟随筛选联动
  try { App.renderTeamScorecard(state); } catch(e) { console.warn('renderTeamScorecard 失败:', e); }
  try { App.renderGapDeepDive(state); } catch(e) { console.warn('renderGapDeepDive 失败:', e); }

  // ===== 产品维度排名表 — 传入筛选状态 =====
  // ===== 预警概览卡片 =====
  // ===== 产品覆盖率排名 =====
  try { App.renderPotentialProductCoverage(); } catch(e) { console.warn('renderPotentialProductCoverage 失败:', e); }
  // ===== 销售人员潜力产品排名(简版) — 传入筛选状态 =====
  try { App.renderSellerPotentialRank(state); } catch(e) { console.warn('renderSellerPotentialRank 失败:', e); }
  // ===== 客户用户分析 + 用户客户关系 =====
  try { App.renderCustUserLink(state); } catch(e) { console.warn('renderCustUserLink 失败:', e); }
  try { App.renderUserCustLink(state); } catch(e) { console.warn('renderUserCustLink 失败:', e); }

  // ===== 用户维度渲染 =====
  try { App.renderUserDimension(); } catch(e) {}

  // ===== 客户维度卡片跟随筛选联动 =====
  // 自动下钻 dim
  var cdim = App._custDim || 'person';
  if (team !== 'all' && group === 'all' && person === 'all') { cdim = 'dept'; App._custDim = 'dept'; }
  else if (group !== 'all' && person === 'all') { cdim = 'group'; App._custDim = 'group'; }
  else if (person !== 'all') { cdim = 'person'; App._custDim = 'person'; }
  // 同步渲染
  try { App.renderCustTopBottom(); } catch(e) {}

  // 更新 TOP 10 表
  try { App.renderPotentialTop10('p-table-top10', data.top10); } catch(e) { console.warn('renderPotentialTop10 失败:', e); }

  // 动态刷新问题诊断表

  // ===== 更新潜力产品页静态图表（跟随筛选联动） =====
  App._refreshPotentialCharts(state);

  // 初始化产品线选择器
  App.renderProductSelect();

  } catch(e) {
    console.error('updatePotential 整体执行失败:', e);
  }
};

// ===== 潜力产品页静态图表刷新（跟随筛选联动） =====
App._refreshPotentialCharts = function(state) {
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;

  // 1. 历史趋势图 chart-trend
  var trendChart = Chart.getChart('chart-trend');
  if (trendChart && trendChart.data && trendChart.data.datasets && trendChart.data.datasets.length >= 3) {
    var trendMonths = ['08','09','10','11','12','01','02','03','04','05','06','07'];
    trendChart.data.labels = trendMonths;
    trendChart.data.datasets[0].data = [1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210].map(function(v){return Math.round(v*sf);});
    trendChart.data.datasets[1].data = [0,0,0,0,0,0,0,0,0,0,1200,2180].map(function(v){return Math.round(v*sf);});
    trendChart.data.datasets[2].data = [1650,1620,1580,1520,1450,1400,1350,1280,1200,1100,1020,980].map(function(v){return Math.round(v*sf);});
    trendChart.update('none');
  }

  // 2. 销售量构成 chart-p-composition（跟随筛选）
  try { App._updateCompositionChart(); } catch(e) { console.warn('_updateCompositionChart 失败:', e); }

  // 3. 产品销售额趋势 chart-p-yoy（12月折线，缩放跟随筛选+多选）
  try { App._updateYoyChart(); } catch(e) { console.warn('_updateYoyChart 失败:', e); }

  // 4. old_quadrant// 4. 量价四象限 chart-p-quadrant（跟随筛选，参考乔梦杰版）
  var quadChart = Chart.getChart('chart-p-quadrant') || (App.charts && App.charts.potQuadrant);
  if (quadChart) {
    var matrixData = App.WidthTeamMatrix.RAW || [];
    var qAgg = {};
    matrixData.forEach(function(d) {
      if (team !== 'all') {
        var gd = (App.GROUPS.find(function(g){return g.n===d.team;})||{}).dept;
        if (gd !== team) return;
      }
      if (group !== 'all' && d.team !== group) return;
      if (!qAgg[d.product]) qAgg[d.product] = { amount: 0, amountPrev: 0, qty: 0, qtyPrev: 0 };
      qAgg[d.product].amount += d.amount || 0;
      qAgg[d.product].amountPrev += d.amountPrev || 0;
      qAgg[d.product].qty += (d.amount || 0);
      qAgg[d.product].qtyPrev += (d.amountPrev || 0);
    });
    var quadColors = { '量价齐升': '#10b981', '量跌价增': '#f59e0b', '量价齐跌': '#ef4444', '量增价跌': '#8b5cf6' };
    var datasets = { '量价齐升': [], '量跌价增': [], '量价齐跌': [], '量增价跌': [] };
    // 如果有真实数据用真实数据，否则用demo
    var hasData = Object.keys(qAgg).length > 0;
    var products = hasData ? Object.keys(qAgg) : ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
    products.forEach(function(p) {
      var amtYoy, qtyYoy;
      if (hasData) {
        var v = qAgg[p] || { amount: 0, amountPrev: 0 };
        amtYoy = v.amountPrev > 0 ? ((v.amount - v.amountPrev) / v.amountPrev * 100) : (v.amount > 0 ? 100 : 0);
        qtyYoy = amtYoy * (0.5 + 0);
      } else {
        // demo fallback
        var demoVals = { '观澜编码产品（非大模型）':[42,58], '出入口停车':[-3,-2], '前端大模型':[100,100], '网络产品':[-5,-11], '后端大模型(文搜大模型）':[100,100], '人员通道':[3,2], '会议平板与视频会议':[15,22], '国密产品':[-3,19], '执法记录仪':[12,8], '物联安全':[9,5], '音频产品':[6,3] };
        var dv = demoVals[p] || [0-20, 0-20];
        qtyYoy = dv[0]; amtYoy = dv[1];
      }
      var q = amtYoy >= 0 && qtyYoy >= 0 ? '量价齐升' : amtYoy >= 0 && qtyYoy < 0 ? '量跌价增' : amtYoy < 0 && qtyYoy < 0 ? '量价齐跌' : '量增价跌';
      var amt = (qAgg[p] ? qAgg[p].amount : 500);
      datasets[q].push({ x: parseFloat(qtyYoy.toFixed(1)), y: parseFloat(amtYoy.toFixed(1)), prodName: p, amount: amt });
    });
    quadChart.data.datasets = Object.keys(datasets).map(function(k) {
      return { label: k, data: datasets[k], backgroundColor: quadColors[k], borderColor: quadColors[k], pointRadius: datasets[k].map(function(d) { return Math.max(5, Math.sqrt(d.amount || 500) / 8); }), pointHoverRadius: 8 };
    });
    quadChart.update('none');
    var tagEl = document.getElementById('p-quad-tag');
    if (tagEl) {
      var scope = person !== 'all' ? '个人: ' + person : group !== 'all' ? '组: ' + group : team !== 'all' ? '部门: ' + team : '全部部门';
      tagEl.textContent = 'X=数量同比 Y=金额同比 · ' + scope;
    }
  }

  // 5. 二级部门销售排名 chart-p-dept-rank
  var deptRankChart = Chart.getChart('chart-p-dept-rank');
  if (deptRankChart) {
    var deptSales = [3850, 2620, 1740, 1320];
    deptRankChart.data.datasets[0].data = deptSales.map(function(v){return Math.round(v*sf);});
    deptRankChart.update('none');
  }

  // 6. 产品维度四象限散点图 chart-p-quad2
  try { App._updateQuad2Chart(); } catch(e) {}
};

// ===== 产品线 & 组织范围数据引擎 =====
// 11个标准潜力产品
App.ALL_POT_PRODUCTS = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
App.YOY_COLORS = ['#1a56db','#7c3aed','#10b981','#f59e0b','#ef4444','#06b6d4','#3b82f6','#84cc16','#a855f7','#ec4899','#14b8a6'];
// 全量12月基准（11产品 × 12月，单位: 万元）
App.YOY_BASE_DATA = [
  [280,310,340,380,420,480,550,620,710,820,950,1100],  // 观澜编码
  [150,160,170,180,190,210,230,260,290,330,380,420],    // 出入口停车
  [0,0,0,50,80,120,180,260,380,520,720,980],            // 前端大模型（新增品类）
  [180,200,220,240,260,290,320,360,400,450,520,600],    // 网络产品
  [0,0,0,0,30,60,100,160,240,350,480,650],              // 后端大模型（新增品类）
  [60,65,70,75,80,85,95,105,120,140,160,180],           // 人员通道
  [90,100,110,120,130,150,170,200,240,290,360,450],     // 会议平板与视频会议
  [40,50,60,75,90,110,130,160,200,250,320,400],         // 国密产品
  [30,40,50,60,75,90,110,140,180,230,300,380],          // 执法记录仪
  [20,30,40,55,70,90,120,160,210,280,370,480],          // 物联安全
  [100,110,120,130,140,150,170,190,210,240,280,320]     // 音频产品
];

// 各部门对每个产品的销售贡献百分比（6个部门之和 ≈ 100%）
App.DEPT_PRODUCT_SHARE = {
  '管理部':       { '观澜编码产品（非大模型）':0, '出入口停车':0, '前端大模型':0, '网络产品':0, '后端大模型(文搜大模型）':0, '人员通道':0, '会议平板与视频会议':0, '国密产品':0, '执法记录仪':0, '物联安全':0, '音频产品':0 },
  '深圳业务中心': { '观澜编码产品（非大模型）':9, '出入口停车':8, '前端大模型':8, '网络产品':8, '后端大模型(文搜大模型）':8, '人员通道':8, '会议平板与视频会议':8, '国密产品':8, '执法记录仪':8, '物联安全':8, '音频产品':8 },
  '运营部':       { '观澜编码产品（非大模型）':0, '出入口停车':0, '前端大模型':0, '网络产品':0, '后端大模型(文搜大模型）':0, '人员通道':0, '会议平板与视频会议':0, '国密产品':0, '执法记录仪':0, '物联安全':0, '音频产品':0 },
  '行业二部':     { '观澜编码产品（非大模型）':35, '出入口停车':32, '前端大模型':30, '网络产品':28, '后端大模型(文搜大模型）':38, '人员通道':28, '会议平板与视频会议':26, '国密产品':32, '执法记录仪':30, '物联安全':28, '音频产品':22 },
  '行业一部':     { '观澜编码产品（非大模型）':25, '出入口停车':18, '前端大模型':28, '网络产品':24, '后端大模型(文搜大模型）':22, '人员通道':22, '会议平板与视频会议':26, '国密产品':20, '执法记录仪':22, '物联安全':24, '音频产品':20 },
  '客户销售一部': { '观澜编码产品（非大模型）':18, '出入口停车':20, '前端大模型':15, '网络产品':20, '后端大模型(文搜大模型）':14, '人员通道':22, '会议平板与视频会议':22, '国密产品':18, '执法记录仪':18, '物联安全':20, '音频产品':28 },
  '客户销售二部': { '观澜编码产品（非大模型）':12, '出入口停车':15, '前端大模型':13, '网络产品':15, '后端大模型(文搜大模型）':13, '人员通道':14, '会议平板与视频会议':13, '国密产品':15, '执法记录仪':14, '物联安全':13, '音频产品':15 },
  '大客户销售部': { '观澜编码产品（非大模型）': 6, '出入口停车':10, '前端大模型': 9, '网络产品': 9, '后端大模型(文搜大模型）': 8, '人员通道': 9, '会议平板与视频会议': 8, '国密产品':10, '执法记录仪':10, '物联安全': 8, '音频产品':10 },
  '场景数字化销售部': { '观澜编码产品（非大模型）': 4, '出入口停车': 5, '前端大模型': 5, '网络产品': 4, '后端大模型(文搜大模型）': 5, '人员通道': 5, '会议平板与视频会议': 5, '国密产品': 5, '执法记录仪': 6, '物联安全': 7, '音频产品': 5 }
};

// ===== 筛选范围辅助：产品级缩放系数 =====
// 返回某个产品在当前筛选范围下的有效缩放系数（考虑部门产品侧重差异）
App._getProductScale = function(productName, state) {
  var team = state.team, group = state.group, person = state.person;
  // 基础统一缩放
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;
  // 确定实际部门：如果 team 为 all 但 group 不为 all，从 GROUPS 查找所属部门
  var actualDept = team;
  if (actualDept === 'all' && group !== 'all') {
    var gInfo = App.GROUPS.find(function(g) { return g.n === group; });
    if (gInfo) actualDept = gInfo.dept;
  }
  if (actualDept === 'all' && person !== 'all') {
    var pInfo = App.PERSONS.find(function(p) { return p.n === person; });
    if (pInfo) actualDept = pInfo.dept;
  }
  // 全部部门: 无产品侧重差异
  if (actualDept === 'all') return sf;
  // 部门级: 按部门对该产品的贡献份额调整
  var deptShare = (App.DEPT_PRODUCT_SHARE[actualDept] || {})[productName];
  if (!deptShare) return sf;
  var avgShare = 100 / App.DEPTS.length; // ~16.7%
  var deptMult = deptShare / avgShare;
  return sf * deptMult;
};

// 筛选范围内总客户数 / 总用户数（用户数 ≈ 客户数 × 0.32）
App._getScopeTotal = function(state, type) {
  var team = state.team, group = state.group, person = state.person;
  var isUser = type === 'user';
  var totalGlobalCust = 888, totalGlobalUser = 285;
  var totalGlobal = isUser ? totalGlobalUser : totalGlobalCust;
  var ratio = isUser ? (totalGlobalUser / totalGlobalCust) : 1; // ~0.32
  if (person !== 'all') {
    var p = App.PERSONS.find(function(x) { return x.n === person; });
    if (p) return Math.round(p.cw * ratio) || 1;
    return Math.round(totalGlobal * 0.01);
  }
  if (group !== 'all') {
    var g = App.GROUPS.find(function(x) { return x.n === group; });
    if (g) return Math.round(g.cw * ratio) || 1;
    return Math.round(totalGlobal * 0.08);
  }
  if (team !== 'all') {
    var d = App.DEPTS.find(function(x) { return x.n === team; });
    if (d) return Math.round(d.cw * ratio) || 1;
    return Math.round(totalGlobal * 0.28);
  }
  return totalGlobal;
};

// 根据当前筛选范围获取某个产品的12月折线数据（范围外数据归零）
App.getScopedYoyData = function(prodName) {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var prodIdx = App.ALL_POT_PRODUCTS.indexOf(prodName);
  if (prodIdx < 0) return [];
  var base = App.YOY_BASE_DATA[prodIdx];

  if (team === 'all') return base; // 全部部门 → 全量数据

  if (person !== 'all') {
    // 个人级：找到所属组→部门，按部门份额 ÷ 部门内组数 ÷ 组内人数
    var pObj = App.PERSONS.find(function(x) { return x.n === person; });
    if (!pObj || pObj.grp === '-') return base.map(function(v) { return Math.round(v * 0.02); });
    var pDept = pObj.dept, pGrp = pObj.grp;
    var grpsInDept = App.GROUPS.filter(function(g) { return g.dept === pDept; });
    var personsInGrp = App.PERSONS.filter(function(x) { return x.grp === pGrp; });
    var deptShare = (App.DEPT_PRODUCT_SHARE[pDept] || {})[prodName] || 5;
    var personScale = deptShare / 100 / Math.max(1, grpsInDept.length) / Math.max(1, personsInGrp.length);
    return base.map(function(v) { return Math.round(v * personScale); });
  }

  if (group !== 'all') {
    // 组级：部门份额 ÷ 该部门下的组数
    var gObj = App.GROUPS.find(function(g) { return g.n === group; });
    if (!gObj) return base.map(function(v) { return Math.round(v * 0.05); });
    var gDept = gObj.dept;
    var grpsInDept = App.GROUPS.filter(function(g) { return g.dept === gDept; });
    var deptShare = (App.DEPT_PRODUCT_SHARE[gDept] || {})[prodName] || 5;
    var groupScale = deptShare / 100 / Math.max(1, grpsInDept.length);
    return base.map(function(v) { return Math.round(v * groupScale); });
  }

  // 部门级：直接用部门份额
  var deptShare = (App.DEPT_PRODUCT_SHARE[team] || {})[prodName] || 5;
  return base.map(function(v) { return Math.round(v * deptShare / 100); });
};

// 根据当前筛选范围获取某个产品的销售额（用于环形饼图）
App.getScopedCompositionValue = function(prodName) {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var prodIdx = App.ALL_POT_PRODUCTS.indexOf(prodName);
  if (prodIdx < 0) return 0;
  // 全量基准（最后一个月作为当期快照）
  var totalBase = App.YOY_BASE_DATA[prodIdx][11];

  if (team === 'all') return totalBase;

  if (person !== 'all') {
    var pObj = App.PERSONS.find(function(x) { return x.n === person; });
    if (!pObj || pObj.grp === '-') return Math.round(totalBase * 0.02);
    var pDept = pObj.dept, pGrp = pObj.grp;
    var grpsInDept = App.GROUPS.filter(function(g) { return g.dept === pDept; });
    var personsInGrp = App.PERSONS.filter(function(x) { return x.grp === pGrp; });
    var dShare = (App.DEPT_PRODUCT_SHARE[pDept] || {})[prodName] || 5;
    return Math.round(totalBase * dShare / 100 / Math.max(1, grpsInDept.length) / Math.max(1, personsInGrp.length));
  }

  if (group !== 'all') {
    var gObj = App.GROUPS.find(function(g) { return g.n === group; });
    if (!gObj) return Math.round(totalBase * 0.05);
    var gDept = gObj.dept;
    var grpsInDept = App.GROUPS.filter(function(g) { return g.dept === gDept; });
    var dShare = (App.DEPT_PRODUCT_SHARE[gDept] || {})[prodName] || 5;
    return Math.round(totalBase * dShare / 100 / Math.max(1, grpsInDept.length));
  }

  var dShare = (App.DEPT_PRODUCT_SHARE[team] || {})[prodName] || 5;
  return Math.round(totalBase * dShare / 100);
};

// 独立的产品YOY图表更新函数
App._updateYoyChart = function() {
  var yoyChart = Chart.getChart('chart-p-yoy');
  if (!yoyChart) return;

  var state = App.getFilterState('page-potential');
  var sel = App._selectedProds || ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）'];
  var selIdx = sel.map(function(p) { return App.ALL_POT_PRODUCTS.indexOf(p); }).filter(function(i) { return i >= 0; });
  if (selIdx.length === 0) selIdx = [0];

  yoyChart.data.datasets = selIdx.map(function(i) {
    return {
      label: App.ALL_POT_PRODUCTS[i],
      data: App.getScopedYoyData(App.ALL_POT_PRODUCTS[i]),
      borderColor: App.YOY_COLORS[i],
      tension: 0.3, fill: false, pointRadius: 3
    };
  });
  yoyChart.update();
  try { yoyChart.resize(); } catch(e) {}

  var tagEl = document.getElementById('p-yoy-tag');
  if (tagEl) {
    var scope = state.person !== 'all' ? '个人: ' + state.person : state.group !== 'all' ? '组: ' + state.group : state.team !== 'all' ? '部门: ' + state.team : '全部部门';
    tagEl.textContent = '近12月 · ' + scope;
  }
};

App.renderProductSelect = function() {
  var container = document.getElementById('p-product-select');
  if (!container) return;
  if (!App._selectedProds || App._selectedProds.length === 0) {
    App._selectedProds = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）'];
  }
  container.innerHTML = App.ALL_POT_PRODUCTS.map(function(p) {
    var checked = App._selectedProds.indexOf(p) >= 0 ? ' checked' : '';
    return '<label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;padding:2px 8px;border:1px solid #d1d5db;border-radius:12px;background:#fff;user-select:none;white-space:nowrap">'
      + '<input type="checkbox" value="' + p + '"' + checked + ' onchange="App.onProductSelectChange()" style="margin:0;cursor:pointer"> '
      + p + '</label>';
  }).join('');
};

App.onProductSelectChange = function() {
  var container = document.getElementById('p-product-select');
  if (!container) return;
  var checks = container.querySelectorAll('input[type="checkbox"]');
  App._selectedProds = [];
  checks.forEach(function(cb) { if (cb.checked) App._selectedProds.push(cb.value); });
  if (App._selectedProds.length === 0) {
    App._selectedProds = [App.ALL_POT_PRODUCTS[0]];
    App.renderProductSelect();
  }
  App._updateYoyChart();
};

App.toggleProductSelect = function() {
  var container = document.getElementById('p-product-select');
  if (!container) return;
  var isHidden = container.style.display === 'none';
  if (isHidden) {
    App.renderProductSelect();
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
};

// ===== 销售量构成 (chart-p-composition) 独立更新函数（跟随筛选联动） =====
App._updateCompositionChart = function() {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;

  // 1. 无论图表是否存在，先更新右上角标签
  var tagEl = document.getElementById('p-comp-tag');
  if (tagEl) {
    var scope = person !== 'all' ? '个人: ' + person : group !== 'all' ? '组: ' + group : team !== 'all' ? '部门: ' + team : '全部部门';
    tagEl.textContent = '销售额 · ' + scope;
  }

  // 2. 更新图表数据（优先 Chart.getChart，兜底从 App.charts 取）
  var compChart = Chart.getChart('chart-p-composition') || (App.charts && App.charts.potComposition);
  if (!compChart) return;
  var cLabels = compChart.data.labels;
  var cData = cLabels.map(function(p) { return App.getScopedCompositionValue(p); });
  compChart.data.datasets[0].data = cData;
  compChart.update();
  try { compChart.resize(); } catch(e) {}
};

// ===== 团队×潜力产品矩阵 (经营概览) =====
App.renderTeamProdMatrix = function(tbodyId, rows, state) {
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
App.renderSalesPotentialRank = function(tbodyId, list, state) {
  var el = document.getElementById(tbodyId);
  if (!el || !list) return;
  // 根据页级筛选过滤
  state = state || { team: 'all', group: 'all', person: 'all' };
  var filteredList = list;
  if (state.team !== 'all') {
    filteredList = list.filter(function(s) { return s.team === state.team || s.team.indexOf(state.team) >= 0; });
  }
  if (state.group !== 'all') {
    filteredList = filteredList.filter(function(s) { return s.team === state.group; });
  }
  if (state.person !== 'all') {
    filteredList = filteredList.filter(function(s) { return s.name === state.person; });
  }
  el.innerHTML = filteredList.map(function(s) {
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
App.showWidthDrill = function(bucket, idx) {
  var chart = App.charts.wDist;
  var persons = chart && chart._bucketPersons ? (chart._bucketPersons[idx] || []) : [];
  persons.sort(function(a, b) { return b.aw - a.aw; });

  var html = '<div style="padding:4px 0">' +
    '<h3 style="margin:0 0 4px 0;font-size:16px">人均产品宽度 ' + bucket + '</h3>' +
    '<p style="margin:0 0 16px 0;color:#6b7280;font-size:13px">共 <strong>' + persons.length + '</strong> 人</p>';

  if (persons.length === 0) {
    html += '<p style="text-align:center;padding:32px;color:#9ca3af">该区间暂无销售人员</p>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="border-bottom:2px solid #e5e7eb">' +
      '<th style="text-align:left;padding:8px">#</th>' +
      '<th style="text-align:left;padding:8px">姓名</th>' +
      '<th style="text-align:left;padding:8px">所属部门</th>' +
      '<th style="text-align:left;padding:8px">所属小组</th>' +
      '<th style="text-align:center;padding:8px">人均宽度</th>' +
      '<th style="text-align:center;padding:8px">客户数</th>' +
      '<th style="text-align:center;padding:8px">覆盖率</th>' +
      '</tr></thead><tbody>';
    persons.forEach(function(p, i) {
      html += '<tr style="border-bottom:1px solid #f3f4f6">' +
        '<td style="padding:6px 8px;color:#9ca3af">' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-weight:600">' + p.n + '</td>' +
        '<td style="padding:6px 8px;color:#6b7280">' + (p.dept || '-') + '</td>' +
        '<td style="padding:6px 8px;color:#6b7280">' + (p.grp || '-') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:700;color:#1a56db">' + p.aw.toFixed(2) + '</td>' +
        '<td style="padding:6px 8px;text-align:center">' + (p.cw || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#059669">' + (p.cov || 0).toFixed(1) + '%</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  App.showModal(html);
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

// ===== 真实数据导入 (SheetJS) — 委托给 ImportData 模块 =====
App.handleFileImport = function(input) {
  App.ImportData.handleUpload(input);
};

// ===== 潜力产品 — 与团队均值的差距分析 =====
App.renderPotentialGapDetail = function(state) {
  var gt = document.getElementById('p-team-gap-detail');
  if (!gt) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var dataTeam = state.team !== 'all' ? state.team : 'all';
  var data = App.Data.getPotential(dataTeam);
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
      var avg = avgMap[i] || 0;
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

// ===== 潜力产品排名表（升级版：单价/客户数/依赖度 + 阈值高亮 + 排序 + 悬停归因） =====
; // 默认销售额降序

App._genProductRankExtras = function(prodName, i) {
  // 为每个产品生成扩展字段的 demo 数据
  var extras = {
    '观澜编码产品（非大模型）': { avgPrice: 3.5, priceYoY: +5.2, custCount: 142, newCust: 18, lostCust: 3, top3Ratio: 42, top3Names: '客户A(18%),客户B(14%),客户C(10%)' },
    '出入口停车': { avgPrice: 3.8, priceYoY: +6.0, custCount: 28, newCust: 12, lostCust: 1, top3Ratio: 65, top3Names: '客户D(28%),客户E(22%),客户F(15%)' },
    '前端大模型': { avgPrice: 6.5, priceYoY: +22.0, custCount: 45,  newCust: 28, lostCust: 0, top3Ratio: 68, top3Names: '客户G(32%),客户H(22%),客户I(14%)' },
    '网络产品': { avgPrice: 1.5, priceYoY: -5.0, custCount: 68,  newCust: 6,  lostCust: 4, top3Ratio: 38, top3Names: '客户J(15%),客户K(13%),客户L(10%)' },
    '后端大模型(文搜大模型）': { avgPrice: 7.2, priceYoY: +35.0, custCount: 22, newCust: 15, lostCust: 0, top3Ratio: 80, top3Names: '客户M(40%),客户N(25%),客户O(15%)' },
    '人员通道': { avgPrice: 1.2, priceYoY: +1.0, custCount: 22,  newCust: 4,  lostCust: 3, top3Ratio: 50, top3Names: '客户P(22%),客户Q(16%),客户R(12%)' },
    '会议平板与视频会议': { avgPrice: 2.8, priceYoY: +18.7, custCount: 78,  newCust: 8,  lostCust: 5, top3Ratio: 52, top3Names: '客户S(22%),客户T(18%),客户U(12%)' },
    '国密产品': { avgPrice: 4.5, priceYoY: +10.0, custCount: 35,  newCust: 6,  lostCust: 2, top3Ratio: 55, top3Names: '客户V(30%),客户W(15%),客户X(10%)' },
    '执法记录仪': { avgPrice: 2.1, priceYoY: +8.5, custCount: 55,  newCust: 5,  lostCust: 6, top3Ratio: 48, top3Names: '客户Y(20%),客户Z(16%),客户A(12%)' },
    '物联安全': { avgPrice: 3.0, priceYoY: +15.0, custCount: 40,  newCust: 10, lostCust: 2, top3Ratio: 45, top3Names: '客户B(22%),客户C(13%),客户D(10%)' },
    '音频产品': { avgPrice: 0.6, priceYoY: -8.0, custCount: 34,  newCust: 3,  lostCust: 8, top3Ratio: 55, top3Names: '客户E(25%),客户F(18%),客户G(12%)' }
  };
  var e = extras[prodName] || { avgPrice: 0, priceYoY: 0, custCount: 30+0, newCust: 0, lostCust: 0, top3Ratio: 40+0, top3Names: '多个客户' };
  // 筛选缩放 — 使用产品级缩放系数
  var state = App.getFilterState('page-potential');
  var ps = App._getProductScale(prodName, state);
  e.custCount = Math.max(1, Math.round(e.custCount * ps));
  e.newCust = Math.max(0, Math.round(e.newCust * ps));
  e.lostCust = Math.max(0, Math.round(e.lostCust * ps));
  return e;
};

// 分类标签 → 归因说明
App._typeAttribution = function(type, amtYoY, qtyYoY) {
  if (type === '量价齐升') return '量+价双增：市场需求旺盛，量价齐驱';
  if (type === '量跌价增') return '价增覆盖量降：单价提升弥补了出货减少（' + (qtyYoY >= 0 ? '+' : '') + qtyYoY.toFixed(1) + '%），需关注量能否稳住';
  if (type === '量价齐跌') return '量+价双降：市场萎缩或竞争加剧，出货与单价同时下滑（量' + (qtyYoY >= 0 ? '+' : '') + qtyYoY.toFixed(1) + '%·价' + (amtYoY >= 0 ? '+' : '') + amtYoY.toFixed(1) + '%）';
  if (type === '新增') return '全新品类：去年同期无销售，本年度从0到1突破';
  if (type === '量增价跌') return '量增价跌：以价换量策略，需评估利润空间是否可持续';
  return '';
};

// 阈值颜色规则
App._thresholdColor = function(val, suffix) {
  if (suffix === 'yoy' || suffix === 'pct') {
    if (val > 30) return 'color:#059669;font-weight:700';
    if (val < -10) return 'color:#dc2626;font-weight:700';
    if (val < -5) return 'color:#f59e0b';
  }
  if (suffix === 'ratio') {
    if (val > 60) return 'color:#dc2626;font-weight:700;background:#fef2f2;padding:1px 6px;border-radius:3px';
  }
  return '';
};




// ===== 产品维度四象限散点图更新 =====
App._updateQuad2Chart = function() {
  var chart = App.charts.potQuad2;
  if (!chart) return;
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;

  // 全量基准: 覆盖率% + 金额同比% + 销售额 + 已覆盖客户数
  var prods = [
    { name:'观澜编码产品（非大模型）', cov:36.7, covered:326, amtYoY:58.3,  amount:1100 },
    { name:'出入口停车', cov:7.4,  covered:66,  amtYoY:15.2,  amount:420  },
    { name:'前端大模型', cov:7.9,  covered:70,  amtYoY:100,   amount:980  },
    { name:'网络产品', cov:14.6,  covered:130, amtYoY:-5.0,  amount:600  },
    { name:'后端大模型(文搜大模型）', cov:5.2, covered:46, amtYoY:100, amount:650 },
    { name:'人员通道', cov:6.4,  covered:57,  amtYoY:6.0,   amount:180  },
    { name:'会议平板与视频会议', cov:17.6, covered:156, amtYoY:22.4, amount:450 },
    { name:'国密产品', cov:11.5,  covered:102, amtYoY:8.4,   amount:400  },
    { name:'执法记录仪', cov:8.5, covered:76,  amtYoY:18.7,  amount:380  },
    { name:'物联安全', cov:5.9,  covered:52,  amtYoY:5.2,   amount:480  },
    { name:'音频产品', cov:9.4,  covered:84,  amtYoY:-3.5,  amount:320  }
  ];

  var scopeTotal = App._getScopeTotal(state, 'cust');

  var quadData = { '成熟核心':[], '蓝海潜力':[], '增长见顶':[], '弱势品类':[] };
  prods.forEach(function(p) {
    var ps = App._getProductScale(p.name, state);
    var coveredScaled = Math.round(p.covered ? p.covered * ps : p.amount * ps / 10);
    var covCalc = scopeTotal > 0 ? Math.round(coveredScaled / scopeTotal * 100) : Math.round(p.cov * ps);
    covCalc = Math.min(100, Math.max(1, covCalc));
    var yoy = p.amtYoY;
    var pt = { x: covCalc, y: yoy, prodName: p.name, amount: Math.round(p.amount * ps) };
    if (covCalc >= 12 && yoy >= 10) quadData['成熟核心'].push(pt);
    else if (covCalc < 12 && yoy >= 10) quadData['蓝海潜力'].push(pt);
    else if (covCalc >= 12 && yoy < 10) quadData['增长见顶'].push(pt);
    else quadData['弱势品类'].push(pt);
  });

  var keys = ['成熟核心','蓝海潜力','增长见顶','弱势品类'];
  keys.forEach(function(k, ki) {
    chart.data.datasets[ki].data = quadData[k];
  });
  chart.update('none');

  var tagEl = document.getElementById('p-quad2-tag');
  if (tagEl) {
    var scope = person !== 'all' ? '个人: ' + person : group !== 'all' ? '组: ' + group : team !== 'all' ? '部门: ' + team : '全部部门';
    tagEl.textContent = '12品类·' + scope;
  }
};

// 点击散点 → 筛选下方表格

// ===== 多品类趋势对比折线图更新 =====
App._trendSelectedProds = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品'];
App._updateTrendCompareChart = function() {
  var chart = App.charts.potTrendCompare;
  if (!chart) return;
  var state = App.getFilterState('page-potential');
  var sf = 1;
  if (state.person !== 'all') sf = 0.03;
  else if (state.group !== 'all') sf = 0.10;
  else if (state.team !== 'all') sf = 0.28;

  var sel = App._trendSelectedProds || ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品'];
  var selIdx = sel.map(function(p) { return App.ALL_POT_PRODUCTS.indexOf(p); }).filter(function(i) { return i >= 0; });
  if (selIdx.length === 0) selIdx = [0, 1, 2];

  chart.data.datasets = selIdx.map(function(i) {
    return {
      label: App.ALL_POT_PRODUCTS[i],
      data: App.YOY_BASE_DATA[i].map(function(v) { return Math.round(v * sf); }),
      borderColor: App.YOY_COLORS[i],
      tension: 0.3, fill: false, pointRadius: 2
    };
  });
  chart.update();

  var tagEl = document.getElementById('p-trend-tag');
  if (tagEl) {
    var scope = state.person !== 'all' ? '个人' : state.group !== 'all' ? '组' : state.team !== 'all' ? '部门' : '全部部门';
    tagEl.textContent = '近12月·' + scope;
  }
};

App.renderTrendProdSelect = function() {
  var container = document.getElementById('p-trend-prod-select');
  if (!container) return;
  if (!App._trendSelectedProds || App._trendSelectedProds.length === 0) {
    App._trendSelectedProds = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品'];
  }
  container.innerHTML = App.ALL_POT_PRODUCTS.map(function(p) {
    var checked = App._trendSelectedProds.indexOf(p) >= 0 ? ' checked' : '';
    return '<label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;padding:2px 8px;border:1px solid #d1d5db;border-radius:12px;background:#fff;user-select:none;white-space:nowrap">'
      + '<input type="checkbox" value="' + p + '"' + checked + ' onchange="App.onTrendProdChange()" style="margin:0;cursor:pointer"> '
      + p + '</label>';
  }).join('');
};

App.toggleTrendProdSelect = function() {
  var container = document.getElementById('p-trend-prod-select');
  if (!container) return;
  var isHidden = container.style.display === 'none';
  if (isHidden) {
    App.renderTrendProdSelect();
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
};

App.onTrendProdChange = function() {
  var container = document.getElementById('p-trend-prod-select');
  if (!container) return;
  var checks = container.querySelectorAll('input[type="checkbox"]');
  App._trendSelectedProds = [];
  checks.forEach(function(cb) { if (cb.checked) App._trendSelectedProds.push(cb.value); });
  if (App._trendSelectedProds.length === 0) {
    App._trendSelectedProds = [App.ALL_POT_PRODUCTS[0]];
    App.renderTrendProdSelect();
  }
  App._updateTrendCompareChart();
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

App._bundleStock = {};
;

App.renderCrossBundles = function(bundles) {
  var el = document.getElementById('w-cross-bundles');
  if (!el || !bundles) return;
  el.innerHTML = bundles.map(function(b) {
    var scoreColor = b.score >= 3.5 ? '#7c3aed' : (b.score >= 2.5 ? '#dc2626' : (b.score >= 2 ? '#f59e0b' : '#10b981'));
    var stock = App._bundleStock[b.name] || { custs:[], users:[] };
    return '<div class="bundle-card" style="border-left:3px solid ' + scoreColor + ';cursor:pointer" onclick="App.showBundleDrill(\'' + b.name + '\')" title="点击查看客户用户明细">' +
      '<div class="bundle-header"><strong>' + b.name + '</strong><span class="bundle-score" style="background:' + scoreColor + '">' + b.score.toFixed(1) + '</span></div>' +
      '<div class="bundle-prods">' + b.prods.map(function(p) { return '<span class="bundle-pill">' + p + '</span>'; }).join('') + '</div>' +
      '<div class="bundle-desc">覆盖率: <strong>' + b.rate + '</strong> | ' + b.desc + '</div>' +
      '<div style="font-size:11px;color:#6b7280;margin-top:4px">📊 涉及客户 ' + (stock.custs||[]).length + ' 家 / 用户 ' + (stock.users||[]).length + ' 个</div>' +
      '</div>';
  }).join('');
};

App.showBundleDrill = function(bundleName) {
  var stock = App._bundleStock[bundleName];
  if (!stock) { App.showModal('<p style="text-align:center;padding:40px">暂无明细数据</p>'); return; }

  var cell = function(v, style) { return '<td style="padding:8px 10px;' + (style||'') + '">' + v + '</td>'; };
  var makeTable = function(title, titleColor, rowsData, cols) {
    var ths = cols.map(function(c) { return '<th style="text-align:' + (c.align||'left') + ';padding:8px 10px;white-space:nowrap;width:' + (c.w||'auto') + '">' + c.label + '</th>'; }).join('');
    var trs = rowsData.map(function(r) {
      return '<tr style="border-bottom:1px solid #f3f4f6">' + cols.map(function(c) { return cell(c.render(r), c.style||''); }).join('') + '</tr>';
    }).join('');
    return '<div><h4 style="margin:0 0 10px;color:' + titleColor + ';font-size:14px">' + title + '</h4>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb">' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  };

  var cols = [
    { label:'名称', w:'150px', render:function(r){return '<strong>' + r.name + '</strong>';} },
    { label:'销售', w:'90px', render:function(r){return r.person||'-';} },
    { label:'团队', w:'130px', style:'color:#6b7280', render:function(r){return r.team||'-';} },
    { label:'已覆盖产品', w:'160px', style:'font-size:12px;color:#059669', render:function(r){return r.covered;} },
    { label:'缺失产品', w:'160px', style:'font-size:12px;color:#dc2626', render:function(r){return r.missing;} },
    { label:'产品宽度', w:'90px', align:'center', style:'font-weight:700;color:#1a56db', render:function(r){return r.width.toFixed(1);} }
  ];

  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '1100px'; modalBox.style.width = '95%'; }

  var html =
    '<h3 style="margin:0 0 12px;font-size:18px">📦 ' + bundleName + ' — 覆盖明细</h3>' +
    '<div style="display:flex;gap:24px;margin-bottom:20px;padding:14px 18px;background:#f8fafc;border-radius:8px;font-size:14px;flex-wrap:wrap">' +
      '<div style="min-width:130px"><div style="color:#6b7280;font-size:12px">套包评分</div><div style="font-size:20px;color:#7c3aed;font-weight:700">' + (stock._score || '—') + '</div></div>' +
      '<div style="min-width:110px"><div style="color:#6b7280;font-size:12px">涉及客户</div><div style="font-size:20px;color:#1a56db;font-weight:700">' + (stock.custs||[]).length + ' 家</div></div>' +
      '<div style="min-width:110px"><div style="color:#6b7280;font-size:12px">涉及用户</div><div style="font-size:20px;color:#059669;font-weight:700">' + (stock.users||[]).length + ' 个</div></div>' +
      '<div style="min-width:140px"><div style="color:#6b7280;font-size:12px">待覆盖产品数</div><div style="font-size:20px;color:#dc2626;font-weight:700">' + (stock.custs||[]).reduce(function(s,c){return s+(c.missing?c.missing.split(',').length:0);},0) + ' 项</div></div>' +
    '</div>' +
    makeTable('👥 客户清单 (' + (stock.custs||[]).length + '家)', '#1a56db', (stock.custs||[]), cols) +
    '<div style="margin-top:20px"></div>' +
    makeTable('🏢 用户清单 (' + (stock.users||[]).length + '个)', '#059669', (stock.users||[]), cols);

  App.showModal(html);
};

App.renderCrossRecommend = function(data) {
  var el = document.getElementById('w-cross-recommend');
  if (!el) return;
  var prods = data.prods, mat = data.matrix, n = prods.length, bundles = data.bundles || [];
  var topPairs = [];
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      if (mat[i][j] >= 2.0) topPairs.push({ a: prods[i], b: prods[j], lift: mat[i][j] });
    }
  }
  topPairs.sort(function(a, b) { return b.lift - a.lift; });

  // 客户侧推荐
  var custPairs = topPairs.slice(0, 4);
  var custHtml = custPairs.map(function(p) {
    var pct = Math.min(85, Math.round(p.lift * 18));
    return '<div style="padding:6px 0;border-bottom:1px solid #f3f4f6">' +
      '已覆盖 <strong style="color:#1a56db">' + p.a + '</strong> 的客户，推荐追加 <strong style="color:#dc2626">' + p.b + '</strong>（关联度 ' + p.lift.toFixed(1) + 'x，预计覆盖提升 ' + pct + '%）</div>';
  }).join('');

  // 用户侧推荐（同产品关联，侧重用户维度）
  var userPairs = topPairs.slice(1, 5).reverse();
  var userHtml = userPairs.map(function(p) {
    var pct = Math.min(78, Math.round(p.lift * 15));
    return '<div style="padding:6px 0;border-bottom:1px solid #f3f4f6">' +
      '已使用 <strong style="color:#1a56db">' + p.a + '</strong> 的用户，建议推广 <strong style="color:#dc2626">' + p.b + '</strong>（关联度 ' + p.lift.toFixed(1) + 'x，预计用户覆盖提升 ' + pct + '%）</div>';
  }).join('');

  // 套包策略建议
  var bundleTips = '';
  if (bundles.length) {
    bundleTips = '<div style="margin-top:12px"><strong style="font-size:13px">📦 套包策略</strong>' +
      bundles.slice(0, 3).map(function(b) {
        return '<div style="padding:4px 0 4px 8px;border-left:3px solid #7c3aed;margin:6px 0;font-size:12px">' +
          '<strong>' + b.name + '</strong>：' + b.desc + '</div>';
      }).join('') + '</div>';
  }

  el.innerHTML =
      '<div>' +
        '<h4 style="margin:0 0 8px 0;font-size:13px;color:#1a56db">👥 客户交叉销售建议</h4>' +
        (custHtml || '<p style="color:#9ca3af;font-size:12px">暂无高关联推荐</p>') +
      '</div>' +
      '<div>' +
        '<h4 style="margin:0 0 8px 0;font-size:13px;color:#059669">🏢 用户交叉销售建议</h4>' +
        (userHtml || '<p style="color:#9ca3af;font-size:12px">暂无高关联推荐</p>') +
      '</div>' +
    '</div>' + bundleTips;
};

// ===== 产品宽度 - 差距分析（团队/个人 vs 上级均值，跟随页级筛选） =====
App.renderWidthGapAnalysis = function() {
  var tbody = document.getElementById('wGapTable');
  var statsEl = document.getElementById('wGapStats');
  if (!tbody || !statsEl) return;

  var state = App.getFilterState('page-width');
  var team = state.team, group = state.group, person = state.person;

  // 构建部门均值映射
  var deptMap = {};
  App.DEPTS.forEach(function(d) { deptMap[d.n] = d.aw; });

  // 构建组均值映射
  var groupMap = {};
  App.GROUPS.forEach(function(g) { groupMap[g.n] = { aw: g.aw, dept: g.dept }; });

  var rows = [];
  var titleSuffix = '';

  if (person !== 'all') {
    // 优先级1: 个人 vs 所属组均值
    var p = App.PERSONS.find(function(x) { return x.n === person; });
    if (!p) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">未找到该人员数据</td></tr>'; statsEl.innerHTML = ''; return; }
    var grpInfo = groupMap[p.grp] || { aw: 3.5, dept: p.dept };
    var deptAvg = deptMap[p.dept] || 3.5;
    var gap = parseFloat((p.aw - grpInfo.aw).toFixed(2));
    var gapRate = parseFloat(((gap / grpInfo.aw) * 100).toFixed(1));
    var status, statusCls;
    if (gapRate > 5)      { status = '🚀 超前'; statusCls = 'b-up'; }
    else if (gapRate < -5) { status = '⚠ 落后'; statusCls = 'b-down'; }
    else                   { status = '✓ 正常'; statusCls = 'b-flat'; }
    rows.push({ name: p.n, parent: p.grp, aw: p.aw, parentAvg: grpInfo.aw, gap: gap, gapRate: gapRate, status: status, statusCls: statusCls });
    titleSuffix = '（个人 vs 组均值）';
  } else if (group !== 'all') {
    // 优先级2: 组内人员 vs 组均值
    var members = App.PERSONS.filter(function(x) { return x.grp === group; });
    var gAvg = groupMap[group] ? groupMap[group].aw : 3.5;
    rows = members.map(function(m) {
      var gap = parseFloat((m.aw - gAvg).toFixed(2));
      var gapRate = parseFloat(((gap / gAvg) * 100).toFixed(1));
      var status, statusCls;
      if (gapRate > 5)      { status = '🚀 超前'; statusCls = 'b-up'; }
      else if (gapRate < -5) { status = '⚠ 落后'; statusCls = 'b-down'; }
      else                   { status = '✓ 正常'; statusCls = 'b-flat'; }
      return { name: m.n, parent: group, aw: m.aw, parentAvg: gAvg, gap: gap, gapRate: gapRate, status: status, statusCls: statusCls };
    });
    titleSuffix = '（个人 vs ' + group + ' 组均值）';
  } else if (team !== 'all') {
    // 优先级3: 部门下小组 vs 部门均值
    var deptGrps = App.GROUPS.filter(function(g) { return g.dept === team; });
    var dAvg = deptMap[team] || 3.5;
    rows = deptGrps.map(function(g) {
      var gap = parseFloat((g.aw - dAvg).toFixed(2));
      var gapRate = parseFloat(((gap / dAvg) * 100).toFixed(1));
      var status, statusCls;
      if (gapRate > 5)      { status = '🚀 超前'; statusCls = 'b-up'; }
      else if (gapRate < -5) { status = '⚠ 落后'; statusCls = 'b-down'; }
      else                   { status = '✓ 正常'; statusCls = 'b-flat'; }
      return { name: g.n, parent: team, aw: g.aw, parentAvg: dAvg, gap: gap, gapRate: gapRate, status: status, statusCls: statusCls };
    });
    titleSuffix = '（小组 vs ' + team + ' 部门均值）';
  } else {
    // 全部: 部门 vs 业务中心均值（部门对比）
    var allAvg = App.DEPTS.reduce(function(s, d) { return s + d.aw; }, 0) / App.DEPTS.length;
    rows = App.DEPTS.map(function(d) {
      var gap = parseFloat((d.aw - allAvg).toFixed(2));
      var gapRate = parseFloat(((gap / allAvg) * 100).toFixed(1));
      var status, statusCls;
      if (gapRate > 5)      { status = '🚀 超前'; statusCls = 'b-up'; }
      else if (gapRate < -5) { status = '⚠ 落后'; statusCls = 'b-down'; }
      else                   { status = '✓ 正常'; statusCls = 'b-flat'; }
      return { name: d.n, parent: '业务中心', aw: d.aw, parentAvg: parseFloat(allAvg.toFixed(2)), gap: gap, gapRate: gapRate, status: status, statusCls: statusCls };
    });
    titleSuffix = '（部门 vs 业务中心均值）';
  }

  // 更新标题标签
  var tagEl = document.querySelector('#wGapAnalysis').previousElementSibling.querySelector('.tag');
  if (tagEl) tagEl.textContent = titleSuffix.replace(/（/, '').replace(/）/, '');

  // 按差距率升序（落后在前）
  rows.sort(function(a, b) { return a.gapRate - b.gapRate; });

  // 统计卡片
  var aheadCount = rows.filter(function(r) { return r.gapRate > 5; }).length;
  var behindCount = rows.filter(function(r) { return r.gapRate < -5; }).length;
  var normalCount = rows.length - aheadCount - behindCount;
  var maxGap = rows.length ? Math.max.apply(null, rows.map(function(r) { return r.gap; })) : 0;
  var minGap = rows.length ? Math.min.apply(null, rows.map(function(r) { return r.gap; })) : 0;
  var entityLabel = person !== 'all' ? '个人' : (group !== 'all' ? '个人' : (team !== 'all' ? '团队' : '部门'));

  statsEl.innerHTML =
    '<div class="kpi-card k-green" style="padding:10px 14px"><div class="kpi-label">🚀 超均值' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + aheadCount + '</div><div class="kpi-sub">个 · 差距率 > +5%</div></div>' +
    '<div class="kpi-card" style="padding:10px 14px"><div class="kpi-label">✓ 正常' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + normalCount + '</div><div class="kpi-sub">个 · 差距率 ±5%</div></div>' +
    '<div class="kpi-card k-red" style="padding:10px 14px"><div class="kpi-label">⚠ 落后' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + behindCount + '</div><div class="kpi-sub">个 · 差距率 < -5%</div></div>' +
    '<div class="kpi-card k-orange" style="padding:10px 14px"><div class="kpi-label">📏 最大差距</div><div class="kpi-value" style="font-size:20px">' + (minGap < 0 ? minGap.toFixed(2) + ' ~ +' + maxGap.toFixed(2) : '+' + maxGap.toFixed(2)) + '</div><div class="kpi-sub">负=落后 · 正=超前</div></div>';

  // 表格 — 列名根据维度动态调整
  var parentColLabel = person !== 'all' ? '所属组' : (group !== 'all' ? '所属组' : (team !== 'all' ? '所属部门' : '对比基准'));
  tbody.innerHTML = rows.map(function(r, i) {
    var rnCls = i < 3 ? 'rn rn' + (i + 1) : 'rn rn0';
    var gapSign = r.gap >= 0 ? '+' : '';
    var gapRateSign = r.gapRate >= 0 ? '+' : '';
    var gapColor = r.gap >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    return '<tr>' +
      '<td><span class="' + rnCls + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + r.name + '</strong></td>' +
      '<td style="text-align:center">' + r.parent + '</td>' +
      '<td style="text-align:center;font-weight:700">' + r.aw.toFixed(2) + '</td>' +
      '<td style="text-align:center;color:#6b7280">' + r.parentAvg.toFixed(2) + '</td>' +
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
// ===== 分组对比（数据范围跟随页级筛选，对比维度独立选择） =====
App.initCompare = function() {
  App.updateCompareDropdowns();
  App.renderCompare();
};

App.updateCompareDropdowns = function() {
  var mode = (document.getElementById('compare-mode') || {}).value || 'dept_mean';
  var selA = document.getElementById('compare-A');
  var selB = document.getElementById('compare-B');
  var wrapB = document.getElementById('compare-B-wrap');
  var labelB = document.getElementById('compare-B-label');

  var needB = mode === 'dept_dept' || mode === 'group_group' || mode === 'person_person';
  if (wrapB) wrapB.style.display = needB ? '' : 'none';

  // 页级筛选状态
  var state = App.getFilterState('page-width');
  var raw = App.WidthCustomer.RAW;

  // 按筛选范围过滤 RAW
  var scopedRaw = raw.slice();
  if (state.team !== 'all') {
    var dg = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    scopedRaw = scopedRaw.filter(function(r) { return dg.indexOf(r.team) >= 0; });
  }
  if (state.group !== 'all') scopedRaw = scopedRaw.filter(function(r) { return r.team === state.group; });
  if (state.person !== 'all') scopedRaw = scopedRaw.filter(function(r) { return r.account === state.person; });

  var itemsA = [], itemsB = [];

  if (mode === 'dept_mean' || mode === 'dept_dept') {
    // 部门维度：显示全部部门，跟随筛选缩减
    var depts = state.team !== 'all' ? [state.team] : App.DEPTS.map(function(d) { return d.n; });
    itemsA = depts.map(function(d) { return { v: d, t: d }; });
    itemsB = itemsA;
    if (labelB) labelB.textContent = '对比部门B';
  } else if (mode === 'group_dept' || mode === 'group_group') {
    // 组维度：按 GROUPS 原始顺序排列
    var teamSet = {};
    scopedRaw.forEach(function(r) { teamSet[r.team] = true; });
    var teams = state.group !== 'all' ? [state.group] : App.GROUPS.map(function(g) { return g.n; }).filter(function(t) { return teamSet[t]; });
    itemsA = teams.map(function(t) {
      var gi = App.GROUPS.find(function(g) { return g.n === t; });
      return { v: t, t: t + (gi ? ' (' + gi.dept + ')' : '') };
    });
    itemsB = itemsA;
    if (labelB) labelB.textContent = '对比组B';
  } else {
    // 个人维度
    var accSet = {};
    scopedRaw.forEach(function(r) { accSet[r.account] = true; });
    var accs = state.person !== 'all' ? [state.person] : Object.keys(accSet).sort();
    itemsA = accs.map(function(acc) {
      var dn = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(acc) : acc;
      return { v: acc, t: dn };
    });
    itemsB = itemsA;
    if (labelB) labelB.textContent = '对比个人B';
  }

  function fill(sel, items) {
    if (!sel) return;
    var cv = sel.value;
    sel.innerHTML = '<option value="">-- 请选择 --</option>';
    items.forEach(function(it) {
      var o = document.createElement('option'); o.value = it.v; o.textContent = it.t;
      sel.appendChild(o);
    });
    if (cv) sel.value = cv;
  }

  fill(selA, itemsA);
  if (needB) fill(selB, itemsB);
};

App.renderCompare = function() {
  App.updateCompareDropdowns();
  var mode = (document.getElementById('compare-mode') || {}).value || 'dept_mean';
  var selA = document.getElementById('compare-A');
  var selB = document.getElementById('compare-B');
  var vA = selA ? selA.value : '';
  var vB = selB ? selB.value : '';
  var needB = mode === 'dept_dept' || mode === 'group_group' || mode === 'person_person';

  function showInfo(msg) {
    var el = document.getElementById('w-compare-summary-body');
    if (el) el.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#9ca3af;font-size:15px">' + msg + '</td></tr>';
    ['w-compare-prod-body'].forEach(function(id) { var e = document.getElementById(id); if (e) e.innerHTML = ''; });
  }
  if (!vA) { showInfo('请先选择对比组A'); return; }
  if (needB && !vB) { showInfo('请先选择对比组B'); return; }
  if (needB && vA === vB) { showInfo('请选择不同的对比对象'); return; }

  // 跟随页级筛选的数据范围
  var state = App.getFilterState('page-width');
  var scopedRaw = App.WidthCustomer.RAW.slice();
  if (state.team !== 'all') {
    var dgAll = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    scopedRaw = scopedRaw.filter(function(r) { return dgAll.indexOf(r.team) >= 0; });
  }
  if (state.group !== 'all') scopedRaw = scopedRaw.filter(function(r) { return r.team === state.group; });
  if (state.person !== 'all') scopedRaw = scopedRaw.filter(function(r) { return r.account === state.person; });

  var products = App.WidthDetail.PRODUCTS;

  function getDeptData(name) {
    var dg = App.GROUPS.filter(function(g) { return g.dept === name; }).map(function(g) { return g.n; });
    return getStats(scopedRaw.filter(function(r) { return dg.indexOf(r.team) >= 0; }));
  }
  function getGroupData(name) { return getStats(scopedRaw.filter(function(r) { return r.team === name; })); }
  function getPersonData(name) { return getStats(scopedRaw.filter(function(r) { return r.account === name; })); }

  function getStats(filtered) {
    var widths = filtered.map(function(r) { return r.width; });
    var avgW = filtered.length ? widths.reduce(function(s, w) { return s + w; }, 0) / filtered.length : 0;
    var maxW = filtered.length ? Math.max.apply(null, widths) : 0;
    var gs = filtered.filter(function(r) { return r.guishang === 1; }).length;
    var prodCnt = products.map(function(p) {
      return filtered.length ? parseFloat((filtered.filter(function(r) { return r.prods && r.prods[p] === 1; }).length / filtered.length * 100).toFixed(1)) : 0;
    });
    return { count: filtered.length, avgWidth: avgW, maxWidth: maxW, guishang: gs, guishangRate: filtered.length ? parseFloat((gs / filtered.length * 100).toFixed(1)) : 0, prodCnt: prodCnt };
  }

  function getCenterMean() {
    return getStats(scopedRaw);
  }

  function getDeptMean(deptName) {
    var dg = App.GROUPS.filter(function(g) { return g.dept === deptName; }).map(function(g) { return g.n; });
    return getStats(App.WidthCustomer.RAW.filter(function(r) { return dg.indexOf(r.team) >= 0; }));
  }

  function getGroupOfPerson(acc) {
    var r = App.WidthCustomer.RAW.find(function(x) { return x.account === acc; });
    return r ? r.team : '';
  }

  var dataA, dataB, labelA, labelB, modeLabel;
  if (mode === 'dept_mean') {
    dataA = getDeptData(vA);
    dataB = getCenterMean();
    labelA = vA; labelB = '业务中心均值';
    modeLabel = '部门 vs 业务中心均值';
  } else if (mode === 'dept_dept') {
    dataA = getDeptData(vA);
    dataB = getDeptData(vB);
    labelA = vA; labelB = vB;
    modeLabel = '部门 vs 部门';
  } else if (mode === 'group_dept') {
    dataA = getGroupData(vA);
    var gi = App.GROUPS.find(function(g) { return g.n === vA; });
    var deptN = gi ? gi.dept : '';
    dataB = getDeptMean(deptN);
    labelA = vA; labelB = deptN + ' 部门均值';
    modeLabel = '组 vs 部门';
  } else if (mode === 'group_group') {
    dataA = getGroupData(vA);
    dataB = getGroupData(vB);
    labelA = vA; labelB = vB;
    modeLabel = '组 vs 组';
  } else if (mode === 'person_person') {
    dataA = getPersonData(vA);
    dataB = getPersonData(vB);
    var dnA = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(vA) : vA;
    var dnB = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(vB) : vB;
    labelA = dnA; labelB = dnB;
    modeLabel = '个人 vs 个人';
  } else {
    dataA = getPersonData(vA);
    var grp = getGroupOfPerson(vA);
    dataB = grp ? getGroupData(grp) : getCenterMean();
    var dnA2 = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(vA) : vA;
    labelA = dnA2; labelB = grp ? (grp + ' 组均值') : '全部均值';
    modeLabel = '个人 vs 组';
  }

  App.setText('w-compare-th-A', labelA);
  App.setText('w-compare-th-A2', labelA + ' 覆盖率');
  App.setText('w-compare-th-B', labelB);
  App.setText('w-compare-th-B2', labelB + ' 覆盖率');
  App.setText('compare-level', modeLabel + ': ' + labelA + ' vs ' + labelB);

  var metrics = [
    ['客户数', dataA.count, dataB.count, '', 0],
    ['平均产品宽度', dataA.avgWidth.toFixed(2), dataB.avgWidth.toFixed(2), '越大越好', 2],
    ['规上客户数', dataA.guishang, dataB.guishang, '越大越好', 0],
    ['规上比率%', dataA.guishangRate.toFixed(1) + '%', dataB.guishangRate.toFixed(1) + '%', '越大越好', 1]
  ];
  var summaryHtml = '';
  metrics.forEach(function(m) {
    var na = parseFloat(m[1]), nb = parseFloat(m[2]), diff = na - nb;
    var dStr = (diff >= 0 ? '+' : '') + diff.toFixed(m[4]);
    var aC = m[3] && na > nb ? 'compare-better' : (m[3] && na < nb ? 'compare-worse' : '');
    var bC = m[3] && nb > na ? 'compare-better' : (m[3] && nb < na ? 'compare-worse' : '');
    var dC = diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '');
    summaryHtml += '<tr><td>' + m[0] + '</td><td class="' + aC + '">' + m[1] + '</td><td class="' + bC + '">' + m[2] + '</td><td class="' + dC + '"><strong>' + dStr + '</strong></td></tr>';
  });
  App.setHTML('w-compare-summary-body', summaryHtml);

  var prodHtml = '';
  products.forEach(function(p, i) {
    var aR = dataA.prodCnt[i], bR = dataB.prodCnt[i], diff = aR - bR;
    prodHtml += '<tr><td>' + p + '</td><td>' + aR.toFixed(1) + '%</td><td>' + bR.toFixed(1) + '%</td><td class="' + (diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '')) + '"><strong>' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%</strong></td></tr>';
  });
  App.setHTML('w-compare-prod-body', prodHtml);

  // 更新分布图图例（标题栏）
  App.setText('w-compare-dist-legend-A', '');
  var legA = document.getElementById('w-compare-dist-legend-A');
  if (legA) legA.innerHTML = '<span style="width:10px;height:10px;background:#1a56db;border-radius:2px"></span>' + labelA;
  var legB = document.getElementById('w-compare-dist-legend-B');
  if (legB) legB.innerHTML = '<span style="width:10px;height:10px;background:#dc2626;border-radius:2px"></span>' + labelB;
  if (App.charts.wCompareDist) {
    App.charts.wCompareDist.data.datasets[0].label = labelA;
    App.charts.wCompareDist.data.datasets[1].label = labelB;
    App.charts.wCompareDist.update();
  }

  setTimeout(function() {
    if (App.charts.wCompareRadar) {
      App.charts.wCompareRadar.data.labels = products;
      App.charts.wCompareRadar.data.datasets[0].label = labelA;
      App.charts.wCompareRadar.data.datasets[0].data = dataA.prodCnt;
      App.charts.wCompareRadar.data.datasets[1].label = labelB;
      App.charts.wCompareRadar.data.datasets[1].data = dataB.prodCnt;
      App.charts.wCompareRadar.update();
    }
  }, 50);

};

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

// 柱状图数值标注插件（共享）
var barLabelPlugin = {
  id: 'barLabels',
  afterDraw: function(chart) {
    var ctx = chart.ctx;
    chart.data.datasets.forEach(function(ds, dsIdx) {
      var meta = chart.getDatasetMeta(dsIdx);
      if (!meta) return;
      meta.data.forEach(function(bar, i) {
        var val = ds.data[i];
        if (val > 0) {
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 12px "Microsoft YaHei", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val, bar.x, bar.y - 6);
        }
      });
    });
  }
};

// ===== 低宽度客户分析（跟随页级筛选：部门→组→个人） =====
App.filterLowWidth = function(showDetail) {
  var input = document.getElementById('width-threshold');
  var threshold = input ? parseInt(input.value) || 3 : 3;
  var products = App.WidthDetail.PRODUCTS;

  // 获取页级筛选状态
  var state = App.getFilterState('page-width');
  var raw = App.WidthCustomer.RAW.slice();

  if (state.team !== 'all') {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    raw = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
  }
  if (state.group !== 'all') {
    raw = raw.filter(function(r) { return r.team === state.group; });
  }
  if (state.person !== 'all') {
    raw = raw.filter(function(r) { return r.account === state.person || (App.WidthCustomer.getDisplayName && App.WidthCustomer.getDisplayName(r.account) === state.person); });
  }

  // 低于阈值的客户
  var lowCustomers = raw.filter(function(r) { return r.width < threshold; });
  var totalCount = raw.length;
  var lowCount = lowCustomers.length;
  var rate = totalCount > 0 ? (lowCount / totalCount * 100).toFixed(1) : '0.0';
  var lowAvg = lowCount > 0 ? (lowCustomers.reduce(function(s, r) { return s + r.width; }, 0) / lowCount).toFixed(2) : '0';
  var allAvg = totalCount > 0 ? (raw.reduce(function(s, r) { return s + r.width; }, 0) / totalCount).toFixed(2) : '0';
  var gap = (parseFloat(lowAvg) - parseFloat(allAvg)).toFixed(2);

  // 可快速提升的客户（宽度≥2，差1-2个品类即可超过阈值）
  var upsellCustomers = lowCustomers.filter(function(r) { return r.width >= 2 && r.width >= threshold - 2; });
  var upsellCount = upsellCustomers.length;

  // 统计低宽度客户中最缺失的品类
  var prodMissing = {};
  products.forEach(function(p) { prodMissing[p] = 0; });
  lowCustomers.forEach(function(r) {
    products.forEach(function(p) {
      if (!r.prods || r.prods[p] !== 1) prodMissing[p]++;
    });
  });
  var missingSorted = Object.entries(prodMissing)
    .filter(function(e) { return e[1] > 0; })
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 3)
    .map(function(e) { return e[0] + '(' + e[1] + '户)'; })
    .join('、');

  // === 更新统计卡片 ===
  App.setText('w-low-count', lowCount);
  App.setText('w-low-rate', rate + '%');
  App.setText('w-low-avg', lowAvg);
  var gapEl = document.getElementById('w-low-gap');
  if (gapEl) {
    gapEl.textContent = (parseFloat(gap) >= 0 ? '+' : '') + gap;
    gapEl.className = parseFloat(gap) < 0 ? 'delta-down' : 'delta-up';
  }
  App.setText('w-low-upsell', upsellCount);
  App.setText('w-low-missing', missingSorted || '无');

  // === 低宽度客户 TOP 列表（内嵌表格） ===
  var tbody = document.getElementById('wLowCustTable');
  if (tbody) {
    var topList = lowCustomers.slice().sort(function(a, b) { return a.width - b.width; }).slice(0, 20);
    var h = '';
    if (topList.length === 0) {
      h = '<tr><td colspan="8" style="padding:20px;text-align:center;color:#94a3b8">✅ 当前筛选范围内所有客户宽度均 ≥ ' + threshold + '</td></tr>';
    } else {
      topList.forEach(function(r, i) {
        var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
        // 已有产品列表
        var hasProds = products.filter(function(p) { return r.prods && r.prods[p] === 1; });
        var hasStr = hasProds.slice(0, 4).join('、') + (hasProds.length > 4 ? '…' : '');
        // 建议补充：最常缺失的前2个高频品类
        var suggestProds = products.filter(function(p) { return !r.prods || r.prods[p] !== 1; }).slice(0, 2).join('、');
        h += '<tr>';
        h += '<td>' + (i + 1) + '</td>';
        h += '<td><strong>' + App.escapeHtml(r.user) + '</strong></td>';
        h += '<td style="text-align:center;font-size:11px">' + App.escapeHtml(r.team || '') + '</td>';
        h += '<td style="text-align:center;font-size:11px">' + App.escapeHtml(displayName) + '</td>';
        h += '<td style="text-align:center;font-weight:700;color:#2563eb">' + r.width + '</td>';
        h += '<td style="text-align:center">' + (r.guishang === 1 ? '<span class="badge-gs">规上</span>' : '<span class="badge-ngs" style="text-decoration:none;cursor:default">非规上</span>') + '</td>';
        h += '<td style="font-size:11px;color:#6b7280">' + (hasStr || '-') + '</td>';
        h += '<td style="font-size:11px;color:#dc2626">' + (suggestProds || '-') + '</td>';
        h += '</tr>';
      });
    }
    tbody.innerHTML = h;
  }

  // === 部门 / 组维度统计（柱状图） ===
  var deptStats = [];
  App.DEPTS.forEach(function(dept) {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === dept.n; }).map(function(g) { return g.n; });
    var deptAll = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
    var deptLow = deptAll.filter(function(r) { return r.width < threshold; });
    deptStats.push({ n: dept.n, total: deptAll.length, low: deptLow.length });
  });
  // 保持与筛选下拉一致的顺序，不重排
  // 跟随筛选：如果选了具体部门，只展示该部门
  if (state.team !== 'all') {
    deptStats = deptStats.filter(function(d) { return d.n === state.team; });
  }

  var grpStats = [];
  App.GROUPS.forEach(function(grp) {
    var grpAll = raw.filter(function(r) { return r.team === grp.n; });
    var grpLow = grpAll.filter(function(r) { return r.width < threshold; });
    grpStats.push({ n: grp.n, total: grpAll.length, low: grpLow.length });
  });
  // 保持与筛选下拉一致的顺序，不重排
  // 跟随筛选：只展示当前部门下的组
  if (state.team !== 'all') {
    grpStats = grpStats.filter(function(g) {
      var grpInfo = App.GROUPS.find(function(gr) { return gr.n === g.n; });
      return grpInfo && grpInfo.dept === state.team;
    });
  }

  // 渲染柱状图
  setTimeout(function() {
    var deptCanvas = document.getElementById('chart-w-low-dept');
    if (deptCanvas) {
      if (App.charts._lowDept) App.charts._lowDept.destroy();
      var deptMax = Math.max.apply(null, deptStats.map(function(d) { return d.low; }).concat([1]));
      App.charts._lowDept = new Chart(deptCanvas, {
        type: 'bar',
        plugins: [barLabelPlugin],
        data: {
          labels: deptStats.map(function(d) { return d.n; }),
          datasets: [
            { label: '低宽度客户(<' + threshold + ')', data: deptStats.map(function(d) { return d.low; }), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          layout: { padding: { top: 16 } },
          onClick: function(e, elements) {
            if (elements.length > 0) {
              var idx = elements[0].index;
              var deptName = deptStats[idx].n;
              App.filterLowWidthDrill('dept', deptName, threshold);
            }
          },
          scales: {
            x: { ticks: { maxRotation: 45, autoSkip: false, font: { size: 11, weight: 'bold' } } },
            y: { beginAtZero: true, max: Math.ceil(deptMax * 1.3), ticks: { precision: 0, font: { size: 12 } }, title: { display: true, text: '客户数', font: { size: 13, weight: 'bold' } } }
          }
        }
      });
    }

    var grpCanvas = document.getElementById('chart-w-low-group');
    if (grpCanvas) {
      if (App.charts._lowGroup) App.charts._lowGroup.destroy();
      var showGrps = grpStats;
      var grpMax = Math.max.apply(null, showGrps.map(function(g) { return g.low; }).concat([1]));
      App.charts._lowGroup = new Chart(grpCanvas, {
        type: 'bar',
        plugins: [barLabelPlugin],
        data: {
          labels: showGrps.map(function(g) { return g.n; }),
          datasets: [
            { label: '低宽度客户(<' + threshold + ')', data: showGrps.map(function(g) { return g.low; }), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          layout: { padding: { top: 16 } },
          onClick: function(e, elements) {
            if (elements.length > 0) {
              var idx = elements[0].index;
              var grpName = showGrps[idx].n;
              App.filterLowWidthDrill('group', grpName, threshold);
            }
          },
          scales: {
            x: { ticks: { maxRotation: 60, autoSkip: false, font: { size: 10, weight: 'bold' } } },
            y: { beginAtZero: true, max: Math.ceil(grpMax * 1.3), ticks: { precision: 0, font: { size: 12 } }, title: { display: true, text: '客户数', font: { size: 13, weight: 'bold' } } }
          }
        }
      });
    }
  }, 50);

  // 柱状图点击 → 钻取部门/组低宽度客户明细
  App.filterLowWidthDrill = function(type, name, threshold) {
    var raw = App.WidthCustomer.RAW.slice();
    var products = App.WidthDetail.PRODUCTS;
    var filtered;
    if (type === 'dept') {
      var deptGroups = App.GROUPS.filter(function(g) { return g.dept === name; }).map(function(g) { return g.n; });
      filtered = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0 && r.width < threshold; });
    } else {
      filtered = raw.filter(function(r) { return r.team === name && r.width < threshold; });
    }

    var title = '低宽度客户明细 — ' + name + '（宽度 < ' + threshold + '，共 ' + filtered.length + ' 条）';
    var bodyHtml = '';

    if (!filtered.length) {
      bodyHtml = '<div class="info-msg">' + name + ' 当前无低宽度客户</div>';
      App.showModal(title, bodyHtml);
      return;
    }

    // 按账号汇总
    var accMap = {};
    filtered.forEach(function(r) {
      var a = r.account || '(未填写)';
      if (!accMap[a]) accMap[a] = { account: a, rows: [] };
      accMap[a].rows.push(r);
    });
    var accRows = Object.values(accMap).sort(function(a, b) { return b.rows.length - a.rows.length; });
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 按销售人员分组统计</div>';
    bodyHtml += '<table class="modal-table" style="margin-bottom:14px"><thead><tr><th>销售</th><th>低宽度客户数</th><th>平均宽度</th></tr></thead><tbody>';
    accRows.forEach(function(a) {
      var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
      bodyHtml += '<tr><td><strong>' + App.escapeHtml(displayName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';

    // 客户明细表
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细</div>';
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table"><thead><tr><th>团队</th><th>销售</th><th>客户名称</th><th>产品宽度</th><th>规上</th>';
    products.slice(0, 10).forEach(function(p) {
      bodyHtml += '<th title="' + p + '" style="min-width:34px">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 300;
    filtered.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td>' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td>' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td><strong>' + App.escapeHtml(r.user || '') + '</strong></td>';
      bodyHtml += '<td class="avg-num">' + r.width + '</td>';
      bodyHtml += '<td style="text-align:center">' + (r.guishang === 1 ? '<span class="badge-gs">规上</span>' : '<span class="badge-ngs" style="text-decoration:none;cursor:default">非规上</span>') + '</td>';
      products.slice(0, 10).forEach(function(p) {
        var has = r.prods && r.prods[p] === 1;
        bodyHtml += '<td style="text-align:center;color:' + (has ? '#059669' : '#d1d5db') + '">' + (has ? '✓' : '-') + '</td>';
      });
      bodyHtml += '</tr>';
    });
    if (filtered.length > maxRows) {
      bodyHtml += '<tr><td colspan="' + (5 + Math.min(10, products.length)) + '" style="text-align:center;color:#9ca3af;padding:10px">还有 ' + (filtered.length - maxRows) + ' 条数据</td></tr>';
    }
    bodyHtml += '</tbody></table></div>';

    App.WidthDetail._detailCache = filtered;
    App.WidthDetail._detailLabel = type === 'dept' ? name + '(低宽度<' + threshold + ')' : name + '(低宽度<' + threshold + ')';
    var footerHtml = '<button class="btn-primary" onclick="App.WidthDetail._exportDetailCSV()" style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px">📥 导出明细</button>';
    App.showModal(title, bodyHtml, footerHtml);
  };

  // 点击"查看明细"按钮 → 弹窗展示完整明细
  if (showDetail && lowCount > 0) {
    var title = '低宽度客户明细（宽度 < ' + threshold + '，共 ' + lowCount + ' 条）';
    var bodyHtml = '';

    var accMap = {};
    lowCustomers.forEach(function(r) {
      var a = r.account || '(未填写)';
      if (!accMap[a]) accMap[a] = { account: a, rows: [] };
      accMap[a].rows.push(r);
    });
    var accRows = Object.values(accMap).sort(function(a, b) { return b.rows.length - a.rows.length; });
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 按销售人员分组统计</div>';
    bodyHtml += '<table class="modal-table" style="margin-bottom:14px"><thead><tr><th>销售</th><th>低宽度客户数</th><th>平均宽度</th></tr></thead><tbody>';
    accRows.forEach(function(a) {
      var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
      bodyHtml += '<tr><td><strong>' + App.escapeHtml(displayName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';

    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细</div>';
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table"><thead><tr><th>团队</th><th>销售</th><th>最终用户</th><th>产品宽度</th><th>规上</th>';
    products.slice(0, 10).forEach(function(p) {
      bodyHtml += '<th title="' + p + '" style="min-width:34px">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 300;
    lowCustomers.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td>' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td>' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td><strong>' + App.escapeHtml(r.user || '') + '</strong></td>';
      bodyHtml += '<td class="avg-num">' + r.width + '</td>';
      bodyHtml += '<td style="text-align:center">' + (r.guishang === 1 ? '<span class="badge-gs">规上</span>' : '<span class="badge-ngs" style="text-decoration:none;cursor:default">非规上</span>') + '</td>';
      products.slice(0, 10).forEach(function(p) {
        var has = r.prods && r.prods[p] === 1;
        bodyHtml += '<td style="text-align:center;color:' + (has ? '#059669' : '#d1d5db') + '">' + (has ? '✓' : '-') + '</td>';
      });
      bodyHtml += '</tr>';
    });
    if (lowCount > maxRows) {
      bodyHtml += '<tr><td colspan="' + (5 + Math.min(10, products.length)) + '" style="text-align:center;color:#9ca3af;padding:10px">还有 ' + (lowCount - maxRows) + ' 条数据</td></tr>';
    }
    bodyHtml += '</tbody></table></div>';

    App.WidthDetail._detailCache = lowCustomers;
    App.WidthDetail._detailLabel = '低宽度(低于' + threshold + ')';
    var footerHtml = '<button class="btn-primary" onclick="App.WidthDetail._exportDetailCSV()" style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px">📥 导出明细</button>';
    App.showModal(title, bodyHtml, footerHtml);
  }
};

// ===== 低宽度用户分析（用户维度，跟随页级筛选） =====
App.filterLowWidthUser = function(showDetail) {
  var input = document.getElementById('width-user-threshold');
  var threshold = input ? parseInt(input.value) || 3 : 3;
  var products = App.WidthDetail.PRODUCTS;

  var state = App.getFilterState('page-width');
  var raw = App.WidthCustomer.RAW.slice();
  if (state.team !== 'all') {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    raw = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
  }
  if (state.group !== 'all') raw = raw.filter(function(r) { return r.team === state.group; });
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.account === state.person || (App.WidthCustomer.getDisplayName && App.WidthCustomer.getDisplayName(r.account) === state.person); });

  // 按用户聚合
  var userMap = {};
  raw.forEach(function(r) {
    var u = r.user;
    if (!userMap[u]) userMap[u] = { rows: [], teams: {}, accounts: {} };
    userMap[u].rows.push(r);
    userMap[u].teams[r.team] = true;
    userMap[u].accounts[r.account] = true;
  });
  var users = Object.keys(userMap).map(function(u) {
    var um = userMap[u];
    var widths = um.rows.map(function(r) { return r.width; });
    var avgW = um.rows.length ? widths.reduce(function(s, w) { return s + w; }, 0) / um.rows.length : 0;
    var maxW = um.rows.length ? Math.max.apply(null, widths) : 0;
    var acctCount = Object.keys(um.accounts).length;
    var hasProds = products.filter(function(p) { return um.rows.some(function(r) { return r.prods && r.prods[p] === 1; }); });
    return { user: u, rows: um.rows, teamList: Object.keys(um.teams), acctCount: acctCount, aw: avgW, mw: maxW, hasProds: hasProds, prodCount: hasProds.length };
  });
  var totalCount = users.length;
  var lowUsers = users.filter(function(u) { return u.aw < threshold; });
  var lowCount = lowUsers.length;
  var rate = totalCount > 0 ? (lowCount / totalCount * 100).toFixed(1) : '0.0';
  var lowAvg = lowCount > 0 ? (lowUsers.reduce(function(s, u) { return s + u.aw; }, 0) / lowCount).toFixed(2) : '0';
  var allAvg = totalCount > 0 ? (users.reduce(function(s, u) { return s + u.aw; }, 0) / totalCount).toFixed(2) : '0';
  var gap = (parseFloat(lowAvg) - parseFloat(allAvg)).toFixed(2);
  var upsellUsers = lowUsers.filter(function(u) { return u.aw >= 2 && u.aw >= threshold - 2; });
  var upsellCount = upsellUsers.length;

  var prodMissing = {};
  products.forEach(function(p) { prodMissing[p] = 0; });
  lowUsers.forEach(function(u) {
    products.forEach(function(p) { if (u.hasProds.indexOf(p) < 0) prodMissing[p]++; });
  });
  var missingSorted = Object.entries(prodMissing).filter(function(e) { return e[1] > 0; }).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 3).map(function(e) { return e[0] + '(' + e[1] + '人)'; }).join('、');

  App.setText('wu-low-count', lowCount);
  App.setText('wu-low-rate', rate + '%');
  App.setText('wu-low-avg', lowAvg);
  var gapEl = document.getElementById('wu-low-gap');
  if (gapEl) { gapEl.textContent = (parseFloat(gap) >= 0 ? '+' : '') + gap; gapEl.className = parseFloat(gap) < 0 ? 'delta-down' : 'delta-up'; }
  App.setText('wu-low-upsell', upsellCount);
  App.setText('wu-low-missing', missingSorted || '无');

  // TOP列表
  var tbody = document.getElementById('wuLowUserTable');
  if (tbody) {
    var topList = lowUsers.sort(function(a, b) { return a.aw - b.aw; }).slice(0, 20);
    var h = '';
    if (topList.length === 0) {
      h = '<tr><td colspan="8" style="padding:20px;text-align:center;color:#94a3b8">✅ 当前筛选范围内所有用户宽度均 ≥ ' + threshold + '</td></tr>';
    } else {
      topList.forEach(function(u, i) {
        var hasStr = u.hasProds.slice(0, 4).join('、') + (u.hasProds.length > 4 ? '…' : '');
        var suggestProds = products.filter(function(p) { return u.hasProds.indexOf(p) < 0; }).slice(0, 2).join('、');
        var salesName = u.rows && u.rows.length > 0 ? (App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(u.rows[0].account) : u.rows[0].account) : '-';
        var teamName = u.teamList ? u.teamList.join('/') : '-';
        h += '<tr><td>' + (i + 1) + '</td><td><strong>' + App.escapeHtml(u.user) + '</strong></td>';
        h += '<td style="text-align:center;font-size:11px">' + App.escapeHtml(teamName) + '</td>';
        h += '<td style="text-align:center">' + u.acctCount + '</td>';
        h += '<td style="text-align:center;font-size:11px">' + App.escapeHtml(salesName) + '</td>';
        h += '<td style="text-align:center;font-weight:700;color:#2563eb">' + u.aw.toFixed(1) + '</td>';
        h += '<td style="font-size:11px;color:#6b7280">' + (hasStr || '-') + '</td>';
        h += '<td style="font-size:11px;color:#dc2626">' + (suggestProds || '-') + '</td></tr>';
      });
    }
    tbody.innerHTML = h;
  }

  // 柱状图
  setTimeout(function() {
    var deptBar = document.getElementById('chart-wu-low-dept');
    // 不可见时不渲染（避免0尺寸）
    if (deptBar && !deptBar.offsetParent) {
      if (App.charts._wuLowDept) { App.charts._wuLowDept.destroy(); App.charts._wuLowDept = null; }
      if (App.charts._wuLowGroup) { App.charts._wuLowGroup.destroy(); App.charts._wuLowGroup = null; }
      return;
    }
    if (deptBar) {
      if (App.charts._wuLowDept) App.charts._wuLowDept.destroy();
      var deptStats = [];
      App.DEPTS.forEach(function(dept) {
        var dg = App.GROUPS.filter(function(g) { return g.dept === dept.n; }).map(function(g) { return g.n; });
        var du = lowUsers.filter(function(u) { return u.teamList.some(function(t) { return dg.indexOf(t) >= 0; }); });
        deptStats.push({ n: dept.n, low: du.length });
      });
      if (state.team !== 'all') deptStats = deptStats.filter(function(d) { return d.n === state.team; });
      var dm = Math.max.apply(null, deptStats.map(function(d) { return d.low; }).concat([1]));
      App.charts._wuLowDept = new Chart(deptBar, {
        type: 'bar', plugins: [barLabelPlugin],
        data: { labels: deptStats.map(function(d) { return d.n; }), datasets: [{ data: deptStats.map(function(d) { return d.low; }), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, layout: { padding: { top: 16 } },
          scales: { x: { ticks: { maxRotation: 45, autoSkip: false, font: { size: 11, weight: 'bold' } } }, y: { beginAtZero: true, max: Math.ceil(dm * 1.3), ticks: { precision: 0, font: { size: 12 } }, title: { display: true, text: '用户数', font: { size: 13, weight: 'bold' } } } }
        }
      });
    }
    var grpBar = document.getElementById('chart-wu-low-group');
    if (grpBar) {
      if (App.charts._wuLowGroup) App.charts._wuLowGroup.destroy();
      var grpStats = [];
      App.GROUPS.forEach(function(grp) {
        var gu = lowUsers.filter(function(u) { return u.teamList.indexOf(grp.n) >= 0; });
        grpStats.push({ n: grp.n, low: gu.length });
      });
      if (state.team !== 'all') grpStats = grpStats.filter(function(g) { var gi = App.GROUPS.find(function(gr) { return gr.n === g.n; }); return gi && gi.dept === state.team; });
      if (state.group !== 'all') grpStats = grpStats.filter(function(g) { return g.n === state.group; });
      var showGrps = grpStats;
      var gm = Math.max.apply(null, showGrps.map(function(g) { return g.low; }).concat([1]));
      App.charts._wuLowGroup = new Chart(grpBar, {
        type: 'bar', plugins: [barLabelPlugin],
        data: { labels: showGrps.map(function(g) { return g.n; }), datasets: [{ data: showGrps.map(function(g) { return g.low; }), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, layout: { padding: { top: 16 } },
          scales: { x: { ticks: { maxRotation: 60, autoSkip: false, font: { size: 10, weight: 'bold' } } }, y: { beginAtZero: true, max: Math.ceil(gm * 1.3), ticks: { precision: 0, font: { size: 12 } }, title: { display: true, text: '用户数', font: { size: 13, weight: 'bold' } } } }
        }
      });
    }
  }, 50);

  // 点击查看明细
  if (showDetail && lowCount > 0) {
    var title = '低宽度用户明细（宽度 < ' + threshold + '，共 ' + lowCount + ' 人）';
    var bodyHtml = '<div style="overflow-x:auto;max-width:100%"><table class="modal-table"><thead><tr><th>用户名称</th><th style="text-align:center">关联客户</th><th style="text-align:center">用户宽度</th><th style="text-align:center">最大宽度</th><th>已有产品</th></tr></thead><tbody>';
    lowUsers.slice(0, 300).forEach(function(u) {
      bodyHtml += '<tr><td><strong>' + App.escapeHtml(u.user) + '</strong></td><td style="text-align:center">' + u.acctCount + '</td><td style="text-align:center;font-weight:700;color:#2563eb">' + u.aw.toFixed(1) + '</td><td style="text-align:center">' + u.mw + '</td><td style="font-size:11px;color:#6b7280">' + u.hasProds.slice(0, 8).join('、') + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';
    App.showModal(title, bodyHtml);
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
  page: 1,
  PAGE_SIZE: 20,

  // 切换维度 tab
  switchDim: function(d) {
    App.WidthDetail.dim = d;
    App.WidthDetail.page = 1;
    // 更新 tab active 样式
    document.querySelectorAll('#page-width [data-d]').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.querySelector('#page-width [data-d="' + d + '"]');
    if (activeTab) activeTab.classList.add('active');
    App.WidthDetail.render();
  },

  // 获取当前维度数据（聚合 + 筛选 + 排序）
  getData: function() {
    var dim = App.WidthDetail.dim;
    var data = App.WidthDetail.aggregateData(dim);

    // 页级筛选 — 跟随顶栏 部门→组→个人 三级联动
    var pageState = App.getFilterState ? App.getFilterState('page-width') : { team: 'all', group: 'all', person: 'all' };

    // 部门维度: 如果选了具体部门，只显示该部门
    if (dim === 'dept' && pageState.team !== 'all') {
      data = data.filter(function(d) { return d.n === pageState.team; });
    }

    // 组维度: 部门筛选 → 组筛选 两级
    if (dim === 'group') {
      if (pageState.team !== 'all') {
        data = data.filter(function(d) { return d.dept === pageState.team; });
      }
      if (pageState.group !== 'all') {
        data = data.filter(function(d) { return d.n === pageState.group; });
      }
    }

    // 个人维度: 部门 → 组 → 个人 三级
    if (dim === 'person') {
      if (pageState.team !== 'all') {
        // 选了部门 → 只看该部门下各组的成员
        var deptGroupNames = App.GROUPS.filter(function(g) { return g.dept === pageState.team; }).map(function(g) { return g.n; });
        data = data.filter(function(d) { return deptGroupNames.indexOf(d.team) >= 0; });
      }
      if (pageState.group !== 'all') {
        data = data.filter(function(d) { return d.team === pageState.group; });
      }
      if (pageState.person !== 'all') {
        data = data.filter(function(d) { return d.n === pageState.person || d.displayName === pageState.person; });
      }
    }

    // 搜索过滤（支持中文名、账号、部门名）
    var searchEl = document.getElementById('wTeamSearch');
    var search = (searchEl && searchEl.value || '').trim().toLowerCase();
    if (search) {
      data = data.filter(function(d) {
        return (d.n || '').toLowerCase().indexOf(search) >= 0 ||
               (d.displayName || '').toLowerCase().indexOf(search) >= 0 ||
               (d.dept || '').toLowerCase().indexOf(search) >= 0 ||
               (d.team || '').toLowerCase().indexOf(search) >= 0;
      });
    }

    // 宽度上限过滤
    var maxWidthEl = document.getElementById('wTeamMaxWidth');
    var maxWidth = parseInt(maxWidthEl && maxWidthEl.value);
    if (!isNaN(maxWidth) && maxWidth > 0) {
      data = data.filter(function(d) { return d.aw < maxWidth; });
    }

    // 排序（默认顺序 = 与筛选下拉顺序一致，不重排）
    var sortEl = document.getElementById('wTeamSort');
    var sortBy = sortEl ? sortEl.value : 'default';
    if (sortBy === 'width_desc') {
      data.sort(function(a, b) { return b.aw - a.aw; });
    } else if (sortBy === 'width_asc') {
      data.sort(function(a, b) { return a.aw - b.aw; });
    } else if (sortBy === 'guishang_desc') {
      data.sort(function(a, b) { return b.gs - a.gs; });
    } else if (sortBy === 'customers_desc') {
      data.sort(function(a, b) { return b.cw - a.cw; });
    } else if (sortBy === 'coverage_desc') {
      data.sort(function(a, b) { return b.cov - a.cov; });
    }
    // 默认顺序：保持聚合数据的原始顺序（与 DEPTS / GROUPS 下拉一致）

    return data;
  },

  // 渲染 yoy 徽章
  yoyBadge: function(yoy) {
    var s = String(yoy || '0%');
    if (s.charAt(0) === '+') return '<span class="badge b-up">' + s + '</span>';
    if (s.charAt(0) === '-') return '<span class="badge b-down">' + s + '</span>';
    return '<span class="badge b-flat">' + s + '</span>';
  },

  // 显示非规上客户明细弹窗
  // 弹窗：查看客户明细（规上/非规上通用）
  _showDetailModal: function(entityName, type, gsFilter) {
    var raw = App.WidthCustomer.RAW;
    var label = gsFilter === 1 ? '规上' : '非规上';
    var filtered;
    if (type === 'dept') {
      var deptGroups = App.GROUPS.filter(function(g) { return g.dept === entityName; }).map(function(g) { return g.n; });
      filtered = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0 && r.guishang === gsFilter; });
    } else if (type === 'group') {
      filtered = raw.filter(function(r) { return r.team === entityName && r.guishang === gsFilter; });
    } else {
      filtered = raw.filter(function(r) { return r.account === entityName && r.guishang === gsFilter; });
    }

    var products = App.WidthDetail.PRODUCTS;
    var title = label + '客户明细 — ' + entityName + '（共 ' + filtered.length + ' 条）';
    var bodyHtml = '';

    if (!filtered.length) {
      bodyHtml = '<div class="info-msg">该范围内无' + label + '客户数据</div>';
      App.showModal(title, bodyHtml);
      return;
    }

    // 部门/组维度：先按账号汇总
    if (type === 'dept' || type === 'group') {
      var accMap = {};
      filtered.forEach(function(r) {
        var a = r.account || '(未填写)';
        if (!accMap[a]) accMap[a] = { account: a, rows: [] };
        accMap[a].rows.push(r);
      });
      var accRows = Object.values(accMap).sort(function(a, b) { return b.rows.length - a.rows.length; });
      bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 按销售人员分组统计</div>';
      bodyHtml += '<table class="modal-table" style="margin-bottom:14px"><thead><tr><th>销售</th><th>' + label + '客户数</th><th>平均宽度</th></tr></thead><tbody>';
      accRows.forEach(function(a) {
        var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
        var accDispName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
        bodyHtml += '<tr><td><strong>' + App.escapeHtml(accDispName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
      });
      bodyHtml += '</tbody></table></div>';
    }

    // 客户明细表（全部产品列）
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细（共 ' + filtered.length + ' 条）</div>';
    bodyHtml += '<table class="modal-table"><thead><tr><th>团队</th><th>销售</th><th>最终用户</th><th>产品宽度</th>';
    products.forEach(function(p) {
      bodyHtml += '<th title="' + p + '" style="min-width:34px">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 200;
    filtered.slice(0, maxRows).forEach(function(r) {
      bodyHtml += '<tr>';
      bodyHtml += '<td>' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td>' + App.escapeHtml(r.account || '') + '</td>';
      bodyHtml += '<td><strong>' + App.escapeHtml(r.user || '') + '</strong></td>';
      bodyHtml += '<td class="avg-num">' + r.width + '</td>';
      products.forEach(function(p) {
        var has = r.prods && r.prods[p] === 1;
        bodyHtml += '<td style="text-align:center;color:' + (has ? '#059669' : '#d1d5db') + '">' + (has ? '✓' : '-') + '</td>';
      });
      bodyHtml += '</tr>';
    });
    if (filtered.length > maxRows) {
      bodyHtml += '<tr><td colspan="' + (4 + products.length) + '" style="text-align:center;color:#9ca3af;padding:10px">还有 ' + (filtered.length - maxRows) + ' 条数据，请导出查看完整明细</td></tr>';
    }
    bodyHtml += '</tbody></table></div>';

    // 导出按钮
    var footerHtml = '<button class="btn-primary" onclick="App.WidthDetail._exportDetailCSV()" style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px">📥 导出明细</button>';
    // 暂存数据供导出使用
    App.WidthDetail._detailCache = filtered;
    App.WidthDetail._detailLabel = label;

    App.showModal(title, bodyHtml, footerHtml);
  },

  // 导出当前弹窗明细为 CSV
  _exportDetailCSV: function() {
    var data = App.WidthDetail._detailCache || [];
    if (!data.length) return;
    var products = App.WidthDetail.PRODUCTS;
    var label = App.WidthDetail._detailLabel || '明细';
    var headers = ['团队', 'CRM账号', '最终用户', '产品宽度', '是否规上'].concat(products);
    var csv = '﻿' + headers.join(',') + '\n';
    data.forEach(function(r) {
      var row = [
        '"' + (r.team || '') + '"',
        '"' + (r.account || '') + '"',
        '"' + (r.user || '') + '"',
        r.width,
        r.guishang === 1 ? '规上' : '非规上'
      ];
      products.forEach(function(p) {
        row.push(r.prods && r.prods[p] === 1 ? '有' : '无');
      });
      csv += row.join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '产品宽度_' + label + '客户明细_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  showNonGuishangDetail: function(entityName, type) {
    App.WidthDetail._showDetailModal(entityName, type, 0);
  },

  showGuishangDetail: function(entityName, type) {
    App.WidthDetail._showDetailModal(entityName, type, 1);
  },

  // 点击客均宽度 → 查看全部客户明细（不限规上/非规上）
  showWidthDetail: function(entityName, type) {
    var raw = App.WidthCustomer.RAW;
    var products = App.WidthDetail.PRODUCTS;
    var filtered;
    if (type === 'dept') {
      var deptGroups = App.GROUPS.filter(function(g) { return g.dept === entityName; }).map(function(g) { return g.n; });
      filtered = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
    } else if (type === 'group') {
      filtered = raw.filter(function(r) { return r.team === entityName; });
    } else {
      filtered = raw.filter(function(r) { return r.account === entityName; });
    }

    var title = '全部客户明细 — ' + entityName + '（共 ' + filtered.length + ' 条）';
    var bodyHtml = '';

    if (!filtered.length) {
      bodyHtml = '<div class="info-msg">该范围内暂无客户数据</div>';
      App.showModal(title, bodyHtml);
      return;
    }

    // 部门/组维度：先按账号汇总
    if (type === 'dept' || type === 'group') {
      var accMap = {};
      filtered.forEach(function(r) {
        var a = r.account || '(未填写)';
        if (!accMap[a]) accMap[a] = { account: a, rows: [] };
        accMap[a].rows.push(r);
      });
      var accRows = Object.values(accMap).sort(function(a, b) { return b.rows.length - a.rows.length; });
      bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 按销售人员分组统计</div>';
      bodyHtml += '<table class="modal-table" style="margin-bottom:14px"><thead><tr><th>销售</th><th>客户数</th><th>平均宽度</th><th>规上</th><th>非规上</th></tr></thead><tbody>';
      accRows.forEach(function(a) {
        var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
        var gs = a.rows.filter(function(r) { return r.guishang === 1; }).length;
        var ngs = a.rows.filter(function(r) { return r.guishang === 0; }).length;
        var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
        bodyHtml += '<tr><td><strong>' + App.escapeHtml(displayName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td><td><span class="badge-gs">' + gs + '</span></td><td><span class="badge-ngs">' + ngs + '</span></td></tr>';
      });
      bodyHtml += '</tbody></table></div>';
    }

    // 客户明细表
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细（共 ' + filtered.length + ' 条）</div>';
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table"><thead><tr><th>团队</th><th>销售</th><th>最终用户</th><th>产品宽度</th><th>规上</th>';
    products.forEach(function(p) {
      bodyHtml += '<th title="' + p + '" style="min-width:34px">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 200;
    filtered.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td>' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td>' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td><strong>' + App.escapeHtml(r.user || '') + '</strong></td>';
      bodyHtml += '<td class="avg-num">' + r.width + '</td>';
      bodyHtml += '<td style="text-align:center">' + (r.guishang === 1 ? '<span class="badge-gs">规上</span>' : '<span class="badge-ngs" style="text-decoration:none;cursor:default">非规上</span>') + '</td>';
      products.forEach(function(p) {
        var has = r.prods && r.prods[p] === 1;
        bodyHtml += '<td style="text-align:center;color:' + (has ? '#059669' : '#d1d5db') + '">' + (has ? '✓' : '-') + '</td>';
      });
      bodyHtml += '</tr>';
    });
    if (filtered.length > maxRows) {
      bodyHtml += '<tr><td colspan="' + (5 + products.length) + '" style="text-align:center;color:#9ca3af;padding:10px">还有 ' + (filtered.length - maxRows) + ' 条数据，请导出查看完整明细</td></tr>';
    }
    bodyHtml += '</tbody></table></div>';

    // 暂存导出数据
    App.WidthDetail._detailCache = filtered;
    App.WidthDetail._detailLabel = '全部';
    var footerHtml = '<button class="btn-primary" onclick="App.WidthDetail._exportDetailCSV()" style="padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px">📥 导出明细</button>';

    App.showModal(title, bodyHtml, footerHtml);
  },

  // 导出当前视图数据
  export: function() {
    var data = App.WidthDetail.getData();
    var dim = App.WidthDetail.dim;
    var products = App.WidthDetail.PRODUCTS;
    var labelMap = { dept: '部门', group: '组', person: '个人' };
    var dimLabel = labelMap[dim] || '实体';

    var rows = data.map(function(r) {
      var obj = {};
      obj[dimLabel] = r.n;
      if (dim === 'group') obj['所属部门'] = r.dept || '';
      if (dim === 'person') obj['所属团队'] = r.team || '';
      obj['客户数'] = r.cw;
      obj['平均宽度'] = r.aw.toFixed(2);
      obj['最大宽度'] = r.mw;
      obj['规上数'] = r.gs;
      obj['非规上数'] = r.ngs;
      obj['覆盖率%'] = r.cov.toFixed(1);
      products.forEach(function(p) {
        var idx = products.indexOf(p);
        obj[p + '(覆盖数)'] = r.prodCnt ? r.prodCnt[idx] || 0 : 0;
      });
      return obj;
    });

    // 简单的CSV导出（无需xlsx库）
    var headers = Object.keys(rows[0] || {});
    var csv = '﻿' + headers.join(',') + '\n';
    rows.forEach(function(row) {
      csv += headers.map(function(h) {
        var v = String(row[h] !== undefined ? row[h] : '');
        return v.indexOf(',') >= 0 || v.indexOf('"') >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '产品宽度_' + dimLabel + '维度_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  // 主渲染函数
  render: function() {
    var data = App.WidthDetail.getData();
    var dim = App.WidthDetail.dim;
    var page = App.WidthDetail.page;
    var pageSize = App.WidthDetail.PAGE_SIZE;
    var products = App.WidthDetail.PRODUCTS;
    var maxProd = products.length;

    // 分页
    var total = data.length;
    var totalPages = Math.ceil(total / pageSize);
    if (page > totalPages && totalPages > 0) {
      App.WidthDetail.page = totalPages;
      page = totalPages;
    }
    var start = (page - 1) * pageSize;
    var paged = data.slice(start, start + pageSize);

    // 构建表头
    var headHtml = '<tr>';
    headHtml += '<th style="width:32px">#</th>';
    if (dim === 'group') headHtml += '<th class="team-col">组名</th><th style="text-align:center;min-width:70px">所属部门</th>';
    else if (dim === 'person') headHtml += '<th class="team-col">姓名(账号)</th><th style="text-align:center;min-width:80px">所属团队</th>';
    else headHtml += '<th class="team-col">部门</th>';
    headHtml += '<th style="text-align:center">客户数</th>';
    headHtml += '<th style="text-align:center">客均宽度</th>';
    headHtml += '<th style="text-align:center">最大宽度</th>';
    headHtml += '<th style="text-align:center">规上</th>';
    headHtml += '<th style="text-align:center">非规上</th>';
    headHtml += '<th style="text-align:center">覆盖率</th>';
    headHtml += '<th style="text-align:center">同比</th>';
    // 产品列
    products.forEach(function(p) {
      headHtml += '<th title="' + p + '">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    headHtml += '</tr>';

    var thead = document.getElementById('wTeamDimHead');
    if (thead) thead.innerHTML = headHtml;

    // 构建表体（扁平表格，无钻取）
    var h = '';
    paged.forEach(function(r, i) {
      var globalIdx = start + i;
      var rankClass = globalIdx < 3 ? 'rn rn' + (globalIdx + 1) : 'rn rn0';
      var pct = maxProd > 0 ? (r.aw / maxProd * 100) : 0;

      h += '<tr>';
      h += '<td><span class="' + rankClass + '">' + (globalIdx + 1) + '</span></td>';

      // 名称列
      if (dim === 'group') {
        h += '<td class="team-name">' + App.escapeHtml(r.n) + '</td>';
        h += '<td style="text-align:center;font-size:11px;color:#6b7280">' + App.escapeHtml(r.dept || '') + '</td>';
      } else if (dim === 'person') {
        var personLabel = (r.displayName && r.displayName !== r.n) ? r.displayName + ' <span style="font-size:10px;color:#94a3b8">(' + App.escapeHtml(r.n) + ')</span>' : App.escapeHtml(r.n);
        h += '<td class="team-name">' + personLabel + '</td>';
        h += '<td style="text-align:center;font-size:11px;color:#6b7280">' + App.escapeHtml(r.team || '') + '</td>';
      } else {
        h += '<td class="team-name">' + App.escapeHtml(r.n) + '</td>';
      }

      // 客户数
      h += '<td style="text-align:center">' + r.cw + '</td>';

      // 实体名编码（供后续点击事件使用）
      var entityEnc = App.escapeHtml(r.n).replace(/'/g, "\\'");

      // 客均宽度（带进度条，可点击查看全部客户明细）
      h += '<td style="text-align:center;cursor:pointer" onclick="App.WidthDetail.showWidthDetail(\'' + entityEnc + '\',\'' + dim + '\')" title="点击查看全部客户明细"><div class="width-bar-wrap"><div class="width-bar"><div class="width-bar-fill" style="width:' + pct + '%"></div></div><span class="width-num">' + r.aw.toFixed(1) + '</span></div></td>';

      // 最大宽度
      h += '<td style="text-align:center">' + r.mw + '</td>';

      // 规上数（可点击查看明细）
      h += '<td style="text-align:center"><span class="badge-gs" style="cursor:pointer;text-decoration:underline" onclick="App.WidthDetail.showGuishangDetail(\'' + entityEnc + '\',\'' + dim + '\')" title="点击查看规上客户明细">' + r.gs + '</span></td>';

      // 非规上数（可点击查看明细）
      h += '<td style="text-align:center"><span class="badge-ngs" onclick="App.WidthDetail.showNonGuishangDetail(\'' + entityEnc + '\',\'' + dim + '\')" title="点击查看非规上客户明细">' + r.ngs + '</span></td>';

      // 覆盖率
      h += '<td style="text-align:center;font-weight:600;color:#059669">' + (r.cov != null ? r.cov.toFixed(1) + '%' : '-') + '</td>';

      // 同比变化
      h += '<td style="text-align:center">' + App.WidthDetail.yoyBadge(r.yoy || '0%') + '</td>';

      // 产品列
      r.prodCnt.forEach(function(c) {
        if (c > 0) {
          h += '<td class="prod-cell">✓ <span style="font-size:10px;color:#059669">' + c + '</span></td>';
        } else {
          h += '<td class="prod-cell empty">-</td>';
        }
      });

      h += '</tr>';
    });

    if (paged.length === 0) {
      var colspan = 2 + (dim !== 'dept' ? 1 : 0) + 7 + products.length;
      h += '<tr><td colspan="' + colspan + '" style="padding:24px;color:#94a3b8;font-size:13px;text-align:center">暂无匹配数据</td></tr>';
    }

    var tbody = document.getElementById('wTeamTable');
    if (tbody) tbody.innerHTML = h;

    // 渲染分页
    App.WidthDetail.renderPager(total, page);
  },

  // 分页渲染
  renderPager: function(total, current) {
    var container = document.getElementById('wTeamPager');
    if (!container) return;
    var pageSize = App.WidthDetail.PAGE_SIZE;
    var totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) {
      container.innerHTML = '<span class="page-info">共 ' + total + ' 条记录</span>';
      return;
    }
    var html = '<span class="page-info">共 ' + total + ' 条</span>';
    // 构建页码列表
    var pages = [];
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - current) <= 2) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    pages.forEach(function(p) {
      if (p === '...') {
        html += '<span class="page-btn disabled">…</span>';
      } else {
        html += '<button class="page-btn' + (p === current ? ' active' : '') + '" onclick="App.WidthDetail.goPage(' + p + ')">' + p + '</button>';
      }
    });
    container.innerHTML = html;
  },

  // 跳转页面
  goPage: function(p) {
    App.WidthDetail.page = p;
    App.WidthDetail.render();
    // 滚动到表头
    var table = document.getElementById('wTeamDimTable');
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // 筛选变更时刷新团队明细
  refresh: function() {
    App.WidthDetail.page = 1;
    App.WidthDetail.clearCache();
    App.WidthDetail.render();
  },

  // ===== 数据聚合方法 =====
  PRODUCTS: App.WidthCustomer ? App.WidthCustomer.PRODUCTS : [],

  productLabel: function(p) {
    return p.length > 4 ? p.substring(0, 4) + '…' : p;
  },

  _cache: {},

  clearCache: function() {
    App.WidthDetail._cache = {};
  },

  aggregateByTeam: function() {
    var raw = App.WidthCustomer.RAW;
    var products = App.WidthDetail.PRODUCTS;
    var zeroProds = products.map(function() { return 0; });

    // 从 RAW 聚合有数据的团队
    var teamDataMap = {};
    raw.forEach(function(r) {
      var t = r.team || '(未分组)';
      if (!teamDataMap[t]) {
        teamDataMap[t] = { rows: [], accounts: {} };
      }
      teamDataMap[t].rows.push(r);
      teamDataMap[t].accounts[r.account] = true;
    });

    function buildTeamRow(teamName, rows) {
      var widths = rows.map(function(r) { return r.width; });
      var avgW = rows.length ? widths.reduce(function(s, w) { return s + w; }, 0) / rows.length : 0;
      var maxW = rows.length ? Math.max.apply(null, widths) : 0;
      var gs = rows.filter(function(r) { return r.guishang === 1; }).length;
      var ngs = rows.filter(function(r) { return r.guishang === 0; }).length;
      var acctSet = {};
      rows.forEach(function(r) { acctSet[r.account] = true; });
      var accts = Object.keys(acctSet).length;
      var prodCnt = products.map(function(p) {
        return rows.filter(function(r) { return r.prods && r.prods[p] === 1; }).length;
      });
      var grpInfo = App.GROUPS.find(function(g) { return g.n === teamName; });
      var dept = grpInfo ? grpInfo.dept : '';
      return {
        n: teamName, dept: dept, type: 'group',
        cw: rows.length, accts: accts, aw: avgW, mw: maxW,
        gs: gs, ngs: ngs,
        cov: products.length > 0 ? (prodCnt.filter(function(c) { return c > 0; }).length / products.length * 100) : 0,
        prodCnt: prodCnt,
        yoy: grpInfo ? grpInfo.yoy : '0%'
      };
    }

    // 1) 先插入所有 GROUPS 中的团队（含无 RAW 数据的团队，显示为 0）
    var seenTeams = {};
    var result = [];
    App.GROUPS.forEach(function(g) {
      seenTeams[g.n] = true;
      var tm = teamDataMap[g.n];
      if (tm) {
        result.push(buildTeamRow(g.n, tm.rows));
      } else {
        // 无 RAW 数据的团队，全部填 0 / '-'
        result.push({
          n: g.n, dept: g.dept, type: 'group',
          cw: 0, accts: 0, aw: 0, mw: 0,
          gs: 0, ngs: 0,
          cov: 0, prodCnt: zeroProds.slice(),
          yoy: g.yoy || '0%'
        });
      }
    });

    // 2) RAW 中有但 GROUPS 里没有的（比如历史数据残留），也追加
    Object.keys(teamDataMap).forEach(function(teamName) {
      if (!seenTeams[teamName]) {
        var tm = teamDataMap[teamName];
        result.push(buildTeamRow(teamName, tm.rows));
      }
    });

    return result;
  },

  aggregateByDept: function() {
    var teamData = App.WidthDetail.aggregateByTeam();
    var products = App.WidthDetail.PRODUCTS;
    var zeroProds = products.map(function() { return 0; });

    // 按部门分组 teamData
    var deptTeamMap = {};
    teamData.forEach(function(t) {
      var d = t.dept || '(未分类)';
      if (!deptTeamMap[d]) deptTeamMap[d] = [];
      deptTeamMap[d].push(t);
    });

    var result = [];
    var seenDepts = {};

    // 1) 先遍历所有 DEPTS，确保每个部门都出现
    App.DEPTS.forEach(function(deptInfo) {
      var dn = deptInfo.n;
      seenDepts[dn] = true;
      var teams = deptTeamMap[dn] || [];

      // 汇总该部门所有团队的原始数据行
      var allRows = [];
      teams.forEach(function(t) {
        var rows = App.WidthCustomer.RAW.filter(function(r) { return r.team === t.n; });
        allRows = allRows.concat(rows);
      });

      var widths = allRows.map(function(r) { return r.width; });
      var avgW = allRows.length ? widths.reduce(function(s, w) { return s + w; }, 0) / allRows.length : 0;
      var maxW = allRows.length ? Math.max.apply(null, widths) : 0;
      var gs = allRows.filter(function(r) { return r.guishang === 1; }).length;
      var ngs = allRows.filter(function(r) { return r.guishang === 0; }).length;
      var acctSet = {};
      allRows.forEach(function(r) { acctSet[r.account] = true; });
      var prodCnt = allRows.length > 0
        ? products.map(function(p) { return allRows.filter(function(r) { return r.prods && r.prods[p] === 1; }).length; })
        : zeroProds.slice();

      result.push({
        n: dn, dept: '', type: 'dept',
        teamCount: teams.length,
        cw: allRows.length, accts: Object.keys(acctSet).length,
        aw: avgW, mw: maxW, gs: gs, ngs: ngs,
        cov: products.length > 0 ? (prodCnt.filter(function(c) { return c > 0; }).length / products.length * 100) : 0,
        prodCnt: prodCnt,
        yoy: deptInfo.yoy || '0%'
      });
    });

    // 2) teamData 中有但 DEPTS 中没有的（兜底），也追加
    Object.keys(deptTeamMap).forEach(function(dn) {
      if (!seenDepts[dn] && dn !== '(未分类)') {
        var teams = deptTeamMap[dn];
        var allRows = [];
        teams.forEach(function(t) {
          var rows = App.WidthCustomer.RAW.filter(function(r) { return r.team === t.n; });
          allRows = allRows.concat(rows);
        });
        var widths = allRows.map(function(r) { return r.width; });
        var avgW = allRows.length ? widths.reduce(function(s, w) { return s + w; }, 0) / allRows.length : 0;
        var maxW = allRows.length ? Math.max.apply(null, widths) : 0;
        var gs = allRows.filter(function(r) { return r.guishang === 1; }).length;
        var ngs = allRows.filter(function(r) { return r.guishang === 0; }).length;
        var acctSet = {};
        allRows.forEach(function(r) { acctSet[r.account] = true; });
        var prodCnt = products.map(function(p) { return allRows.filter(function(r) { return r.prods && r.prods[p] === 1; }).length; });
        result.push({
          n: dn, dept: '', type: 'dept',
          teamCount: teams.length,
          cw: allRows.length, accts: Object.keys(acctSet).length,
          aw: avgW, mw: maxW, gs: gs, ngs: ngs,
          cov: products.length > 0 ? (prodCnt.filter(function(c) { return c > 0; }).length / products.length * 100) : 0,
          prodCnt: prodCnt,
          yoy: '0%'
        });
      }
    });

    return result;
  },

  aggregateByPerson: function() {
    var raw = App.WidthCustomer.RAW;
    var products = App.WidthDetail.PRODUCTS;
    var accMap = {};
    raw.forEach(function(r) {
      var a = r.account || '(未填写)';
      if (!accMap[a]) accMap[a] = { rows: [], team: r.team };
      accMap[a].rows.push(r);
    });
    var result = [];
    Object.keys(accMap).forEach(function(acc) {
      var am = accMap[acc];
      var rows = am.rows;
      var widths = rows.map(function(r) { return r.width; });
      var avgW = rows.length ? widths.reduce(function(s, w) { return s + w; }, 0) / rows.length : 0;
      var maxW = rows.length ? Math.max.apply(null, widths) : 0;
      var gs = rows.filter(function(r) { return r.guishang === 1; }).length;
      var ngs = rows.filter(function(r) { return r.guishang === 0; }).length;
      var prodCnt = products.map(function(p) {
        return rows.filter(function(r) { return r.prods && r.prods[p] === 1; }).length;
      });
      result.push({
        n: acc, displayName: (App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(acc) : acc), team: am.team, type: 'person',
        cw: rows.length, aw: avgW, mw: maxW, gs: gs, ngs: ngs,
        cov: products.length > 0 ? (prodCnt.filter(function(c) { return c > 0; }).length / products.length * 100) : 0,
        prodCnt: prodCnt,
        yoy: '0%'
      });
    });
    return result;
  },

  aggregateData: function(dim) {
    if (App.WidthDetail._cache[dim]) {
      return App.WidthDetail._cache[dim];
    }
    var data;
    if (dim === 'dept') {
      data = App.WidthDetail.aggregateByDept();
    } else if (dim === 'group') {
      data = App.WidthDetail.aggregateByTeam();
    } else {
      data = App.WidthDetail.aggregateByPerson();
    }
    App.WidthDetail._cache[dim] = data;
    return data;
  }
};

// ===== 产品宽度 — 客户维度：客户产品覆盖明细（跟随页级筛选） =====
App.WidthCustomer.shortProds = App.WidthCustomer.PRODUCTS;
App.WidthCustomer.prodMap = {};
App.WidthCustomer.PRODUCTS.forEach(function(p) { App.WidthCustomer.prodMap[p] = p; });

App.WidthCustomer.init = function() {
  App.WidthCustomer.render();
};

App.WidthCustomer.getFiltered = function() {
  var data = App.WidthCustomer.RAW.slice();

  // 页级筛选：自动跟随部门 → 组 → 个人
  var pageState = App.getFilterState('page-width');
  if (pageState.team !== 'all') {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === pageState.team; }).map(function(g) { return g.n; });
    data = data.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
  }
  if (pageState.group !== 'all') {
    data = data.filter(function(r) { return r.team === pageState.group; });
  }
  if (pageState.person !== 'all') {
    data = data.filter(function(r) { return r.account === pageState.person || (App.WidthCustomer.getDisplayName && App.WidthCustomer.getDisplayName(r.account) === pageState.person); });
  }

  // 子Tab独立筛选
  var gsFilter = (document.getElementById('wCustGsFilter') || {}).value || '';
  var search = ((document.getElementById('wCustSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('wCustSort') || {}).value || 'width_desc';

  if (gsFilter !== '') data = data.filter(function(r) { return String(r.guishang) === gsFilter; });
  if (search) data = data.filter(function(r) { return r.user.toLowerCase().indexOf(search) >= 0 || r.account.toLowerCase().indexOf(search) >= 0; });

  if (sort === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (sort === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });
  else if (sort === 'team') data.sort(function(a,b) { return a.team.localeCompare(b.team) || b.width - a.width; });

  return data;
};

App.WidthCustomer._custPage = 1;

App.WidthCustomer.getPageSize = function() {
  var sel = document.getElementById('wCustPageSize');
  return sel ? parseInt(sel.value) || 20 : 20;
};

App.WidthCustomer.goPage = function(p) {
  App.WidthCustomer._custPage = p;
  App.WidthCustomer.render();
};

App.WidthCustomer.render = function() {
  // 动态生成产品列表头（仅首次）
  var headEl = document.getElementById('wCustTableHead');
  if (headEl && headEl.getAttribute('data-init') !== '1') {
    headEl.setAttribute('data-init', '1');
    var headRow = headEl.querySelector('tr');
    App.WidthCustomer.PRODUCTS.forEach(function(p) {
      var th = document.createElement('th');
      th.style.textAlign = 'center';
      th.title = p;
      th.textContent = p.length > 6 ? p.substring(0, 5) + '…' : p;
      headRow.appendChild(th);
    });
  }
  var data = App.WidthCustomer.getFiltered();
  var maxW = App.WidthCustomer.PRODUCTS.length;
  var pageSize = App.WidthCustomer.getPageSize();
  var total = data.length;
  var currentPage = App.WidthCustomer._custPage || 1;
  var totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  if (currentPage > totalPages) { currentPage = totalPages; App.WidthCustomer._custPage = currentPage; }
  var start = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  var paged = pageSize > 0 ? data.slice(start, start + pageSize) : data;

  var html = '';

  var countEl = document.getElementById('w-cust-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  paged.forEach(function(r) {
    var pct = Math.round(r.width / maxW * 100);
    var barColor = r.guishang ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)';
    var gsBadge = r.guishang
      ? '<span class="badge badge-on">规上</span>'
      : '<span class="badge badge-off" style="cursor:pointer;text-decoration:underline" title="点击查看详情" onclick="App.WidthCustomer.showDetail(\'' + r.user.replace(/'/g,"\\'") + '\')">非规上</span>';

    html += '<tr>';
    html += '<td><strong>' + r.user + '</strong></td>';
    html += '<td>' + r.team + '</td>';
    var custDispName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
    html += '<td><span style="font-size:12px;font-weight:500">' + App.escapeHtml(custDispName) + '</span></td>';
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
    html = '<tr><td colspan="32" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('wCustTable');
  if (tbody) tbody.innerHTML = html;

  // 分页控件
  var pager = document.getElementById('wCustPager');
  if (pager && totalPages > 1) {
    var ph = '<span class="page-info">共 ' + total + ' 条</span>';
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
        ph += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="App.WidthCustomer.goPage(' + i + ')">' + i + '</button>';
      } else if (i === 2 || i === totalPages - 1) {
        ph += '<span class="page-btn disabled">…</span>';
      }
    }
    pager.innerHTML = ph;
  } else if (pager) {
    pager.innerHTML = '<span class="page-info">共 ' + total + ' 条</span>';
  }

  // 渲染优质/待提升客户列表
  var custState = App.getFilterState('page-width');
  var custWData = App.Data.getWidth(custState.team);
  var custSf = 1;
  if (custState.person !== 'all') custSf = 0.03;
  else if (custState.group !== 'all') custSf = 0.10;
  else if (custState.team !== 'all') custSf = 0.28;
  var cs = function(v) { return Math.round(v * custSf); };
  if (custWData) {
    App.renderCustList('w-tbody-cust-good', (custWData.custGood || []).slice(0, 10).map(function(c) {
      return { name: c.name, avgW: +(c.avgW * (custSf > 0.5 ? 1 : 0.8 + custSf)).toFixed(2), gsCnt: c.gsCnt, soldCnt: cs(c.soldCnt), person: c.person, sold: c.sold };
    }), true);
    App.renderCustList('w-tbody-cust-bad', (custWData.custBad || []).slice(0, 10).map(function(c) {
      return { name: c.name, avgW: +(c.avgW * (custSf > 0.5 ? 1 : 0.8 + custSf)).toFixed(2), gsCnt: c.gsCnt, soldCnt: cs(c.soldCnt), person: c.person, sold: c.sold };
    }), false);
  }
};

// ===== 团队维度 — 潜力产品 · 本期 vs 同期对照表 =====
App.WidthTeamMatrix._dim = 'group'; // dept | group | person
App.WidthTeamMatrix.setDim = function(dim) {
  App.WidthTeamMatrix._dim = dim;
  var btns = document.querySelectorAll('#p-cross-dim-btns .dim-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  App.WidthTeamMatrix.render();
};

App.WidthTeamMatrix.render = function() {
  var thead = document.getElementById('p-team-cross-thead');
  var tbody = document.getElementById('p-team-cross-tbody');
  if (!thead || !tbody) return;

  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var dim = App.WidthTeamMatrix._dim || 'group';
  var prods = App.WidthTeamMatrix.PRODUCTS;
  var raw = App.WidthTeamMatrix.RAW;

  // ── 与差距看板一致的筛选自动下钻 ──
  if (team !== 'all' && group === 'all' && person === 'all') { dim = 'dept'; App.WidthTeamMatrix._dim = 'dept'; }
  else if (group !== 'all' && person === 'all') { dim = 'group'; App.WidthTeamMatrix._dim = 'group'; }
  else if (person !== 'all') { dim = 'person'; App.WidthTeamMatrix._dim = 'person'; }
  // 同步按钮
  var btns = document.querySelectorAll('#p-cross-dim-btns .dim-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });

  function shortLabel(str, maxLen) {
    maxLen = maxLen || 5;
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  }

  // ── 解析并过滤 ──
  var rows = [];
  raw.forEach(function(d) {
    var parts = d.team.split('-');
    var grpName = parts[0] || d.team;
    var subName = parts[1] || '';
    var gInfo = App.GROUPS.find(function(g) { return g.n === grpName; });
    var deptName = gInfo ? gInfo.dept : '';

    if (team !== 'all' && deptName !== team) return;
    if (group !== 'all' && grpName !== group) return;
    if (person !== 'all' && d.team.indexOf(person) < 0) return;

    rows.push({ dept: deptName, grp: grpName, sub: subName, team: d.team, product: d.product, amount: d.amount, amountPrev: d.amountPrev });
  });

  // ── 聚合 ──
  var agg = {};
  var dimKey = dim === 'dept' ? 'dept' : (dim === 'group' ? 'grp' : 'team');

  // 先预填所有部门/小组（无数据也显示为0）
  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      agg[d.n] = { label: d.n, dept: d.n, grp: '', totalCur: 0, totalPrev: 0, prods: {} };
    });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) {
      if (team !== 'all' && g.dept !== team) return;
      if (group !== 'all' && g.n !== group) return;
      agg[g.n] = { label: g.n, dept: g.dept, grp: g.n, totalCur: 0, totalPrev: 0, prods: {} };
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      // 用 姓名 作为key，方便和RAW数据匹配
      var key = (p.grp || '') + '-' + p.n;
      if (!agg[key]) agg[key] = { label: p.n, dept: p.dept || '', grp: p.grp || '', totalCur: 0, totalPrev: 0, prods: {} };
    });
  }

  rows.forEach(function(d) {
    var key = d[dimKey] || d.team;
    var label = dim === 'person' ? (d.sub || key) : key;
    if (!agg[key]) agg[key] = { label: label, dept: d.dept, grp: d.grp, totalCur: 0, totalPrev: 0, prods: {} };
    if (!agg[key].prods[d.product]) agg[key].prods[d.product] = { amount: 0, amountPrev: 0 };
    agg[key].prods[d.product].amount += d.amount;
    agg[key].prods[d.product].amountPrev += d.amountPrev;
    agg[key].totalCur += d.amount;
    agg[key].totalPrev += d.amountPrev;
  });

  // ── 排序：按 App.DEPTS / App.GROUPS 顺序 ──
  var deptOrder = App.DEPTS.map(function(d) { return d.n; });
  var groupOrder = App.GROUPS.map(function(g) { return g.n; });
  var keys = Object.keys(agg).sort(function(a, b) {
    if (dim === 'dept') return deptOrder.indexOf(a) - deptOrder.indexOf(b);
    if (dim === 'group') return groupOrder.indexOf(a) - groupOrder.indexOf(b);
    // person: 按所属组排序
    var ga = agg[a], gb = agg[b];
    return (groupOrder.indexOf(ga.dept) - groupOrder.indexOf(gb.dept)) || a.localeCompare(b);
  });

  // ── 列显隐（与差距看板一致） ──
  var showDept = (group === 'all' && person === 'all');
  var showGrp  = (dim === 'group' || dim === 'person');

  // ── 表头 ──
  var thHtml = '<tr>';
  if (showDept) thHtml += '<th>部门</th>';
  if (showGrp) thHtml += '<th>组</th>';
  if (dim === 'person') thHtml += '<th>个人</th>';
  thHtml += prods.map(function(p) { return '<th title="' + p + '">' + shortLabel(p, 5) + '</th>'; }).join('');
  thHtml += '<th>本期总计</th><th>同期总计</th><th>整体同比</th></tr>';
  thead.innerHTML = thHtml;

  // ── 表体 ──
  var bodyHtml = '';
  var grandCur = 0, grandPrev = 0;
  keys.forEach(function(key) {
    var a = agg[key];
    var rowCur = 0, rowPrev = 0;
    var cells = '';
    prods.forEach(function(prod) {
      var v = a.prods[prod] || { amount: 0, amountPrev: 0 };
      rowCur += v.amount; rowPrev += v.amountPrev;
      var cls = 'cell-zero', display = '-', yoyStr = '';
      if (v.amount > 0 && v.amountPrev > 0) {
        var yoy = ((v.amount - v.amountPrev) / v.amountPrev * 100);
        cls = yoy >= 0 ? 'cell-up' : 'cell-down';
        yoyStr = '<span class="c-yoy ' + (yoy >= 0 ? 'c-yoy-up' : 'c-yoy-down') + '">' + (yoy >= 0 ? '▲+' : '▼') + yoy.toFixed(0) + '%</span>';
        display = '<strong>' + v.amount + '</strong><br>' + yoyStr;
      } else if (v.amount > 0 && v.amountPrev === 0) {
        cls = 'cell-new'; display = '<strong>' + v.amount + '</strong><br><span class="c-yoy c-yoy-new">+新增</span>';
      }
      cells += '<td class="' + cls + '">' + display + '</td>';
    });
    grandCur += rowCur; grandPrev += rowPrev;
    var rowYoy = rowPrev > 0 ? ((rowCur - rowPrev) / rowPrev * 100) : (rowCur > 0 ? 100 : 0);
    var rowCls = rowYoy >= 0 ? 'cell-up' : 'cell-down';

    // 行前列：部门 / 组 / 个人
    var preCols = '';
    if (showDept) preCols += '<td style="color:#1a56db;font-weight:600">' + a.dept + '</td>';
    if (showGrp) preCols += '<td style="font-weight:600">' + (dim === 'person' ? a.grp : a.label) + '</td>';
    if (dim === 'person') preCols += '<td>' + a.label + '</td>';

    bodyHtml += '<tr>' + preCols + cells +
      '<td><strong>' + rowCur + '</strong></td><td>' + rowPrev + '</td>' +
      '<td class="' + rowCls + '"><strong>' + (rowYoy >= 0 ? '+' : '') + rowYoy.toFixed(1) + '%</strong></td></tr>';
  });

  // 总计行
  var grandYoy = grandPrev > 0 ? ((grandCur - grandPrev) / grandPrev * 100) : (grandCur > 0 ? 100 : 0);
  var totalPreCols = '';
  if (showDept || showGrp || dim === 'person') totalPreCols = '<td' + (showDept || showGrp ? ' colspan="' + ((showDept?1:0)+(showGrp?1:0)+(dim==='person'?1:0)) + '"' : '') + '><strong>总计</strong></td>';
  bodyHtml += '<tr class="total-row">' + totalPreCols +
    prods.map(function(p) {
      var v = rows.filter(function(d) { return d.product === p; }).reduce(function(s, d) { return s + d.amount; }, 0);
      return '<td><strong>' + v + '</strong></td>';
    }).join('') +
    '<td><strong>' + grandCur + '</strong></td><td><strong>' + grandPrev + '</strong></td>' +
    '<td class="' + (grandYoy >= 0 ? 'cell-up' : 'cell-down') + '"><strong>' + (grandYoy >= 0 ? '+' : '') + grandYoy.toFixed(1) + '%</strong></td></tr>';

  tbody.innerHTML = bodyHtml;
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

// ===== 产品宽度 — 用户维度：用户产品覆盖明细 =====
App.WidthUser = {};
App.WidthUser.shortProds = App.WidthCustomer.PRODUCTS;
App.WidthUser.prodMap = {};
App.WidthCustomer.PRODUCTS.forEach(function(p) { App.WidthUser.prodMap[p] = p; });

App.WidthUser.init = function() {
  App.WidthUser.render();
};

App.WidthUser._userPage = 1;

App.WidthUser.getPageSize = function() {
  var sel = document.getElementById('wUserPageSize');
  return sel ? parseInt(sel.value) || 20 : 20;
};

App.WidthUser.goPage = function(p) {
  App.WidthUser._userPage = p;
  App.WidthUser.render();
};

App.WidthUser.getFiltered = function() {
  var data = App.WidthCustomer.RAW.slice();

  // 页级筛选：自动跟随部门 → 组 → 个人
  var pageState = App.getFilterState('page-width');
  if (pageState.team !== 'all') {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === pageState.team; }).map(function(g) { return g.n; });
    data = data.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
  }
  if (pageState.group !== 'all') {
    data = data.filter(function(r) { return r.team === pageState.group; });
  }
  if (pageState.person !== 'all') {
    data = data.filter(function(r) { return r.account === pageState.person || (App.WidthCustomer.getDisplayName && App.WidthCustomer.getDisplayName(r.account) === pageState.person); });
  }

  var gsFilter = (document.getElementById('wUserGsFilter') || {}).value || '';
  var search = ((document.getElementById('wUserSearch') || {}).value || '').trim().toLowerCase();
  var sort = (document.getElementById('wUserSort') || {}).value || 'width_desc';

  if (gsFilter !== '') data = data.filter(function(r) { return String(r.guishang) === gsFilter; });
  if (search) data = data.filter(function(r) { return r.user.toLowerCase().indexOf(search) >= 0 || r.account.toLowerCase().indexOf(search) >= 0; });

  if (sort === 'width_desc') data.sort(function(a,b) { return b.width - a.width; });
  else if (sort === 'width_asc') data.sort(function(a,b) { return a.width - b.width; });

  return data;
};

App.WidthUser.render = function() {
  // 动态生成产品列表头（仅首次）
  var headEl = document.getElementById('wUserTableHead');
  if (headEl && headEl.getAttribute('data-init') !== '1') {
    headEl.setAttribute('data-init', '1');
    var headRow = headEl.querySelector('tr');
    App.WidthCustomer.PRODUCTS.forEach(function(p) {
      var th = document.createElement('th');
      th.style.textAlign = 'center';
      th.title = p;
      th.textContent = p.length > 6 ? p.substring(0, 5) + '…' : p;
      headRow.appendChild(th);
    });
  }
  var data = App.WidthUser.getFiltered();
  var maxW = App.WidthCustomer.PRODUCTS.length;
  var pageSize = App.WidthUser.getPageSize();
  var total = data.length;
  var currentPage = App.WidthUser._userPage || 1;
  var totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  if (currentPage > totalPages) { currentPage = totalPages; App.WidthUser._userPage = currentPage; }
  var start = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  var paged = pageSize > 0 ? data.slice(start, start + pageSize) : data;

  var html = '';
  var countEl = document.getElementById('w-user-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  var nameMap = {};
  App.MOCK_USERS.forEach(function(u) { nameMap[u.username] = u.name; });

  paged.forEach(function(r) {
    var pct = Math.round(r.width / maxW * 100);
    var barColor = r.guishang ? 'linear-gradient(90deg,#2563eb,#60a5fa)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)';
    var gsBadge = r.guishang
      ? '<span class="badge badge-on">规上</span>'
      : '<span class="badge badge-off" style="cursor:pointer;text-decoration:underline" title="点击查看详情" onclick="App.WidthCustomer.showDetail(\'' + r.user.replace(/'/g,"\\'") + '\')">非规上</span>';
    var realName = nameMap[r.account] || r.account;

    html += '<tr>';
    html += '<td><strong>' + r.user + '</strong></td>';
    var userDispName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
    html += '<td>' + r.team + '</td>';
    html += '<td><span style="font-size:12px;font-weight:500">' + App.escapeHtml(userDispName) + '</span></td>';
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
    html = '<tr><td colspan="32" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('wUserTable');
  if (tbody) tbody.innerHTML = html;

  // 分页
  var pager = document.getElementById('wUserPager');
  if (pager && totalPages > 1) {
    var ph = '<span class="page-info">共 ' + total + ' 条</span>';
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
        ph += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="App.WidthUser.goPage(' + i + ')">' + i + '</button>';
      } else if (ph.slice(-8) !== 'disabled') {
        ph += '<span class="page-btn disabled">…</span>';
      }
    }
    pager.innerHTML = ph;
  } else if (pager) {
    pager.innerHTML = '<span class="page-info">共 ' + total + ' 条</span>';
  }
};


// ===== 潜力产品 — 总览分析：经营概述（商机预测版，跟随页级筛选） =====
App.renderPotentialOverview = function(state) {
  state = state || { team: 'all', group: 'all', person: 'all' };
  var dataTeam = state.team !== 'all' ? state.team : 'all';
  var data = App.Data.getPotential(dataTeam);
  if (!data) return;

  // 级联缩放
  var sf = 1;
  if (state.person !== 'all') sf = 0.03;
  else if (state.group !== 'all') sf = 0.10;
  else if (state.team !== 'all') sf = 0.28;

  var s = function(v) { return Math.round(v * sf); };

  var ov = data.overview;
  var deptRank = data.deptRank;
  var totalAmt = ov ? s(ov.sales) : s(9830);
  var totalPrev = ov ? s(ov.salesPrev) : s(7650);
  var prodCount = ov ? ov.productCount : 12;
  var custCount = ov ? ov.customerCount : 386;
  var deptCount = ov ? ov.deptCount : 4;
  var avgPrice = ov ? ov.avgPrice : 25.5;
  var yoyPct = totalPrev > 0 ? ((totalAmt - totalPrev) / totalPrev * 100).toFixed(1) : 0;

  // 风险数据
  var hiRisk = 2, mdRisk = 5, loRisk = 5;

  // 部门排名
  var dr = deptRank.slice().sort(function(a, b) { return b.sales - a.sales; });
  var maxSales = dr.length > 0 ? dr[0].sales : 1;
  var colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];
  var drh = '';
  dr.forEach(function(r, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    var yoyCls = r.yoy >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    var yoySign = r.yoy >= 0 ? '+' : '';
    var barColor = colors[i % colors.length];
    var pct = (r.sales / maxSales * 100).toFixed(0);
    drh += '<tr>' +
      '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + r.dept + '</strong><div style="font-size:10px;color:#94a3b8">' + (r.manager || '') + '</div></td>' +
      '<td style="text-align:right;font-weight:700;font-size:13px">¥' + r.sales.toLocaleString() + '<span style="font-size:10px;color:#94a3b8;font-weight:400">万</span></td>' +
      '<td style="text-align:center;' + yoyCls + ';font-weight:600">' + yoySign + r.yoy.toFixed(1) + '%</td>' +
      '<td><div class="ps-bar-wrap"><div class="ps-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div><span class="ps-bar-label">' + pct + '%</span></div></td>' +
      '</tr>';
  });
  var rankEl = document.getElementById('pOvDeptRank');
  if (rankEl) rankEl.innerHTML = drh;

};

// 产品风险分布 & 团队概况（p-team，跟随页级筛选）
App.renderTeamRiskPanel = function(state) {
  var el = document.getElementById('pTeamRiskPanel');
  if (!el) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var dataTeam = state.team !== 'all' ? state.team : 'all';
  var data = App.Data.getPotential(dataTeam);
  var deptRank = data ? data.deptRank : [];
  // 根据筛选缩小部门范围
  if (state.team !== 'all') {
    deptRank = deptRank.filter(function(d) { return d.dept === state.team || d.dept.indexOf(state.team) >= 0; });
  }
  var deptCount = deptRank.length || 1;
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
// ===== 潜力产品覆盖排名（部门/组/个人维度 + 分页） =====
App._sellerDim = 'person';
App._sellerPage = 1;
App._sellerPageSize = 20;

App.setSellerDim = function(dim) {
  App._sellerDim = dim;
  App._sellerPage = 1;
  var btns = document.querySelectorAll('#p-seller-dim-btns .dim-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  App.setText('p-seller-scope-tag', '按' + (dim==='dept'?'部门':dim==='group'?'小组':'个人'));
  App.renderSellerPotentialRank(App.getFilterState('page-potential'));
};

App.refreshSellerRank = function() {
  App._sellerPage = 1;
  App._sellerPageSize = parseInt((document.getElementById('p-seller-page-size')||{}).value) || 20;
  App.renderSellerPotentialRank(App.getFilterState('page-potential'));
};

App.renderSellerPotentialRank = function(state) {
  var tbody = document.getElementById('p-seller-rank-body');
  if (!tbody) return;
  state = state || App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var dim = App._sellerDim || 'person';

  if (team !== 'all' && group === 'all' && person === 'all') { dim = 'dept'; App._sellerDim = 'dept'; }
  else if (group !== 'all' && person === 'all') { dim = 'group'; App._sellerDim = 'group'; }
  else if (person !== 'all') { dim = 'person'; App._sellerDim = 'person'; }
  ['#p-seller-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });
  App.setText('p-seller-scope-tag', '按' + (dim==='dept'?'部门':dim==='group'?'小组':'个人'));

  var showDept = (group === 'all' && person === 'all');
  var showGrp  = (dim === 'group' || dim === 'person');
  var totalProds = App.ALL_POT_PRODUCTS.length;

  var rows = [];
  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var covPct = parseFloat(d.cov || 65);
      rows.push({ dept: d.n, grp: '', name: '', cw: d.cw, sales: Math.round(d.cw*42), prev: Math.round(d.cw*35), yoy: parseFloat(d.yoy||'5'), covered: Math.round(covPct/100*totalProds) });
    });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) {
      if (team !== 'all' && g.dept !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var covPct = parseFloat(g.cov || 65);
      rows.push({ dept: g.dept, grp: g.n, name: '', cw: g.cw, sales: (g.cw||80)*42, prev: (g.cw||80)*35, yoy: parseFloat(g.yoy||'5'), covered: Math.round(covPct/100*totalProds) });
    });
  } else {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var covPct = parseFloat(p.cov || 60);
      rows.push({ dept: p.dept||'-', grp: p.grp||'-', name: p.n, cw: p.cw||10, sales: (p.cw||15)*38, prev: (p.cw||15)*32, yoy: parseFloat(p.yoy||'3'), covered: Math.round(covPct/100*totalProds) });
    });
  }
  rows.sort(function(a, b) { return b.sales - a.sales; });

  var pageSize = App._sellerPageSize || 20;
  var totalRows = rows.length;
  var totalPages = Math.ceil(totalRows / pageSize);
  if (App._sellerPage > totalPages) App._sellerPage = totalPages || 1;
  var start = (App._sellerPage - 1) * pageSize;
  var pageRows = rows.slice(start, start + pageSize);
  App.setText('p-seller-total', '共 ' + totalRows + ' 条');

  function shortProd(p) { return p.length > 5 ? p.substring(0,5)+'…' : p; }

  var thead = document.getElementById('p-seller-thead');
  if (thead) {
    var thHtml = '<tr><th style="width:1%">#</th>';
    if (showDept) thHtml += '<th>部门</th>';
    if (showGrp) thHtml += '<th>组</th>';
    if (dim === 'person') thHtml += '<th>个人</th>';
    thHtml += '<th style="text-align:right;white-space:nowrap">销售额(万)</th><th style="text-align:right;white-space:nowrap">同期(万)</th><th style="text-align:center;white-space:nowrap">同比</th><th style="text-align:center;white-space:nowrap">覆盖/' + totalProds + '</th>';
    thHtml += '<th style="width:auto">覆盖 · 未覆盖产品</th>';
    thHtml += '</tr>';
    thead.innerHTML = thHtml;
  }

  tbody.innerHTML = pageRows.map(function(r, i) {
    var idx = start + i + 1;
    var rn = idx <= 3 ? 'rn' + idx : 'rn0';
    var yoyDisplay = (r.yoy >= 0 ? '+' : '') + r.yoy.toFixed(1) + '%';
    var yoyBadge = r.yoy > 10 ? 'b-up' : (r.yoy > 0 ? 'b-up' : (r.yoy > -5 ? 'b-warn' : 'b-down'));
    var clickTarget = dim === 'dept' ? r.dept : (dim === 'group' ? r.grp : r.name);
    var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : '');
    var clickHandler = clickFn ? 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"' : '';
    var cells = '';
    if (showDept) cells += '<td style="color:#1a56db;font-weight:600">' + r.dept + '</td>';
    if (showGrp) cells += '<td style="font-weight:600;color:#1a56db">' + r.grp + '</td>';
    if (dim === 'person') cells += '<td>' + r.name + '</td>';

    // 覆盖/未覆盖产品标签（折叠+悬浮）
    var hash = 0; for (var hi = 0; hi < (r.name || r.grp || r.dept).length; hi++) hash = ((hash << 5) - hash) + (r.name || r.grp || r.dept).charCodeAt(hi);
    var coveredProds = [], uncoveredProds = [];
    App.ALL_POT_PRODUCTS.forEach(function(p, pi) {
      if (Math.abs(hash + pi * 7) % totalProds < r.covered) coveredProds.push(p);
      else uncoveredProds.push(p);
    });
    var MAX_SHOW = 5;
    function makeChips(list, cls, showCount) {
      var show = list.slice(0, showCount);
      var rest = list.length - show.length;
      var html = show.map(function(p) { return '<span class="prod-chip ' + cls + '" title="' + p + '">' + shortProd(p) + '</span>'; }).join('');
      if (rest > 0) {
        var allTitles = list.join('、');
        html += ' <span class="prod-chip more" title="' + allTitles + '" style="background:#e5e7eb;color:#6b7280;cursor:help">+' + rest + '</span>';
      }
      return html;
    }
    var covChips = makeChips(coveredProds, 'covered', MAX_SHOW);
    var uncovChips = makeChips(uncoveredProds, 'uncovered', MAX_SHOW);
    var covDetailHtml = '<td style="padding:1px 3px;text-align:left;line-height:1.8;max-width:240px;overflow:hidden;font-size:10px">' +
      (coveredProds.length ? '<span class="pd-label pd-cov">✓覆盖<small>(' + coveredProds.length + ')</small></span>' + covChips + '<br>' : '') +
      (uncoveredProds.length ? '<span class="pd-label pd-uncov">✗未覆盖<small>(' + uncoveredProds.length + ')</small></span>' + uncovChips : '') +
      '</td>';
    return '<tr style="cursor:pointer" ' + clickHandler + '>' +
      '<td><span class="rn ' + rn + '">' + idx + '</span></td>' + cells +
      '<td style="text-align:right;font-weight:700;font-size:11px">' + r.sales.toLocaleString() + '</td>' +
      '<td style="text-align:right;color:#6b7280;font-size:11px">' + r.prev.toLocaleString() + '</td>' +
      '<td style="text-align:center"><span class="badge" style="font-size:10px">' + yoyDisplay + '</span></td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary);font-size:11px">' + r.covered + '/' + totalProds + '</td>' +
      covDetailHtml + '</tr>';
  }).join('');

  var pager = document.getElementById('p-seller-pager');
  if (pager && totalPages > 1) {
    var ph = '';
    for (var pg = 1; pg <= totalPages; pg++) {
      var activeCls = pg === App._sellerPage ? 'style="background:#1a56db;color:#fff;font-weight:700"' : 'style="cursor:pointer"';
      ph += '<button ' + activeCls + ' onclick="App._sellerPage=' + pg + ';App.renderSellerPotentialRank(App.getFilterState(&apos;page-potential&apos;))" style="margin:0 2px;padding:2px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:11px">' + pg + '</button>';
    }
    pager.innerHTML = ph;
  } else if (pager) { pager.innerHTML = ''; }
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
  var custTag = document.getElementById('p-import-cust-tag');
  var userTag = document.getElementById('p-import-user-tag');
  if (custTag) {
    custTag.style.opacity = '1';
    custTag.style.background = ds === 'cust' ? '#1a56db' : '#dbeafe';
    custTag.style.color = ds === 'cust' ? '#fff' : '#1e40af';
    custTag.style.fontWeight = ds === 'cust' ? '700' : '400';
  }
  if (userTag) {
    userTag.style.opacity = '1';
    userTag.style.background = ds === 'user' ? '#059669' : '#dcfce7';
    userTag.style.color = ds === 'user' ? '#fff' : '#166534';
    userTag.style.fontWeight = ds === 'user' ? '700' : '400';
  }
  var titleEl = document.getElementById('p-import-ds-title');
  if (titleEl) titleEl.textContent = ds === 'cust' ? '📋 潜力产品-客户' : '📋 潜力产品-用户';
  var viewTitle = document.getElementById('p-import-view-title');
  if (viewTitle) viewTitle.textContent = ds === 'cust' ? '📋 潜力产品-客户明细' : '📋 潜力产品-用户明细';
  App.ImportPotential.render();
};

// 文件上传处理（兼容4 sheet模板）
App.ImportPotential.handleUpload = function(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var custSheet = wb.SheetNames.find(function(n) { return n.indexOf('客户') >= 0; });
      var userSheet = wb.SheetNames.find(function(n) { return n.indexOf('用户') >= 0; });
      var imported = 0;
      if (custSheet) {
        var custData = XLSX.utils.sheet_to_json(wb.Sheets[custSheet], { header: 1, defval: null });
        if (custData.length > 1) {
          var headers = custData[0];
          App.ImportPotential.CustRAW = custData.slice(1).filter(function(r) { return r && r.length > 5; }).map(function(r) {
            return {
              dept2: r[0]||'', dept3: r[1]||'', dept4: r[2]||'', dept5: r[3]||'',
              sales: r[4]||'', product: r[5]||'', custName: r[6]||'', userName: r[7]||'',
              amount: parseFloat(r[8])||0, amountPrev: parseFloat(r[9])||0, yoy: r[10]||'',
              qty: parseInt(r[11])||0, qtyPrev: parseInt(r[12])||0, qtyYoy: r[13]||'',
              opps: parseInt(r[14])||0, oppsPrev: parseInt(r[15])||0, oppsYoy: r[16]||'',
              users: parseInt(r[17])||0, usersPrev: parseInt(r[18])||0, usersYoy: r[19]||'',
              contact: r[20]||'', level: r[21]||''
            };
          });
          imported += App.ImportPotential.CustRAW.length;
        }
      }
      if (userSheet) {
        var userData = XLSX.utils.sheet_to_json(wb.Sheets[userSheet], { header: 1, defval: null });
        if (userData.length > 1) {
          var uheaders = userData[0];
          App.ImportPotential.UserRAW = userData.slice(1).filter(function(r) { return r && r.length > 5; }).map(function(r) {
            return {
              center: r[0]||'', dept3: r[1]||'', dept4: r[2]||'', dept5: r[3]||'',
              sales: r[4]||'', contact: r[5]||'', userName: r[6]||'', industry: r[7]||'',
              product: r[8]||'', outAmt: parseFloat(r[9])||0, outAmtPrev: parseFloat(r[10])||0, outYoy: r[11]||'',
              outQty: parseInt(r[12])||0, outQtyPrev: parseInt(r[13])||0, outQtyYoy: r[14]||'',
              opps: parseInt(r[15])||0, oppsPrev: parseInt(r[16])||0, oppsYoy: r[17]||'',
              users: parseInt(r[18])||0, usersPrev: parseInt(r[19])||0, usersYoy: r[20]||'',
              custs: parseInt(r[21])||0, custsPrev: parseInt(r[22])||0, custsYoy: r[23]||'',
              level: r[24]||''
            };
          });
          imported += App.ImportPotential.UserRAW.length;
        }
      }
      App.ImportPotential.render();
      // 导入后重建派生数据并全链路刷新
      try { App.Data.rebuildDerived(); } catch(e) { console.warn(e); }
      alert('✅ 导入成功！客户 ' + (App.ImportPotential.CustRAW.length) + ' 条，用户 ' + (App.ImportPotential.UserRAW.length) + ' 条');
    } catch(err) {
      alert('❌ 文件解析失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
};

App.ImportPotential.render = function() {
  var isCust = App.ImportPotential.currentDS === 'cust';
  var data = (isCust ? (App.ImportPotential.CustRAW || []) : (App.ImportPotential.UserRAW || [])).slice();
  // 刷新筛选下拉
  var deptSel2 = document.getElementById('pImportDeptFilter');
  if (deptSel2 && deptSel2.options.length <= 1) {
    var depts = App.ImportPotential.getDepts ? App.ImportPotential.getDepts() : [];
    deptSel2.innerHTML = '<option value="">全部部门</option>' + depts.map(function(d) { return '<option>' + d + '</option>'; }).join('');
  }
  var prodSel2 = document.getElementById('pImportProdFilter');
  if (prodSel2 && prodSel2.options.length <= 1) {
    var prods = App.ImportPotential.getProducts ? App.ImportPotential.getProducts() : App.ALL_POT_PRODUCTS;
    prodSel2.innerHTML = '<option value="">全部产品</option>' + prods.map(function(p) { return '<option>' + p + '</option>'; }).join('');
  }
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

  // 冻结前7列（复选框+#+部门层级+销售），其余横向滚动
  function freezeTh(colIdx) {
    var lefts = [0, 28, 56, 136, 216, 296, 376]; // 累计偏移
    if (colIdx < lefts.length) return 'position:sticky;left:' + lefts[colIdx] + 'px;background:#f8fafc;z-index:2';
    return '';
  }

  // 渲染表头
  var thead = document.getElementById('pImportDataThead');
  if (thead) {
    if (isCust) {
      thead.innerHTML = '<tr>' +
        '<th style="width:28px;' + freezeTh(0) + '"><input type="checkbox" onclick="App.ImportPotential.toggleAll(this)"></th>' +
        '<th style="width:28px;' + freezeTh(1) + '">#</th>' +
        '<th style="width:80px;' + freezeTh(2) + '">二级部门</th>' +
        '<th style="width:80px;' + freezeTh(3) + '">大部门</th>' +
        '<th style="width:80px;' + freezeTh(4) + '">团队小组</th>' +
        '<th style="width:80px;' + freezeTh(5) + '">五级部门</th>' +
        '<th style="width:80px;' + freezeTh(6) + '">销售雇员</th>' +
        '<th>潜力产品</th><th>售达方名称</th><th>最终用户名称</th>' +
        '<th style="text-align:right">销售额(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th>' +
        '<th style="text-align:center">数量</th><th style="text-align:center">同期数量</th><th style="text-align:center">数量同比</th>' +
        '<th style="text-align:center">商机数</th><th style="text-align:center">商机同期</th><th style="text-align:center">商机同比</th>' +
        '<th style="text-align:center">用户数</th><th style="text-align:center">用户同期</th><th style="text-align:center">用户同比</th>' +
        '<th>对接人</th><th>客户等级</th></tr>';
    } else {
      thead.innerHTML = '<tr>' +
        '<th style="width:28px;' + freezeTh(0) + '"><input type="checkbox" onclick="App.ImportPotential.toggleAll(this)"></th>' +
        '<th style="width:28px;' + freezeTh(1) + '">#</th>' +
        '<th style="width:80px;' + freezeTh(2) + '">业务中心</th>' +
        '<th style="width:80px;' + freezeTh(3) + '">大部门</th>' +
        '<th style="width:80px;' + freezeTh(4) + '">团队小组</th>' +
        '<th style="width:80px;' + freezeTh(5) + '">四级部门</th>' +
        '<th style="width:80px;' + freezeTh(6) + '">负责销售</th>' +
        '<th>对接人</th><th>最终用户名称</th><th>行业</th><th>潜力产品</th>' +
        '<th style="text-align:right">出库额(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th>' +
        '<th style="text-align:center">数量</th><th style="text-align:center">同期数量</th><th style="text-align:center">数量同比</th>' +
        '<th style="text-align:center">商机数</th><th style="text-align:center">商机同期</th><th style="text-align:center">商机同比</th>' +
        '<th style="text-align:center">用户数</th><th style="text-align:center">用户同期</th><th style="text-align:center">用户同比</th>' +
        '<th style="text-align:center">客户数</th><th style="text-align:center">客户同期</th><th style="text-align:center">客户同比</th>' +
        '<th>用户等级</th></tr>';
    }
  }

  // 分页
  var pSize = parseInt((document.getElementById('pImportPageSize')||{}).value) || 20;
  if (pSize === 0) pSize = data.length;
  var pTotal = data.length;
  var pPages = Math.ceil(pTotal / pSize);
  if (!App._pImportPage || App._pImportPage > pPages) App._pImportPage = pPages || 1;
  var pStart = (App._pImportPage - 1) * pSize;
  var pData = data.slice(pStart, pStart + pSize);

  var sortField = isCust ? 'amount' : 'outAmt';
  if (sort === 'sales_desc') data.sort(function(a,b) { return (b[sortField]||0) - (a[sortField]||0); });
  else if (sort === 'sales_asc') data.sort(function(a,b) { return (a[sortField]||0) - (b[sortField]||0); });
  else if (sort === 'name') data.sort(function(a,b) { return (a.custName||a.userName).localeCompare(b.custName||b.userName); });

  var countEl = document.getElementById('p-import-ds-count');
  if (countEl) countEl.textContent = data.length + ' 条记录';

  // 表体（使用分页数据 pData）
  var html = '';
  pData.forEach(function(r, ri) {
    var yoyStr = r.yoy || r.outYoy || '';
    var yoyBadge = '';
    if (yoyStr === '新增') yoyBadge = '<span class="badge b-new">新增</span>';
    else if (yoyStr.indexOf('+') === 0) yoyBadge = '<span class="badge b-up">' + yoyStr + '</span>';
    else if (yoyStr.indexOf('-') === 0) yoyBadge = '<span class="badge b-down">' + yoyStr + '</span>';
    else yoyBadge = yoyStr;

    var rowNum = pStart + ri + 1;
    var rowId = 'pimp-' + (isCust ? 'c' : 'u') + '-' + ri;
    function freezeTd(idx) {
      var lefts = [0, 28, 56, 136, 216, 296, 376];
      if (idx < lefts.length) return 'position:sticky;left:' + lefts[idx] + 'px;background:#fff;z-index:1';
      return '';
    }
    html += '<tr id="' + rowId + '">';
    html += '<td style="' + freezeTd(0) + '"><input type="checkbox" class="p-imp-check" data-row="' + rowId + '"></td>';
    html += '<td style="' + freezeTd(1) + '">' + rowNum + '</td>';
    if (isCust) {
      html += '<td style="' + freezeTd(2) + '">' + (r.dept2 || '-') + '</td>';
      html += '<td style="' + freezeTd(3) + '">' + (r.dept3 || '-') + '</td>';
      html += '<td style="' + freezeTd(4) + '">' + (r.dept4 || '-') + '</td>';
      html += '<td style="' + freezeTd(5) + '">' + (r.dept5 || '-') + '</td>';
      html += '<td style="' + freezeTd(6) + '">' + (r.sales || '-') + '</td>';
      html += '<td><strong>' + (r.product || '-') + '</strong></td>';
      html += '<td>' + (r.custName || '-') + '</td>';
      html += '<td>' + (r.userName || '-') + '</td>';
      html += '<td class="editable-cell" contenteditable="true" style="text-align:right;font-weight:700">' + (r.amount || 0) + '</td>';
      html += '<td class="editable-cell" contenteditable="true" style="text-align:right;color:#6b7280">' + (r.amountPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + yoyBadge + '</td>';
      html += '<td class="editable-cell" contenteditable="true" style="text-align:center">' + (r.qty || 0) + '</td>';
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
      html += '<td style="' + freezeTd(2) + '">' + (r.center || '-') + '</td>';
      html += '<td style="' + freezeTd(3) + '">' + (r.dept3 || '-') + '</td>';
      html += '<td style="' + freezeTd(4) + '">' + (r.dept4 || '-') + '</td>';
      html += '<td style="' + freezeTd(5) + '">' + (r.sales || '-') + '</td>';
      html += '<td>' + (r.contact || '-') + '</td>';
      html += '<td>' + (r.userName || '-') + '</td>';
      html += '<td>' + (r.industry || '-') + '</td>';
      html += '<td><strong>' + (r.product || '-') + '</strong></td>';
      html += '<td class="editable-cell" contenteditable="true" style="text-align:right;font-weight:700">' + (r.outAmt || 0) + '</td>';
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
    var totalCols = isCust ? 24 : 26;
    html = '<tr><td colspan="' + totalCols + '" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('pImportDataTbody');
  if (tbody) tbody.innerHTML = html;

  // 分页信息
  var pageInfo = document.getElementById('pImportPageInfo');
  if (pageInfo) pageInfo.textContent = '共 ' + data.length + ' 条，第 ' + (App._pImportPage || 1) + '/' + (pPages || 1) + ' 页';
  var pageBtns = document.getElementById('pImportPageBtns');
  if (pageBtns && pPages > 1) {
    var btns = '';
    for (var pg = 1; pg <= pPages; pg++) {
      var ac = pg === (App._pImportPage || 1) ? 'style="background:#1a56db;color:#fff;font-weight:700;border-radius:3px"' : '';
      btns += '<button ' + ac + ' onclick="App._pImportPage=' + pg + ';App.ImportPotential.render()" style="padding:2px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:11px;cursor:pointer">' + pg + '</button>';
    }
    pageBtns.innerHTML = btns;
  } else if (pageBtns) { pageBtns.innerHTML = ''; }
};

// 列宽拖拽（限import-table，只增不减，不影响其他列）
(function() {
  var dragCol = null, startX = 0, startW = 0;
  document.addEventListener('mousedown', function(e) {
    var th = e.target.closest('.import-table th');
    if (!th || e.offsetX < th.offsetWidth - 6) return;
    dragCol = th; startX = e.clientX; startW = th.offsetWidth;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragCol) return;
    var delta = e.clientX - startX;
    dragCol.style.width = Math.max(30, startW + delta) + 'px';
  });
  document.addEventListener('mouseup', function() { dragCol = null; });
})();

// 批操作
App.ImportPotential.toggleAll = function(cb) {
  var checks = document.querySelectorAll('.p-imp-check');
  checks.forEach(function(c) { c.checked = cb.checked; });
};
App.ImportPotential.selectAll = function() {
  document.querySelectorAll('.p-imp-check').forEach(function(c) { c.checked = true; });
};
App.ImportPotential.deselectAll = function() {
  document.querySelectorAll('.p-imp-check').forEach(function(c) { c.checked = false; });
};
App.ImportPotential.batchDelete = function() {
  var checked = document.querySelectorAll('.p-imp-check:checked');
  if (checked.length === 0) { alert('请先勾选要删除的记录'); return; }
  if (!confirm('确定删除选中的 ' + checked.length + ' 条记录？')) return;
  var isCust = App.ImportPotential.currentDS === 'cust';
  var data = isCust ? App.ImportPotential.CustRAW : App.ImportPotential.UserRAW;
  var toRemove = [];
  checked.forEach(function(cb) {
    var row = document.getElementById(cb.getAttribute('data-row'));
    if (row) toRemove.push(row);
  });
  // 根据 row index 删除（从后往前删）
  var indices = toRemove.map(function(r) { return parseInt(r.id.split('-').pop()); }).sort(function(a, b) { return b - a; });
  indices.forEach(function(i) { data.splice(i, 1); });
  App.ImportPotential.render();
};

// ===== 账号管理-用户管理Tab渲染 =====
App.renderAdminUsers = function() {
  var users = App.MOCK_USERS.slice();
  var roles = App.USER_ROLES;
  // 按部门顺序排列（管理部/深圳业务中心/运营部置顶）
  var deptOrder = ['管理部', '深圳业务中心', '运营部'].concat(App.DEPT_LIST || []);
  users.sort(function(a, b) {
    var da = deptOrder.indexOf(a.dept), db = deptOrder.indexOf(b.dept);
    if (da < 0) da = 99; if (db < 0) db = 99;
    if (da !== db) return da - db;
    // 总监置顶，然后按角色权重排
    var roleWeight = { admin:0, gm:1, operation:2, director:3, manager:4, interface:5, sales:6 };
    var wa = roleWeight[a.role] || 9, wb = roleWeight[b.role] || 9;
    if (wa !== wb) return wa - wb;
    return a.username.localeCompare(b.username);
  });
  var tbody = document.getElementById('aUsersTableBody');
  if (!tbody) return;
  var h = '';
  users.forEach(function(u) {
    var r = roles[u.role] || {};
    var roleTag = '<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;background:' + (r.color || '#64748b') + '18;color:' + (r.color || '#64748b') + '">' + (r.badge || u.role) + '</span>';
    h += '<tr><td><strong>' + u.username + '</strong></td><td>' + u.name + '</td><td>' + roleTag + '</td><td style="font-size:10px;color:#94a3b8">' + u.role + '</td><td style="color:#64748b;font-size:12px">' + u.dept + '</td><td style="color:#64748b;font-size:12px">' + (u.group !== '-' ? u.group : '<span style="color:#cbd5e1">-</span>') + '</td><td style="white-space:nowrap">';
    h += '<select onchange="App.changeUserRole(' + u.id + ',this.value)" style="padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:11px;margin-right:4px">';
    for (var rk in roles) { h += '<option value="' + rk + '"' + (u.role === rk ? ' selected' : '') + '>' + roles[rk].badge + '</option>'; }
    h += '</select>';
    h += '<button onclick="App.showUserForm(' + u.id + ')" style="padding:3px 7px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#2563eb;margin-right:2px" title="编辑">✎</button>';
    if (u.username !== 'admin') { h += '<button onclick="App.deleteUser(' + u.id + ')" style="padding:3px 7px;border:1px solid #fee2e2;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#dc2626" title="删除">✕</button>'; }
    else { h += '<span style="font-size:10px;color:#94a3b8;margin-left:4px">内置</span>'; }
    h += '</td></tr>';
  });
  tbody.innerHTML = h;
  var countEl = document.getElementById('aUsersCount');
  if (countEl) countEl.textContent = '共 ' + users.length + ' 个用户 · admin 为内置管理员不可删除';
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
  App.showModal('⚙️ 用户权限设置', h);
};

// 新增/编辑用户
App.showUserForm = function(id) {
  var isEdit = (typeof id !== 'undefined');
  var u = isEdit ? App.MOCK_USERS.find(function(x) { return x.id === id; }) : null;
  var title = isEdit ? '✎ 编辑用户 — ' + u.name : '＋ 新增用户';
  var roles = App.USER_ROLES;
  var depts = App.DEPT_LIST;

  var h = '<h3 style="margin:0 0 16px;font-size:16px">' + title + '</h3>';
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
  App.showModal(title, h);
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
  App.renderAdminUsers();
};

// 删除用户
App.deleteUser = function(id) {
  var u = App.MOCK_USERS.find(function(x) { return x.id === id; });
  if (!u) return;
  if (u.username === 'admin') { alert('admin 为内置管理员，不可删除'); return; }
  if (!confirm('确定删除用户「' + u.name + '」吗？此操作不可撤销。')) return;
  App.MOCK_USERS = App.MOCK_USERS.filter(function(x) { return x.id !== id; });
  App.renderAdminUsers();
  App.renderAdminUsers();
  App.showPermModal();
};

// ===== 帮助说明（独立页面） =====
App.showHelp = function() {
  App.showPage('help');
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
  App.showModal('🔑 修改密码', h);
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
App.renderCustUserLink = function(state) {
  var tbody = document.getElementById('pCustUserBody');
  if (!tbody) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var team = state.team, group = state.group, person = state.person;
  var search = ((document.getElementById('pCustUserSearch') || {}).value || '').trim().toLowerCase();

  // 虚拟数据: 客户→多个用户→多个产品
  var custUserData = [
    { cust:'深圳市政府', dept:'行业二部', grp:'政府行业组', users:[
      { name:'深圳市政府办', amt:520, prods:['观澜编码产品（非大模型）','出入口停车','会议平板与视频会议','前端大模型'] },
      { name:'深圳市信息中心', amt:380, prods:['观澜编码产品（非大模型）','网络产品','国密产品','执法记录仪'] },
      { name:'深圳市政数局', amt:280, prods:['前端大模型','后端大模型(文搜大模型）','物联安全'] }
    ]},
    { cust:'宝安公安局', dept:'行业二部', grp:'政府行业组', users:[
      { name:'宝安公安指挥中心', amt:420, prods:['观澜编码产品（非大模型）','会议平板与视频会议','国密产品'] },
      { name:'宝安交警大队', amt:300, prods:['出入口停车','执法记录仪','物联安全','人员通道'] }
    ]},
    { cust:'罗湖教育局', dept:'行业二部', grp:'政府行业组', users:[
      { name:'罗湖教育信息中心', amt:380, prods:['观澜编码产品（非大模型）','会议平板与视频会议','前端大模型'] },
      { name:'罗湖区各中小学', amt:270, prods:['网络产品','国密产品','音频产品'] }
    ]},
    { cust:'广东省交通厅', dept:'行业二部', grp:'公安交警行业组', users:[
      { name:'广东省交通信息中心', amt:320, prods:['出入口停车','执法记录仪','物联安全'] },
      { name:'广东高速管理局', amt:260, prods:['前端大模型','后端大模型(文搜大模型）','人员通道','国密产品'] }
    ]},
    { cust:'招商17', dept:'行业二部', grp:'政府行业组', users:[
      { name:'招商局信息部', amt:240, prods:['观澜编码产品（非大模型）','前端大模型','会议平板与视频会议'] },
      { name:'招商局物业', amt:180, prods:['出入口停车','人员通道','音频产品'] }
    ]},
    { cust:'深圳大学', dept:'行业一部', grp:'工业企业一组', users:[
      { name:'深大信息中心', amt:220, prods:['观澜编码产品（非大模型）','会议平板与视频会议','国密产品','网络产品'] },
      { name:'深大后勤部', amt:160, prods:['出入口停车','人员通道','音频产品','物联安全'] }
    ]},
    { cust:'南方科技大学', dept:'行业一部', grp:'工业企业一组', users:[
      { name:'南科大信息办', amt:200, prods:['前端大模型','网络产品','国密产品','执法记录仪'] },
      { name:'南科大实验室', amt:150, prods:['观澜编码产品（非大模型）','后端大模型(文搜大模型）','物联安全'] }
    ]},
    { cust:'天眼监控', dept:'客户销售一部', grp:'客户销售一组', users:[
      { name:'天眼监控安防部', amt:120, prods:['前端大模型','物联安全','执法记录仪'] },
      { name:'天眼监控工程部', amt:60, prods:['出入口停车','音频产品'] }
    ]}
  ];

  // 筛选
  var custList = custUserData.filter(function(c) {
    if (team !== 'all' && c.dept !== team) return false;
    if (group !== 'all' && c.grp !== group) return false;
    if (person !== 'all') return false;
    if (search && c.cust.toLowerCase().indexOf(search) < 0) return false;
    return true;
  }).map(function(c) {
    var totalAmt = c.users.reduce(function(s, u) { return s + u.amt; }, 0);
    var allProds = new Set();
    c.users.forEach(function(u) { u.prods.forEach(function(p) { allProds.add(p); }); });
    return { cust: c.cust, users: c.users, userCount: c.users.length, prodCount: allProds.size, totalAmt: totalAmt };
  }).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  if (search) custList = custList.filter(function(c) { return c.cust.toLowerCase().indexOf(search) >= 0; });

  // 缓存数据供下钻
  custList.forEach(function(c) { App._custUserCache[c.cust] = c; });

  // 分页
  var cuPageSize = parseInt((document.getElementById('p-custuser-page-size')||{}).value) || 10;
  var cuTotal = custList.length;
  var cuPages = Math.ceil(cuTotal / cuPageSize);
  if (!App._custUserPage || App._custUserPage > cuPages) App._custUserPage = cuPages || 1;
  var cuStart = (App._custUserPage - 1) * cuPageSize;
  var cuRows = custList.slice(cuStart, cuStart + cuPageSize);
  App.setText('p-custuser-total', '共 ' + cuTotal + ' 条');

  var countEl = document.getElementById('p-cust-user-count');
  if (countEl) countEl.textContent = custList.length + ' 个客户 · ' + custList.reduce(function(s, c) { return s + c.userCount; }, 0) + ' 个用户';

  var html = '';
  cuRows.forEach(function(c, i) {
    c.users.forEach(function(u, ui) {
      var rn = ui === 0 ? (i < 3 ? 'rn' + (i + 1) : 'rn0') : '';
      if (ui === 0) {
        html += '<tr><td rowspan="' + c.users.length + '" style="vertical-align:middle;width:1%"><span class="' + rn + '">' + (i + 1) + '</span></td>' +
          '<td rowspan="' + c.users.length + '" style="vertical-align:middle;font-weight:600;font-size:12px;text-align:left">' + c.cust + '</td>' +
          '<td rowspan="' + c.users.length + '" style="text-align:center;vertical-align:middle;font-weight:700;cursor:pointer;color:#1a56db" onclick="App.showUserDetailModal(\'' + c.cust.replace(/'/g, '\\\'') + '\',\'users\')" title="点击查看交易用户明细">' + c.userCount + '</td>' +
          '<td rowspan="' + c.users.length + '" style="text-align:center;vertical-align:middle;font-weight:700;cursor:pointer;color:#1a56db" onclick="App.showUserDetailModal(\'' + c.cust.replace(/'/g, '\\\'') + '\',\'prods\')" title="点击查看潜力产品明细">' + c.prodCount + '</td>' +
          '<td rowspan="' + c.users.length + '" style="text-align:center;vertical-align:middle;font-weight:700;color:#2563eb;font-size:12px">' + c.totalAmt.toFixed(0) + '</td>';
      } else {
        html += '<tr>';
      }
      html += '<td style="font-size:11px;text-align:left">' + u.name + '</td>' +
        '<td style="text-align:center;font-size:11px">¥' + u.amt.toFixed(0) + '万</td>' +
        '<td style="text-align:center;font-weight:600;cursor:pointer;color:#1a56db" onclick="App.showUserProdDetail(\'' + c.cust.replace(/'/g, '\\\'') + '\',\'' + u.name.replace(/'/g, '\\\'') + '\')" title="点击查看' + u.name + '的潜力产品明细">' + u.prods.length + '</td></tr>';
    });
  });

  if (custList.length === 0) html = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  tbody.innerHTML = html;

  // 分页器
  var cuPager = document.getElementById('p-custuser-pager');
  if (cuPager && cuPages > 1) {
    var ph = '';
    for (var pg = 1; pg <= cuPages; pg++) {
      var ac = pg === App._custUserPage ? 'style="background:#1a56db;color:#fff;font-weight:700"' : 'style="cursor:pointer"';
      ph += '<button ' + ac + ' onclick="App._custUserPage=' + pg + ';App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))" style="margin:0 2px;padding:2px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:11px">' + pg + '</button>';
    }
    cuPager.innerHTML = ph;
  } else if (cuPager) { cuPager.innerHTML = ''; }
};

// 客户交易用户分析下钻
App._custUserCache = {};
App.showUserDetailModal = function(custName, type) {
  var c = App._custUserCache[custName];
  if (!c) return;
App.showUserProdDetail = function(custName, userName) {
  var c = App._custUserCache[custName];
  if (!c) return;
  var u = c.users.find(function(x) { return x.name === userName; });
  if (!u) return;
  var h = '<h3 style="margin:0 0 8px">' + userName + ' · 潜力产品明细 <span style="font-size:13px;color:#6b7280">共¥' + u.amt + '万 · ' + u.prods.length + '个产品</span></h3>';
  h += '<table class="table tight-table"><thead><tr><th>产品</th><th style="text-align:right">预估贡献额(万)</th></tr></thead><tbody>';
  u.prods.forEach(function(p) {
    var estAmt = Math.round(u.amt / u.prods.length);
    h += '<tr><td style="font-weight:600">' + p + '</td><td style="text-align:right">¥' + estAmt + '万</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(userName + ' · 潜力产品明细', h);
};

  if (type === 'users') {
    var h = '<h3 style="margin:0 0 8px">' + custName + ' · 交易用户明细 <span style="font-size:13px;color:#6b7280">' + c.users.length + '个用户</span></h3>';
    h += '<table class="table tight-table"><thead><tr><th>用户</th><th style="text-align:right">总贡献额(万)</th><th style="text-align:center">潜力产品数</th><th>潜力产品 · 各产品销售额</th></tr></thead><tbody>';
    c.users.forEach(function(u) {
      var prodDetails = u.prods.map(function(p) {
        var amt = c.users.reduce(function(s, usr) {
          return s + (usr.prods.indexOf(p) >= 0 ? usr.amt / usr.prods.length : 0);
        }, 0);
        return '<span style="display:inline-block;margin:1px 2px;padding:1px 6px;background:#dbeafe;border-radius:3px;font-size:10px">' + p + ' <b>¥' + Math.round(u.amt / u.prods.length) + '万</b></span>';
      }).join('');
      h += '<tr><td style="font-weight:600">' + u.name + '</td><td style="text-align:right;font-weight:700">¥' + u.amt.toFixed(0) + '万</td><td style="text-align:center">' + u.prods.length + '</td><td>' + prodDetails + '</td></tr>';
    });
    h += '</tbody></table>';
    App.showModal(custName + ' · 用户明细', h);
  } else {
    var allProds = {};
    c.users.forEach(function(u) { u.prods.forEach(function(p) { allProds[p] = (allProds[p] || 0) + u.amt; }); });
    var sorted = Object.keys(allProds).sort(function(a, b) { return allProds[b] - allProds[a]; });
    var h = '<h3 style="margin:0 0 8px">' + custName + ' · 潜力产品明细</h3>';
    h += '<table class="table tight-table"><thead><tr><th>产品</th><th style="text-align:right">贡献额(万)</th></tr></thead><tbody>';
    sorted.forEach(function(p) {
      h += '<tr><td style="font-weight:600">' + p + '</td><td style="text-align:right">¥' + allProds[p].toFixed(0) + '万</td></tr>';
    });
    h += '</tbody></table>';
    App.showModal(custName + ' · 产品明细', h);
  }
};

// ===== 用户维度数据引擎 =====
App._userData = [
  { user:'深圳市政府', sales:620, prev:520, yoy:'+19%', life:'active', cov:8, prods:['观澜编码','出入口停车','前端大模型','网络产品','后端大模型','会议平板','国密产品','执法记录仪'] },
  { user:'宝安公安局', sales:480, prev:420, yoy:'+14%', life:'active', cov:6, prods:['观澜编码','前端大模型','会议平板','国密产品','执法记录仪','物联安全'] },
  { user:'罗湖教育局', sales:420, prev:350, yoy:'+20%', life:'active', cov:7, prods:['观澜编码','出入口停车','前端大模型','会议平板','国密产品','物联安全','音频产品'] },
  { user:'广东省交通厅', sales:380, prev:320, yoy:'+19%', life:'active', cov:6, prods:['出入口停车','前端大模型','后端大模型','人员通道','国密产品','执法记录仪'] },
  { user:'深圳市卫健委', sales:280, prev:310, yoy:'-10%', life:'decline', cov:4, prods:['前端大模型','人员通道','会议平板','音频产品'] },
  { user:'深圳机场集团', sales:220, prev:200, yoy:'+10%', life:'active', cov:4, prods:['出入口停车','人员通道','国密产品','音频产品'] },
  { user:'深圳巴士集团', sales:180, prev:200, yoy:'-10%', life:'decline', cov:3, prods:['出入口停车','后端大模型','人员通道'] },
  { user:'天眼监控', sales:150, prev:0, yoy:'新增', life:'new', cov:2, prods:['前端大模型','物联安全'] },
  { user:'招商局地产', sales:130, prev:120, yoy:'+8%', life:'active', cov:3, prods:['观澜编码','出入口停车','网络产品'] },
  { user:'鹏城科技', sales:110, prev:0, yoy:'新增', life:'new', cov:2, prods:['会议平板','国密产品'] },
  { user:'龙岗分局', sales:90, prev:120, yoy:'-25%', life:'decline', cov:1, prods:['观澜编码'] },
  { user:'南山教育局', sales:70, prev:80, yoy:'-13%', life:'decline', cov:1, prods:['会议平板'] },
  { user:'深圳文体局', sales:50, prev:0, yoy:'新增', life:'new', cov:1, prods:['音频产品'] },
  { user:'港口集团', sales:40, prev:70, yoy:'-43%', life:'lost', cov:1, prods:['物联安全'] },
  { user:'车管所', sales:30, prev:60, yoy:'-50%', life:'lost', cov:1, prods:['网络产品'] }
];

App.renderUserDimension = function() {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var scopeLabel = person !== 'all' ? '个人: '+person : group !== 'all' ? '组: '+group : team !== 'all' ? '部门: '+team : '全部用户';
  var data = App._userData;

  // 用户分层卡片
  var segs = { star:[], cash:[], potential:[], sleep:[] };
  data.forEach(function(u) {
    if (u.sales >= 200 && u.cov >= 5) segs.star.push(u);
    else if (u.sales >= 200 && u.cov < 5) segs.cash.push(u);
    else if (u.sales < 200 && u.cov >= 5) segs.potential.push(u);
    else segs.sleep.push(u);
  });
  Object.keys(segs).forEach(function(k) {
    App.setText('useg-' + k + '-count', segs[k].length);
    App.setText('useg-' + k + '-list', segs[k].map(function(u) { return u.user; }).join('、'));
  });

  // 生命周期
  var lifes = { new:[], active:[], decline:[], lost:[] };
  data.forEach(function(u) { lifes[u.life].push(u); });
  ['new','active','decline','lost'].forEach(function(k) { App.setText('p-ulife-' + k, lifes[k].length); });
  App.setText('p-ulife-scope', scopeLabel);
  var ulfTbody = document.getElementById('p-ulife-body');
  if (ulfTbody) {
    ulfTbody.innerHTML = data.map(function(u) {
      var licon = { new:'🆕', active:'🟢', decline:'🟡', lost:'🔴' };
      var llabel = { new:'新增用户', active:'存量活跃', decline:'萎缩用户', lost:'流失用户' };
      var lcls = { new:'b-new', active:'b-up', decline:'b-warn', lost:'b-down' };
      var yoyCls = u.yoy === '新增' ? 'b-new' : (u.yoy.indexOf('-') >= 0 ? 'b-down' : 'b-up');
      return '<tr><td style="font-weight:600">' + u.user + '</td><td style="text-align:center"><span class="badge ' + lcls[u.life] + '">' + (licon[u.life]||'') + ' ' + (llabel[u.life]||'') + '</span></td><td style="text-align:right">¥' + u.sales + '万</td><td style="text-align:right;color:#6b7280">¥' + u.prev + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + u.yoy + '</span></td><td style="text-align:center">' + u.cov + '/' + App.ALL_POT_PRODUCTS.length + '</td></tr>';
    }).join('');
  }

  // 用户关联客户明细表（rowspan展开） —— 虚拟关联客户数据
  var userCustMap = {
    '深圳市政府': [{ cust:'深圳市政府采购中心', amt:420 }, { cust:'龙岗区政务中心', amt:200 }],
    '宝安公安局': [{ cust:'宝安公安指挥中心', amt:320 }, { cust:'深圳交警局', amt:160 }],
    '罗湖教育局': [{ cust:'罗湖教育信息中心', amt:280 }, { cust:'罗湖区各中小学', amt:140 }],
    '广东省交通厅': [{ cust:'广东高速管理局', amt:250 }, { cust:'广东省路桥公司', amt:130 }],
    '深圳市卫健委': [{ cust:'深圳市卫健委信息中心', amt:180 }, { cust:'深圳市人民医院', amt:100 }]
  };
  var ulinkBody = document.getElementById('pUserLinkBody');
  if (ulinkBody) {
    var html = '';
    data.slice(0, 8).forEach(function(u, i) {
      var custs = userCustMap[u.user] || [{ cust: u.user + '关联客户1', amt: Math.round(u.sales * 0.6) }, { cust: u.user + '关联客户2', amt: Math.round(u.sales * 0.4) }];
      var totalCustAmt = custs.reduce(function(s, c) { return s + c.amt; }, 0);
      custs.forEach(function(c, ci) {
        var rn = ci === 0 ? (i < 3 ? 'rn'+(i+1) : 'rn0') : '';
        if (ci === 0) {
          html += '<tr><td rowspan="' + custs.length + '" style="vertical-align:middle"><span class="' + rn + '">' + (i+1) + '</span></td>' +
            '<td rowspan="' + custs.length + '" style="vertical-align:middle;text-align:left;font-weight:600">' + u.user + '</td>' +
            '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700;cursor:pointer;color:#1a56db" onclick="App.showUserCustDrill(\'' + u.user + '\')" title="点击查看关联客户">' + custs.length + '</td>' +
            '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700">' + u.cov + '</td>' +
            '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700;color:#2563eb">¥' + totalCustAmt + '万</td>';
        } else {
          html += '<tr>';
        }
        html += '<td style="text-align:left;font-size:11px">' + c.cust + '</td><td style="text-align:center;font-size:11px">¥' + c.amt + '万</td><td style="text-align:center;font-size:11px">' + (Math.round(0 + 2)) + '</td></tr>';
      });
    });
    ulinkBody.innerHTML = html;
  }

  // ── 用户分层卡片 ──
  var segs = { star:[], cash:[], potential:[], sleep:[] };
  data.forEach(function(u) {
    if (u.sales >= 200 && u.cov >= 5) segs.star.push(u);
    else if (u.sales >= 200 && u.cov < 5) segs.cash.push(u);
    else if (u.sales < 200 && u.cov >= 5) segs.potential.push(u);
    else segs.sleep.push(u);
  });
  ['star','cash','potential','sleep'].forEach(function(k) {
    App.setText('useg-' + k + '-count', segs[k].length);
    App.setText('useg-' + k + '-list', segs[k].map(function(u) { return u.user; }).join('、'));
  });

  // ── 生命周期 ──
  var lifes = { new:[], active:[], decline:[], lost:[] };
  data.forEach(function(u) { lifes[u.life].push(u); });
  ['new','active','decline','lost'].forEach(function(k) { App.setText('p-ulife-' + k, lifes[k].length); });
  var ulfTbody2 = document.getElementById('p-ulife-body');
  if (ulfTbody2) {
    ulfTbody2.innerHTML = data.map(function(u) {
      var li = { new:'🆕', active:'🟢', decline:'🟡', lost:'🔴' };
      var ll = { new:'新增用户', active:'存量活跃', decline:'萎缩用户', lost:'流失用户' };
      var lc = { new:'b-new', active:'b-up', decline:'b-warn', lost:'b-down' };
      var yc = u.yoy === '新增' ? 'b-new' : (u.yoy.indexOf('-') >= 0 ? 'b-down' : 'b-up');
      return '<tr><td style="font-weight:600">' + u.user + '</td><td style="text-align:center"><span class="badge ' + lc[u.life] + '">' + li[u.life] + ' ' + ll[u.life] + '</span></td><td style="text-align:right">¥' + u.sales + '万</td><td style="text-align:right;color:#6b7280">¥' + u.prev + '万</td><td style="text-align:center"><span class="badge ' + yc + '">' + u.yoy + '</span></td><td style="text-align:center">' + u.cov + '/' + App.ALL_POT_PRODUCTS.length + '</td></tr>';
    }).join('');
  }

  // ── Top/Bottom ──
  var sorted = data.slice().sort(function(a, b) { return b.sales - a.sales; });
  function fillUTable(tid, list) {
    var tb = document.getElementById(tid);
    if (tb) tb.innerHTML = list.map(function(u, i) {
      var rn = i < 3 ? 'rn'+(i+1) : 'rn0'; var yc = u.yoy === '新增' ? 'b-new' : (u.yoy.indexOf('-') >= 0 ? 'b-down' : 'b-up');
      return '<tr><td><span class="' + rn + '">' + (i+1) + '</span></td><td style="font-weight:600">' + u.user + '</td><td style="text-align:right">¥' + u.sales + '万</td><td style="text-align:center"><span class="badge ' + yc + '">' + u.yoy + '</span></td><td style="text-align:center">' + u.cov + '/' + App.ALL_POT_PRODUCTS.length + '</td></tr>';
    }).join('');
  }
  fillUTable('p-user-top10-body', sorted.slice(0, 10));
  fillUTable('p-user-bottom10-body', sorted.slice(-10).reverse());

  // ── 交叉矩阵 ──
  var mT = document.getElementById('pUmatrixThead'), mB = document.getElementById('pUmatrixBody'), mF = document.getElementById('pUmatrixFoot');
  if (mT && mB) {
    var prods = App.ALL_POT_PRODUCTS;
    mT.innerHTML = '<tr><th style="position:sticky;left:0;background:#f0f4ff;z-index:2">用户 \\ 产品</th>' + prods.map(function(p) { return '<th>' + (p.length > 4 ? p.substring(0,4)+'…' : p) + '</th>'; }).join('') + '<th style="position:sticky;right:0;background:#f0f4ff;z-index:2">已覆盖</th></tr>';
    mB.innerHTML = data.slice(0, 8).map(function(u) {
      var cells = ''; var cov = 0;
      prods.forEach(function(p) {
        var hit = u.prods.indexOf(p) >= 0;
        if (hit) cov++;
        cells += '<td class="' + (hit ? 'cell-up' : 'cell-zero') + '" style="cursor:help" title="' + u.user + ' × ' + p + '">' + (hit ? '✓' : '-') + '</td>';
      });
      return '<tr><td style="position:sticky;left:0;background:#f9fafb;font-weight:600;z-index:1">' + u.user + '</td>' + cells + '<td style="position:sticky;right:0;background:#f9fafb;font-weight:700;text-align:center;z-index:1">' + cov + '/' + prods.length + '</td></tr>';
    }).join('');
    mF.innerHTML = '<tr style="font-weight:700;background:#f0f4ff"><td style="position:sticky;left:0;background:#dbeafe">覆盖用户数</td>' + prods.map(function(p) { var cnt = data.slice(0,8).filter(function(u) { return u.prods.indexOf(p) >= 0; }).length; return '<td style="text-align:center">' + cnt + '/8</td>'; }).join('') + '<td></td></tr>';
  }

  App._userSegCache = segs;
  App._userCustCache = userCustMap;
};
App.showUserCustDrill = function(userName) {
  var custs = App._userCustCache[userName] || [];
  var h = '<h3 style="margin:0 0 8px">' + userName + ' · 关联客户明细</h3>';
  h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">贡献额(万)</th></tr></thead><tbody>';
  custs.forEach(function(c) { h += '<tr><td style="font-weight:600">' + c.cust + '</td><td style="text-align:right">¥' + c.amt + '万</td></tr>'; });
  h += '</tbody></table>'; App.showModal(userName + ' · 关联客户', h);
};



// ===== 潜力产品 — 用户维度：用户背后的客户关系 =====
App.renderUserCustLink = function(state) {
  var tbody = document.getElementById('pUserCustBody');
  if (!tbody) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var raw = (App.ImportPotential.UserRAW.length > 0 ? App.ImportPotential.UserRAW : App.ImportPotential.CustRAW).slice();
  // 页级筛选: 按部门过滤原始数据
  if (state.team !== 'all') {
    raw = raw.filter(function(r) { return (r.dept4 || r.dept3 || '') === state.team; });
  }
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
  var modKeys = ['overview','width','potential','users','roles','products','audit','backup','export','import'];
  var modLabels = { overview:'数据总览', width:'产品宽度', potential:'潜力产品', users:'用户管理', roles:'角色权限', products:'产品字典', audit:'审计日志', backup:'数据备份', export:'数据导出', import:'数据导入' };
  var scopeMap = { admin:'全部数据', gm:'全部数据', operation:'全部数据', director:'本部门', manager:'本小组', interface:'本部门', sales:'本人' };

  // 深拷贝当前权限作为编辑缓冲
  if (!App._roleEditBuffer) {
    App._roleEditBuffer = JSON.parse(JSON.stringify(App.ROLE_PERMISSIONS));
  }

  tbody.innerHTML = App._roleEditBuffer.map(function(r, ri) {
    var cells = modKeys.map(function(k) {
      var val = r.modules[k];
      var checked = val === 1 ? ' checked' : '';
      return '<td style="text-align:center">' +
        '<input type="checkbox" ' + checked + ' onchange="App._roleEditBuffer[' + ri + '].modules.' + k + '=this.checked?1:0" style="width:16px;height:16px;cursor:pointer;accent-color:#16a34a" title="' + (modLabels[k]||k) + '">' +
        '</td>';
    }).join('');
    return '<tr>' +
      '<td><span class="badge" style="background:#dbeafe;color:#1e40af">' + r.role + '</span></td>' +
      '<td><strong>' + r.name + '</strong><div style="font-size:10px;color:#94a3b8">' + r.desc + '</div></td>' +
      cells +
      '<td><span style="font-size:11px;color:#6b7280">' + (scopeMap[r.role] || '-') + '</span></td>' +
      '</tr>';
  }).join('');

  // 确认/取消按钮
  var card = tbody.closest('.card');
  var existingBar = document.getElementById('aRolesActionBar');
  if (existingBar) existingBar.remove();
  var bar = document.createElement('div');
  bar.id = 'aRolesActionBar';
  bar.style.cssText = 'margin-top:12px;display:flex;gap:8px;justify-content:flex-end';
  bar.innerHTML = '<button onclick="App.cancelRoleEdit()" style="padding:6px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:12px">取消</button>' +
    '<button onclick="App.saveRolePerms()" style="padding:6px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500">✅ 确认保存</button>';
  if (card) card.appendChild(bar);
};

App.saveRolePerms = function() {
  if (!App._roleEditBuffer) return;
  App.ROLE_PERMISSIONS = JSON.parse(JSON.stringify(App._roleEditBuffer));
  App._roleEditBuffer = null;
  App.renderRoles();
  var bar = document.getElementById('aRolesActionBar');
  if (bar) { bar.style.background = '#d1fae5'; setTimeout(function() { bar.style.background = ''; }, 800); }
  // Toast 提示
  var toast = document.createElement('div');
  toast.textContent = '✅ 权限已保存';
  toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#059669;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;z-index:99999;transition:opacity .3s;font-weight:600';
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 1500);
};

App.cancelRoleEdit = function() {
  App._roleEditBuffer = null;
  App.renderRoles();
};

// ===== 产品字典渲染（潜力产品 + 产品宽度 两个表格） =====
App.renderProductDict = function() {
  if (!App.PRODUCT_DICT) return;
  var search = ((document.getElementById('aProdSearch') || {}).value || '').trim().toLowerCase();
  var catFilter = (document.getElementById('aProdCatFilter') || {}).value || '';

  var data = App.PRODUCT_DICT.slice();
  if (search) data = data.filter(function(p) { return p.name.toLowerCase().indexOf(search) >= 0 || (p.alias||'').toLowerCase().indexOf(search) >= 0; });
  if (catFilter) data = data.filter(function(p) { return p.category === catFilter; });

  var potData = data.filter(function(p) { return p.is_potential === 1; });
  var widthData = data.filter(function(p) { return p.is_potential === 0; });

  App.setText('aProdPotCount', potData.length + ' 个');
  App.setText('aProdWidthCount', widthData.length + ' 个');

  function renderTable(tbodyId, list) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = list.map(function(p, i) {
      return '<tr>' +
        '<td><span class="rn rn0">' + (i + 1) + '</span></td>' +
        '<td><strong>' + p.name + '</strong></td>' +
        '<td>' + (p.alias || '-') + '</td>' +
        '<td><span style="font-size:11px;background:#f1f5f9;padding:2px 8px;border-radius:4px">' + p.category + '</span></td>' +
        '<td><a style="color:var(--primary);cursor:pointer;font-size:11px;margin-right:6px" onclick="App.showProductForm(' + p.id + ')">编辑</a><a style="color:var(--danger);cursor:pointer;font-size:11px" onclick="App.deleteProduct(' + p.id + ')">删除</a></td>' +
        '</tr>';
    }).join('');
  }
  renderTable('aProdPotBody', potData);
  renderTable('aProdWidthBody', widthData);
};

App.showProductForm = function(id, defPot) {
  var isEdit = typeof id === 'number';
  var p = isEdit ? App.PRODUCT_DICT.find(function(x) { return x.id === id; }) : null;
  defPot = defPot !== undefined ? defPot : 1;
  var title = isEdit ? '编辑产品 — ' + p.name : '新增产品';
  var h = '<h3 style="margin:0 0 16px;font-size:16px">' + title + '</h3>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">产品名称 <span style="color:#dc2626">*</span></label><input id="pfName" value="' + (isEdit ? p.name : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px" placeholder="如: IPC"></div>';
  h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">别名</label><input id="pfAlias" value="' + (isEdit ? (p.alias||'') : '') + '" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px" placeholder="如: 网络摄像机"></div>';
  // 编辑时显示潜力产品选项，新增时自动由按钮决定
  if (isEdit) {
    h += '<div><label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;font-weight:500">潜力产品</label><select id="pfPot" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px"><option value="1"' + (p.is_potential === 1 ? ' selected' : '') + '>是</option><option value="0"' + (p.is_potential === 0 ? ' selected' : '') + '>否</option></select></div>';
  }
  h += '<input type="hidden" id="pfDefPot" value="' + defPot + '">';
  h += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><button onclick="App.closeModal()" style="padding:7px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px">取消</button><button onclick="App.saveProduct(' + (isEdit ? id : 'null') + ')" style="padding:7px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">' + (isEdit ? '保存' : '新增') + '</button></div>';
  App.showModal(title, h);
};

App.saveProduct = function(id) {
  var isEdit = typeof id === 'number';
  var name = (document.getElementById('pfName')||{}).value || '';
  var alias = (document.getElementById('pfAlias')||{}).value || '';
  var potEl = document.getElementById('pfPot') || document.getElementById('pfDefPot');
  var pot = parseInt(potEl ? potEl.value : 0) || 0;
  if (!name) { alert('产品名称不能为空'); return; }
  if (isEdit) {
    var p = App.PRODUCT_DICT.find(function(x) { return x.id === id; });
    if (p) { p.name = name; p.alias = alias; p.is_potential = pot; }
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

  // 读取页级筛选状态，按部门过滤
  var pageState = App.getFilterState('page-potential');
  var pageTeam = pageState.team;
  if (gapData && gapData.teams && pageTeam !== 'all') {
    var filteredTeams = gapData.teams.filter(function(t) {
      return t.team === pageTeam || t.team.indexOf(pageTeam) >= 0;
    });
    gapData = { prods: gapData.prods, teams: filteredTeams };
  }

  // 更新粒度提示
  var labelMap = { dept3: '大部门', dept4: '团队小组', person: '销售人员' };
  var levelEl = document.getElementById('gap-level');
  if (levelEl) levelEl.textContent = '当前粒度: ' + (labelMap[dim] || '大部门') + (pageTeam !== 'all' ? ' · ' + pageTeam : '');

  // 1. 渲染差距明细表
  if (gapData && gapData.prods && gapData.teams && gapData.teams.length > 0) {
    App.renderGapDetail('p-gap-detail-table', gapData);
  }

  // 2. 渲染空白产品率 & 待突破率综合对比图
  if (App.charts.pGapCombined && gapData && gapData.teams && gapData.teams.length > 0) {
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
  App.renderAdminUsers();
  App.renderAuditLog();
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

// （已移除废弃的 _ovDimData / onOvDimChange / _ovBarDim / setOvBarDim — 图表维度由级联筛选自动判定）

// 通用：根据筛选器级联状态更新柱状图（全部 → 部门 → 小组 → 个人），供总览页和产品宽度页复用
App._updateDimBarChart = function(pageId, chartKey) {
  var state = App.getFilterState(pageId);
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
    // 支持切换 部门/组 维度（总览页 + 产品宽度页）
    var showGroups = (pageId === 'page-overview' && App._ovWidthDim === 'group') ||
                     (pageId === 'page-width' && App._wWidthDim === 'group');
    if (showGroups) {
      labels = App.GROUPS.map(function(g) { return g.n; });
      widthData = App.GROUPS.map(function(g) { return g.aw; });
    } else {
      labels = App.DEPTS.map(function(d) { return d.n; });
      widthData = App.DEPTS.map(function(d) { return d.aw; });
    }
  }

  var chart = (typeof chartKey === 'string') ? (App.charts[chartKey] || Chart.getChart(chartKey)) : chartKey;
  if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = widthData;
    chart.data.datasets[0].backgroundColor = '#3b82f6';
    chart.update();
  }
};

// 总览页 — 根据筛选器级联状态更新柱状图
App._refreshOvBarCharts = function() {
  var state = App.getFilterState('page-overview');
  var team = state.team, group = state.group, person = state.person;

  // 更新总览页自身的图表
  var bw = App.charts['ov_dept-width'] || App.charts.ovDeptWidth;
  if (bw) { App._updateDimBarChart('page-overview', bw); }

  var bp = App.charts['ov_dept-potential'] || App.charts.ovDeptPotential;
  if (bp) {
    // 根据筛选从 WidthTeamMatrix 聚合数据
    var matrixData = App.WidthTeamMatrix.RAW || [];
    var pAgg = {};
    matrixData.forEach(function(r) {
      if (team !== 'all') {
        var gd = (App.GROUPS.find(function(g){return g.n===r.team;})||{}).dept;
        if (gd !== team) return;
      }
      if (group !== 'all' && r.team !== group) return;
      pAgg[r.product] = (pAgg[r.product] || 0) + (r.amount || 0);
    });

    var prodLabels = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
    var prodSales = prodLabels.map(function(p) { var v = pAgg[p] || 0; return Math.round(v); });
    // 如果无Matrix数据，用demo并缩放
    if (Object.keys(pAgg).length === 0) {
      var scale = person !== 'all' ? 0.02 : group !== 'all' ? 0.10 : team !== 'all' ? 0.28 : 1;
      prodSales = [1100,420,980,600,650,180,450,400,380,480,320].map(function(v) { return Math.round(v * scale); });
    }
    bp.data.labels = prodLabels;
    bp.data.datasets[0].data = prodSales;
    bp.data.datasets[0].backgroundColor = '#3b82f6';
    bp.update();
  }
  // 更新产品宽度历史趋势图
  App._updateOvWidthTrend();
};

// ===== 产品宽度 - 产品维度 Tab 动态渲染（跟随页级筛选） =====
App.renderWidthProductTab = function() {
  var state = App.getFilterState('page-width');
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;

  // 产品覆盖率排名 (规上客户) — 27品类
  var custProds = [
    { name:'IPC', cov:53.1, yoy:'+12.3%', yoyCls:'b-up', team:'政府行业组' },
    { name:'NVR', cov:36.7, yoy:'+18.5%', yoyCls:'b-up', team:'政府行业组' },
    { name:'门禁', cov:27.8, yoy:'-8.2%', yoyCls:'b-down', team:'公安交警行业组' },
    { name:'球机', cov:24.6, yoy:'+5.1%', yoyCls:'b-up', team:'公安交警行业组' },
    { name:'LCD与解码', cov:17.6, yoy:'+0.8%', yoyCls:'b-flat', team:'工业企业一组' },
    { name:'新业务', cov:17.4, yoy:'新增', yoyCls:'b-new', team:'智慧建筑组' },
    { name:'通用软件', cov:16.3, yoy:'+3.2%', yoyCls:'b-up', team:'政府行业组' },
    { name:'网络产品', cov:14.6, yoy:'-2.1%', yoyCls:'b-warn', team:'工业企业一组' },
    { name:'存储', cov:11.5, yoy:'+8.4%', yoyCls:'b-up', team:'政府行业组' },
    { name:'专用摄像机', cov:9.3, yoy:'+3.2%', yoyCls:'b-up', team:'公安交警行业组' },
    { name:'服务器', cov:8.9, yoy:'+1.5%', yoyCls:'b-flat', team:'大客户销售部' },
    { name:'行业软件', cov:8.5, yoy:'-3.5%', yoyCls:'b-down', team:'工业企业一组' },
    { name:'智能计算', cov:7.9, yoy:'+85%', yoyCls:'b-up', team:'政府行业组' },
    { name:'对讲', cov:7.6, yoy:'-2.8%', yoyCls:'b-warn', team:'智慧建筑组' },
    { name:'报警', cov:7.4, yoy:'-5.1%', yoyCls:'b-down', team:'智慧建筑组' },
    { name:'出入口停车', cov:7.4, yoy:'+15.2%', yoyCls:'b-up', team:'政府行业组' },
    { name:'人员通道', cov:6.4, yoy:'+2.1%', yoyCls:'b-flat', team:'客户销售一部' },
    { name:'音频产品', cov:5.9, yoy:'-1.2%', yoyCls:'b-warn', team:'工业企业一组' },
    { name:'PCP产品', cov:4.5, yoy:'新增', yoyCls:'b-new', team:'大客户销售部' },
    { name:'LED与拼控', cov:4.5, yoy:'+0.5%', yoyCls:'b-flat', team:'场景数字化销售部' },
    { name:'移动终端产品', cov:4.2, yoy:'+1.8%', yoyCls:'b-up', team:'公安交警行业组' },
    { name:'智能交通', cov:4.0, yoy:'+18.4%', yoyCls:'b-up', team:'政府行业组' },
    { name:'智慧屏与视频会议', cov:3.6, yoy:'+6.8%', yoyCls:'b-up', team:'智慧建筑组' },
    { name:'综合布线与机柜', cov:3.6, yoy:'-0.5%', yoyCls:'b-flat', team:'客户销售二部' },
    { name:'基础软件', cov:1.9, yoy:'+0.8%', yoyCls:'b-flat', team:'场景数字化销售部' },
    { name:'网络安全', cov:1.7, yoy:'新增', yoyCls:'b-new', team:'大客户销售部' },
    { name:'传感产品', cov:0.8, yoy:'-0.3%', yoyCls:'b-warn', team:'场景数字化销售部' }
  ];
  var custCovered = [472,326,247,218,156,155,145,130,102,83,79,76,70,68,66,66,57,52,40,40,37,36,32,32,17,15,7];

  var tbody1 = document.getElementById('wProdCovCustBody');
  if (tbody1) {
    tbody1.innerHTML = custProds.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      var covScaled = Math.round(p.cov * sf);
      var coveredScaled = Math.round(custCovered[i] * sf);
      return '<tr style="cursor:pointer" onclick="App.showProdCovDrill(\'' + p.name + '\',\'cust\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + coveredScaled + '</td>' +
        '<td style="text-align:center;font-weight:700;color:var(--success)">' + covScaled + '%</td>' +
        '<td style="text-align:center"><span class="badge ' + p.yoyCls + '">' + p.yoy + '</span></td></tr>';
    }).join('');
  }

  // 产品覆盖率排名 (规上用户) — 全部27品类
  var userProds = [
    { name:'IPC', cov:80.3, yoy:'+15.6%', yoyCls:'b-up' },
    { name:'NVR', cov:69.4, yoy:'+22.1%', yoyCls:'b-up' },
    { name:'门禁', cov:47.9, yoy:'-3.5%', yoyCls:'b-warn' },
    { name:'球机', cov:54.4, yoy:'+8.3%', yoyCls:'b-up' },
    { name:'LCD与解码', cov:31.1, yoy:'+6.8%', yoyCls:'b-up' },
    { name:'新业务', cov:22.1, yoy:'+18.5%', yoyCls:'b-up' },
    { name:'通用软件', cov:35.2, yoy:'+5.2%', yoyCls:'b-up' },
    { name:'网络产品', cov:28.5, yoy:'-2.1%', yoyCls:'b-warn' },
    { name:'存储', cov:36.8, yoy:'+11.2%', yoyCls:'b-up' },
    { name:'专用摄像机', cov:19.8, yoy:'+3.2%', yoyCls:'b-up' },
    { name:'服务器', cov:17.3, yoy:'+1.5%', yoyCls:'b-flat' },
    { name:'行业软件', cov:15.6, yoy:'-3.5%', yoyCls:'b-down' },
    { name:'智能计算', cov:14.2, yoy:'+85%', yoyCls:'b-up' },
    { name:'对讲', cov:13.0, yoy:'-2.8%', yoyCls:'b-warn' },
    { name:'报警', cov:11.5, yoy:'-5.1%', yoyCls:'b-down' },
    { name:'出入口停车', cov:18.7, yoy:'新增', yoyCls:'b-new' },
    { name:'人员通道', cov:10.8, yoy:'+2.1%', yoyCls:'b-flat' },
    { name:'音频产品', cov:9.4, yoy:'-1.2%', yoyCls:'b-warn' },
    { name:'PCP产品', cov:8.2, yoy:'新增', yoyCls:'b-new' },
    { name:'LED与拼控', cov:7.8, yoy:'+0.5%', yoyCls:'b-flat' },
    { name:'移动终端产品', cov:7.1, yoy:'+1.8%', yoyCls:'b-up' },
    { name:'智能交通', cov:24.6, yoy:'+18.4%', yoyCls:'b-up' },
    { name:'智慧屏与视频会议', cov:6.5, yoy:'+6.8%', yoyCls:'b-up' },
    { name:'综合布线与机柜', cov:5.8, yoy:'-0.5%', yoyCls:'b-flat' },
    { name:'基础软件', cov:4.3, yoy:'+0.8%', yoyCls:'b-flat' },
    { name:'网络安全', cov:3.6, yoy:'新增', yoyCls:'b-new' },
    { name:'传感产品', cov:2.1, yoy:'-0.3%', yoyCls:'b-warn' }
  ];
  var userCovered = [310,268,185,210,120,85,136,110,142,77,67,60,55,50,45,72,42,36,32,30,28,95,25,22,16,14,8];

  var tbody2 = document.getElementById('wProdCovUserBody');
  if (tbody2) {
    tbody2.innerHTML = userProds.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      return '<tr style="cursor:pointer" onclick="App.showProdCovDrill(\'' + p.name + '\',\'user\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + Math.round(userCovered[i] * sf) + '</td>' +
        '<td style="text-align:center;font-weight:700;color:var(--success)">' + Math.round(p.cov * sf) + '%</td>' +
        '<td style="text-align:center"><span class="badge ' + p.yoyCls + '">' + p.yoy + '</span></td></tr>';
    }).join('');
  }
};

// ===== 产品覆盖率排名 — 点击穿透明细（12品类富数据） =====
App._prodCovStock = {
  'NVR':      { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,智能交通,LCD,出入口'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'招商17',person:'陈伟杰',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,网络,存储,出入口'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'NVR,智能交通,IPC,球机,存储'},{name:'南山区教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,存储,门禁'},{name:'龙岗分局',person:'张继成',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,对讲'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,网络,存储,出入口,对讲'},{name:'佛山教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机'},{name:'东莞市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'珠海横琴智慧',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,存储,出入口,网络'},{name:'东方电子',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,门禁,存储,球机,LCD'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,通用软件,平台软件'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能交通,存储,球机'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,出入口'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,平台软件,门禁'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,门禁,存储,对讲'}] },
  '智能计算': { custs:[{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'智能计算,NVR,IPC,门禁,球机,LCD,网络,存储,出入口'},{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'智能计算,NVR,IPC,门禁,球机,LCD,存储,网络,出入口,对讲'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,智能计算,门禁,球机,存储,出入口'},{name:'南方科技大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,智能计算,门禁,LCD,智慧屏,基础软件'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,智能计算,IPC,球机,存储,NVR'},{name:'珠海横琴智慧',person:'王志强',team:'政府行业组',covProds:'智能计算,IPC,NVR,LCD,门禁,球机,存储,出入口,网络'},{name:'深圳大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,智能计算,门禁,球机,LCD,通用软件,网络,存储'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'智能计算,IPC,NVR,门禁,球机,智能交通,LCD'},{name:'深圳市教育局',person:'李梦琪',team:'政府行业组',covProds:'智能计算,NVR,IPC,LCD,门禁,球机'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能计算,门禁,球机,智能交通'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能计算,智能交通,IPC,存储,NVR'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'智能计算,IPC,NVR,LCD,平台软件,门禁'}] },
  'IPC':      { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,智能交通,LCD,出入口'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能交通,球机,存储'},{name:'深圳大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,球机,LCD,通用软件,网络,存储'},{name:'深圳地铁集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车,门禁,存储'},{name:'天眼监控科技',person:'张栋柱',team:'客户销售一组',covProds:'IPC,NVR'},{name:'华润万象城',person:'刘文宇',team:'客户销售三组',covProds:'IPC,门禁,出入口停车,报警'},{name:'鹏城科技集团',person:'陈刚',team:'客户销售二组',covProds:'IPC,NVR,存储'},{name:'南山教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,存储'},{name:'沙头派出所',person:'邓畅',team:'客户销售五组',covProds:'IPC,报警'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,通用软件'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,智能交通,存储,NVR,球机'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,出入口'},{name:'深圳市卫健委',person:'李梦琪',team:'政府行业组',covProds:'IPC,门禁,通用软件,存储,NVR,对讲'},{name:'深圳市文体局',person:'李梦琪',team:'政府行业组',covProds:'IPC,LCD,新业务,通用软件,NVR,门禁,智慧屏'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,平台软件,门禁'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'惠州市大数据局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,存储,LCD,门禁,通用软件'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,存储,NVR,对讲,人员通道'}] },
  '平台软件': { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'平台软件,IPC,NVR,门禁,球机,LCD,存储,网络,出入口'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'平台软件,IPC,NVR,LCD,门禁'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'平台软件,NVR,IPC,门禁,球机,LCD,网络,存储'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,平台软件,门禁,球机,存储,出入口'},{name:'南方科技大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,平台软件,门禁,LCD,智慧屏,基础软件'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,平台软件,LCD,门禁'},{name:'珠海横琴智慧',person:'王志强',team:'政府行业组',covProds:'平台软件,IPC,NVR,LCD,门禁,球机,存储,出入口'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'平台软件,IPC,NVR,门禁,球机,智能交通'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'平台软件,IPC,NVR,LCD,门禁,球机,通用软件'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,平台软件,智能交通,存储'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'平台软件,IPC,NVR,LCD,门禁,球机,存储'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'平台软件,IPC,NVR,LCD,门禁'}] },
  '门禁':     { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,智能交通,LCD,出入口'},{name:'深圳大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,球机,LCD,通用软件,网络,存储'},{name:'深圳地铁集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,智能交通,门禁,出入口停车,存储'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机'},{name:'华润万象城',person:'刘文宇',team:'客户销售三组',covProds:'IPC,门禁,出入口停车,报警'},{name:'招商局地产',person:'朱迪',team:'客户销售四组',covProds:'IPC,门禁,LCD'},{name:'江河电子',person:'张栋柱',team:'客户销售一组',covProds:'IPC,门禁'},{name:'龙岗分局',person:'张继成',team:'公安交警行业组',covProds:'IPC,门禁,对讲,NVR'},{name:'东方电子',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,门禁,存储,球机'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,通用软件'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,出入口'},{name:'深圳市卫健委',person:'李梦琪',team:'政府行业组',covProds:'IPC,门禁,通用软件,存储,NVR'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,存储,NVR,对讲'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,LCD,平台软件,球机,存储'},{name:'惠州市大数据局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,通用软件,存储,NVR'}] },
  '智能交通': { custs:[{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,球机,存储,NVR,出入口停车,移动终端'},{name:'深圳市交警支队',person:'房伟建',team:'公安交警行业组',covProds:'IPC,NVR,球机,智能交通,移动终端,出入口停车,服务器,存储,报警'},{name:'深圳地铁集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车,门禁,存储'},{name:'深圳机场集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,门禁,智能交通,出入口停车,报警'},{name:'东莞市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能交通,球机,门禁,LCD,存储'},{name:'深圳巴士集团',person:'赵启超',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车'},{name:'高速公路管理处',person:'张继成',team:'公安交警行业组',covProds:'智能交通,出入口停车,移动终端,IPC'}], users:[{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,存储,NVR,球机,出入口停车'},{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,出入口'},{name:'东莞市交通局',person:'张继成',team:'公安交警行业组',covProds:'智能交通,球机,IPC,NVR'},{name:'汕头市交通局',person:'赵启超',team:'智慧建筑组',covProds:'智能交通,IPC,出入口停车'}] },
  '存储':     { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,智能交通,LCD,出入口'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能交通,球机,存储'},{name:'深圳大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,球机,LCD,通用软件,网络,存储'},{name:'深圳市交警支队',person:'房伟建',team:'公安交警行业组',covProds:'IPC,NVR,球机,智能交通,移动终端,出入口停车,服务器,存储,报警'},{name:'深圳地铁集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车,门禁,存储'},{name:'鹏城科技集团',person:'陈刚',team:'客户销售二组',covProds:'IPC,NVR,存储'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,网络,存储,出入口'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,智能交通,存储,球机'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,存储'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,出入口'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,存储,NVR,对讲'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'}] },
  'LCD与解码':{ custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'深圳大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,球机,LCD,通用软件,网络,存储'},{name:'南方科技大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,LCD,智慧屏,基础软件'},{name:'招商局地产',person:'朱迪',team:'客户销售四组',covProds:'IPC,门禁,LCD'},{name:'龙岗区教育局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,LCD'},{name:'珠海横琴智慧',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,存储,出入口,网络'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,平台软件,门禁'}], users:[{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,通用软件,平台软件'},{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储'},{name:'佛山市教育局',person:'罗兴华',team:'工业企业一组',covProds:'IPC,NVR,LCD,平台软件,门禁'},{name:'珠海市政务局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,球机,存储'},{name:'惠州市大数据局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,NVR,存储,LCD,门禁,通用软件'},{name:'深圳市文体局',person:'李梦琪',team:'政府行业组',covProds:'IPC,LCD,新业务,通用软件,NVR,门禁'}] },
  '出入口停车':{ custs:[{name:'深圳市交警支队',person:'房伟建',team:'公安交警行业组',covProds:'IPC,NVR,球机,智能交通,移动终端,出入口停车,服务器,存储'},{name:'深圳地铁集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车,门禁,存储'},{name:'深圳机场集团',person:'朱绪浩',team:'智慧建筑组',covProds:'IPC,门禁,智能交通,出入口停车,报警'},{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,球机,存储,NVR,出入口停车,移动终端'},{name:'华润万象城',person:'刘文宇',team:'客户销售三组',covProds:'IPC,门禁,出入口停车,报警'},{name:'深圳巴士集团',person:'赵启超',team:'智慧建筑组',covProds:'IPC,智能交通,移动终端,出入口停车'}], users:[{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,存储,NVR,球机,出入口停车'},{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,出入口停车'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,出入口停车,存储'}] },
  '音频产品': { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道,音频产品'},{name:'深圳市文体局',person:'李梦琪',team:'政府行业组',covProds:'LCD,新业务,通用软件,IPC,NVR,音频产品'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,音频产品,出入口'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁,音频产品'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,网络,存储,音频产品'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,音频产品'},{name:'深圳市教育局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机,音频产品'},{name:'深圳市文体局',person:'李梦琪',team:'政府行业组',covProds:'LCD,新业务,通用软件,IPC,NVR,音频产品'}] },
  '人员通道': { custs:[{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储,网络,出入口,对讲,人员通道'},{name:'深圳市卫健委',person:'李梦琪',team:'政府行业组',covProds:'IPC,门禁,通用软件,存储,NVR,对讲,人员通道'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,出入口,人员通道'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,网络,存储,人员通道'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,存储,NVR,对讲,人员通道'}], users:[{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,人员通道'},{name:'深圳市卫健委',person:'李梦琪',team:'政府行业组',covProds:'IPC,门禁,通用软件,存储,NVR,对讲,人员通道'},{name:'东莞市卫健局',person:'黄燕滨',team:'工业企业一组',covProds:'IPC,门禁,存储,NVR,对讲,人员通道'}] },
  '行业软件': { custs:[{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,球机,存储,NVR,行业软件'},{name:'深圳市交警支队',person:'房伟建',team:'公安交警行业组',covProds:'IPC,NVR,球机,智能交通,移动终端,服务器,存储,行业软件'},{name:'南方科技大学',person:'潘仲楠',team:'工业企业一组',covProds:'IPC,NVR,门禁,LCD,智慧屏,基础软件,行业软件'},{name:'广州政务云',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,网络,存储,行业软件'}], users:[{name:'广东省交通厅',person:'张伟',team:'公安交警行业组',covProds:'智能交通,IPC,存储,NVR,球机,行业软件'},{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,行业软件'},{name:'广州市公安局',person:'张伟',team:'公安交警行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD,存储,行业软件'}] }
};
App._getProdCovStock = function(prodName) {
  return App._prodCovStock[prodName] || {
    custs: [{name:'深圳市政府',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,LCD,存储'},{name:'宝安公安局',person:'王志强',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,存储,出入口'},{name:'罗湖教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,平台软件,门禁'}],
    users: [{name:'深圳市公安局',person:'陈思源',team:'政府行业组',covProds:'IPC,NVR,门禁,球机,智能交通,LCD'},{name:'深圳市教育局',person:'李梦琪',team:'政府行业组',covProds:'IPC,NVR,LCD,门禁,球机'}]
  };
};

App.showProdCovDrill = function(prodName, type) {
  var stock = App._getProdCovStock(prodName);
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '1000px'; modalBox.style.width = '92%'; }

  var tableHeader = '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb">' +
    '<th style="text-align:left;padding:8px 10px;width:170px">' + (type==='cust'?'客户名称':'用户名称') + '</th>' +
    '<th style="text-align:left;padding:8px 10px;width:110px">销售</th>' +
    '<th style="text-align:left;padding:8px 10px;width:140px">团队</th>' +
    '<th style="text-align:left;padding:8px 10px">覆盖品类</th></tr></thead>';

  if (type === 'cust') {
    var rows = (stock.custs||[]).map(function(c) {
      return '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 10px"><strong>' + c.name + '</strong></td><td style="padding:8px 10px">' + (c.person||'-') + '</td><td style="padding:8px 10px;color:#6b7280">' + c.team + '</td><td style="padding:8px 10px;font-size:12px;color:#374151">' + c.covProds + '</td></tr>';
    }).join('');
    var html = '<h3 style="margin:0 0 8px;font-size:18px">' + prodName + ' — 客户覆盖明细</h3>' +
      '<p style="margin:0 0 16px;color:#6b7280">已覆盖 <strong>' + (stock.custs||[]).length + '</strong> 个客户</p>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse">' + tableHeader + '<tbody>' + rows + '</tbody></table>';
  } else {
    var rows = (stock.users||[]).map(function(u) {
      return '<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 10px"><strong>' + u.name + '</strong></td><td style="padding:8px 10px">' + (u.person||'-') + '</td><td style="padding:8px 10px;color:#6b7280">' + u.team + '</td><td style="padding:8px 10px;font-size:12px;color:#374151">' + u.covProds + '</td></tr>';
    }).join('');
    var html = '<h3 style="margin:0 0 8px;font-size:18px">' + prodName + ' — 用户覆盖明细</h3>' +
      '<p style="margin:0 0 16px;color:#6b7280">已覆盖 <strong>' + (stock.users||[]).length + '</strong> 个用户</p>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse">' + tableHeader + '<tbody>' + rows + '</tbody></table>';
  }

  App.showModal(html);
};

// ===== 潜力产品 · 产品维度 — 产品点击下钻（客户+用户明细） =====
App._potProductCustomers = {};

App._potProductUsers = {};

App.showPotentialProductDrill = function(prodName) {
  // 优先从导入数据查找
  var custs = App._potProductCustomers[prodName] || [];
  var users = App._potProductUsers[prodName] || [];
  if (App.ImportPotential && App.ImportPotential.CustRAW && App.ImportPotential.CustRAW.length > 0) {
    custs = App.ImportPotential.CustRAW.filter(function(r) { return r.product === prodName; });
    if (App.ImportPotential.UserRAW && App.ImportPotential.UserRAW.length > 0) {
      users = App.ImportPotential.UserRAW.filter(function(r) { return r.product === prodName; });
    }
  }

  var custRows = custs.length > 0
    ? custs.map(function(c, i) {
        return '<tr style="border-bottom:1px solid #f3f4f6">' +
          '<td style="padding:6px 10px;text-align:center;color:#9ca3af">' + (i + 1) + '</td>' +
          '<td style="padding:6px 10px"><strong>' + c.name + '</strong></td>' +
          '<td style="padding:6px 10px">' + (c.person || '-') + '</td>' +
          '<td style="padding:6px 10px;color:#6b7280">' + (c.team || '-') + '</td></tr>';
      }).join('')
    : '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af">暂无明细数据</td></tr>';

  var userRows = users.length > 0
    ? users.map(function(u, i) {
        return '<tr style="border-bottom:1px solid #f3f4f6">' +
          '<td style="padding:6px 10px;text-align:center;color:#9ca3af">' + (i + 1) + '</td>' +
          '<td style="padding:6px 10px"><strong>' + u.name + '</strong></td>' +
          '<td style="padding:6px 10px;text-align:center">' + (u.custCnt || '-') + '</td>' +
          '<td style="padding:6px 10px">' + (u.person || '-') + '</td>' +
          '<td style="padding:6px 10px;color:#6b7280">' + (u.team || '-') + '</td></tr>';
      }).join('')
    : '<tr><td colspan="5" style="padding:12px;text-align:center;color:#9ca3af">暂无明细数据</td></tr>';

  var bodyHtml =
    '<p style="margin:0 0 16px;color:#6b7280">客户 <strong>' + custs.length + '</strong> 个 · 用户 <strong>' + users.length + '</strong> 个</p>' +
      '<div>' +
        '<h4 style="margin:0 0 8px;font-size:14px;color:#374151">👥 客户明细</h4>' +
        '<table style="width:100%;font-size:13px;border-collapse:collapse">' +
          '<thead><tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb"><th style="padding:6px 10px;text-align:center;width:40px">#</th><th style="padding:6px 10px;text-align:left">客户名称</th><th style="padding:6px 10px;text-align:left">销售</th><th style="padding:6px 10px;text-align:left">所属团队</th></tr></thead>' +
          '<tbody>' + custRows + '</tbody></table>' +
      '</div>' +
      '<div>' +
        '<h4 style="margin:0 0 8px;font-size:14px;color:#374151">🏢 用户明细</h4>' +
        '<table style="width:100%;font-size:13px;border-collapse:collapse">' +
          '<thead><tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb"><th style="padding:6px 10px;text-align:center;width:40px">#</th><th style="padding:6px 10px;text-align:left">用户名称</th><th style="padding:6px 10px;text-align:center">关联客户</th><th style="padding:6px 10px;text-align:left">销售</th><th style="padding:6px 10px;text-align:left">所属团队</th></tr></thead>' +
          '<tbody>' + userRows + '</tbody></table>' +
      '</div>' +
    '</div>';

  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '1100px'; modalBox.style.width = '95%'; }
  App.showModal(prodName + ' — 出货明细', bodyHtml);
};

// ===== 产品宽度 - 用户维度 Tab 动态渲染（跟随页级筛选） =====
App.renderWidthUserTab = function() {
  var state = App.getFilterState('page-width');
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;
  var s = function(v) { return Math.round(v * sf); };

  // 渲染优质/待提升用户列表
  var uWData = App.Data.getWidth(team);
  if (uWData) {
    App.renderUserList('w-tbody-user-good', (uWData.userGood || []).slice(0, 10).map(function(u) {
      return { name: u.name, avgW: +(u.avgW * (sf > 0.5 ? 1 : 0.8 + sf)).toFixed(1), custCnt: s(u.custCnt), soldCnt: s(u.soldCnt), custs: u.custs, sold: u.sold };
    }), true);
    App.renderUserList('w-tbody-user-bad', (uWData.userBad || []).slice(0, 10).map(function(u) {
      return { name: u.name, avgW: +(u.avgW * (sf > 0.5 ? 1 : 0.8 + sf)).toFixed(1), custCnt: s(u.custCnt), soldCnt: s(u.soldCnt), custs: u.custs, sold: u.sold };
    }), false);
  }
};

// ===== 产品宽度 - 问题诊断动态渲染（跟随页级筛选） =====
App.renderWidthProblemDiag = function() {
  var tbody = document.getElementById('wProblemDiagBody');
  if (!tbody) return;
  var state = App.getFilterState('page-width');
  var team = state.team, group = state.group, person = state.person;
  var scopeLabel = team !== 'all' ? team : (group !== 'all' ? group : '全部门');

  var problems = [
    { desc:'<strong>智能计算覆盖率仅 5.1%</strong> — ' + (team !== 'all' ? team : '888') + ' 规上客户中仅 45 户覆盖', severity:'🔴 严重', sevCls:'background:#fee2e2;color:#dc2626', scope:(team !== 'all' ? '843 客户' : '843 客户'), suggestion:'作为新增潜力品类优先推广，制定行业模板方案，目标 3 个月覆盖率达 15%', priority:'P1', priCls:'background:#fef3c7;color:#92400e' },
    { desc:'<strong>47 个规上客户未覆盖 IPC</strong> — 最基础品类仍有空白', severity:'🔴 严重', sevCls:'background:#fee2e2;color:#dc2626', scope:'47 客户 · ¥ 2,150万', suggestion:'组织"IPC空白客户"专项突破，优先攻克销售额 TOP 20 中的未覆盖客户', priority:'P1', priCls:'background:#fef3c7;color:#92400e' },
    { desc:'<strong>门禁覆盖率同比下降 8.2%</strong> — 客户流失趋势明显', severity:'🟡 警告', sevCls:'background:#fef3c7;color:#92400e', scope:'247 → 预计持续下滑', suggestion:'门禁 + NVR 联动打包销售，针对流失客户定向回访，提供以旧换新方案', priority:'P2', priCls:'background:#dbeafe;color:#2563eb' },
    { desc:'<strong>智慧建筑组宽度下滑 -5.4%</strong> — 团队维度落后明显', severity:'🟡 警告', sevCls:'background:#fef3c7;color:#92400e', scope:'智慧建筑组 · 187 客户', suggestion:'团队专项辅导，参考政府行业组经验，重点突破存储和门禁品类', priority:'P2', priCls:'background:#dbeafe;color:#2563eb' },
    { desc:'<strong>非规上客户平均宽度仅 1.6</strong> — 与规上差距 4.4 品类', severity:'🔵 关注', sevCls:'background:#d1fae5;color:#065f46', scope:'359 非规上客户', suggestion:'建立非规上客户培育机制，目标每客户新增 1-2 品类/半年', priority:'P3', priCls:'background:#e5e7eb;color:#6b7280' }
  ];

  // 如果指定了部门，过滤相关问题
  if (team !== 'all') {
    problems = problems.filter(function(p) {
      return p.scope.indexOf(team) >= 0 || p.scope.indexOf('全部门') >= 0 || p.scope.indexOf('843') >= 0;
    });
  }

  tbody.innerHTML = problems.map(function(p, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    return '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td>' + p.desc + '</td>' +
      '<td><span class="badge" style="' + p.sevCls + '">' + p.severity + '</span></td>' +
      '<td>' + p.scope + '</td>' +
      '<td>' + p.suggestion + '</td>' +
      '<td><span class="badge" style="' + p.priCls + '">' + p.priority + '</span></td>' +
      '</tr>';
  }).join('');
};

// ===== 潜力产品 - 团队维度 Tab 动态渲染（跟随页级筛选） =====
App.renderPotentialTeamTab = function() {
  var state = App.getFilterState('page-potential');

  // ===== 增长结构分析 =====
  try { App.renderGapDeepDive(state); } catch(e) { console.warn('renderGapDeepDive 失败:', e); }

  // ===== 差距看板（内部自动同步按钮） =====
  try { App.renderTeamScorecard(state); } catch(e) { console.warn('renderTeamScorecard 失败:', e); }
};

// ===== 增长结构分析（与差距看板共享 dim + 数据逻辑） =====
App.renderGapDeepDive = function(state) {
  var team = state.team, group = state.group, person = state.person;
  var dim = App._scorecardDim || 'group';
  var scopeLabel = person !== 'all' ? person : group !== 'all' ? group : team !== 'all' ? team : '全公司';

  // 与差距看板一致的自动下钻 + 同步 App._scorecardDim
  if (team !== 'all' && group === 'all' && person === 'all') { dim = 'dept'; App._scorecardDim = 'dept'; }
  else if (group !== 'all' && person === 'all') { dim = 'group'; App._scorecardDim = 'group'; }
  else if (person !== 'all') { dim = 'person'; App._scorecardDim = 'person'; }
  // 同步两个卡片的按钮
  ['#p-scorecard-dim-btns', '#p-growth-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });

  var tagEl = document.getElementById('p-gap-deepdive-tag');
  if (tagEl) tagEl.textContent = '按' + (dim==='dept'?'部门':dim==='group'?'小组':'个人') + ' · ' + scopeLabel;

  // 与差距看板一致的列显隐
  var showDept = (group === 'all' && person === 'all');
  var showGrp  = (dim === 'group' || dim === 'person');

  // ── 构建行数据（与 scorecard 一致） ──
  var rows = [];
  var growthType = function(yoy) {
    if (yoy > 15) return { label: '拓客型增长', cls: 'b-up', icon: '✅' };
    if (yoy > 0) return { label: '存量深耕', cls: 'b-up', icon: '📈' };
    if (yoy > -10) return { label: '存量深耕', cls: 'b-warn', icon: '📊' };
    return { label: '流失预警', cls: 'b-down', icon: '⚠️' };
  };

  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var yoy = parseFloat(d.yoy || '5');
      var gt = growthType(yoy);
      rows.push({ dept: d.n, grp: '', name: '', label: d.n, cw: d.cw, yoy: yoy, gt: gt });
    });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) {
      if (team !== 'all' && g.dept !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var yoy = parseFloat(g.yoy || '5');
      var gt = growthType(yoy);
      rows.push({ dept: g.dept, grp: g.n, name: '', label: g.n, cw: g.cw, yoy: yoy, gt: gt });
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var yoy = parseFloat(p.yoy || '3');
      var gt = growthType(yoy);
      rows.push({ dept: p.dept || '-', grp: p.grp || '-', name: p.n, label: p.n, cw: p.cw || 10, yoy: yoy, gt: gt });
    });
  }

  var tbody = document.getElementById('p-growth-struct-grid');
  if (tbody) {
    // 更新表头
    var thead = document.getElementById('p-growth-struct-thead');
    if (thead) {
      var thHtml = '<tr>';
      if (showDept) thHtml += '<th>部门</th>';
      if (showGrp) thHtml += '<th>组</th>';
      if (dim === 'person') thHtml += '<th>个人</th>';
      thHtml += '<th style="text-align:center">同比</th>';
      thHtml += '<th style="text-align:center;color:#059669">新增客户</th>';
      thHtml += '<th style="text-align:center;color:#3b82f6">存量深耕</th>';
      thHtml += '<th style="text-align:center;color:#ef4444">流失预警</th>';
      thHtml += '<th style="text-align:center">增长类型</th></tr>';
      thead.innerHTML = thHtml;
    }

    // 分页
    var gPageSize = parseInt((document.getElementById('p-growth-page-size')||{}).value) || 20;
    var gTotal = rows.length;
    var gPages = Math.ceil(gTotal / gPageSize);
    if (!App._growthPage || App._growthPage > gPages) App._growthPage = gPages || 1;
    var gStart = (App._growthPage - 1) * gPageSize;
    var gRows = rows.slice(gStart, gStart + gPageSize);
    App.setText('p-growth-total', '共 ' + gTotal + ' 条');

    tbody.innerHTML = gRows.map(function(r, gi) {
      var idx = gStart + gi + 1;
      var yoyDisplay = (r.yoy >= 0 ? '+' : '') + r.yoy.toFixed(1) + '%';
      var newCust = r.gt.label === '拓客型增长' ? Math.round(r.cw * 0.25) : Math.round(r.cw * 0.08);
      var deepCust = r.gt.label === '流失预警' ? Math.round(r.cw * 0.15) : Math.round(r.cw * 0.42);
      var lostCust = Math.round(r.cw * (r.gt.label === '流失预警' ? 0.12 : 0.03));
      var clickTarget = dim === 'dept' ? r.dept : (dim === 'group' ? r.grp : r.name);
      var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : '');
      var clickHandler = clickFn ? 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"' : '';

      var cells = '';
      if (showDept) cells += '<td style="color:#1a56db;font-weight:600">' + r.dept + '</td>';
      if (showGrp) cells += '<td style="font-weight:600;color:#1a56db">' + r.grp + '</td>';
      if (dim === 'person') cells += '<td>' + r.name + '</td>';

      var labelCell = dim === 'dept' ? r.dept : (dim === 'group' ? r.grp : r.name);
      return '<tr style="cursor:pointer" ' + clickHandler + '>' + cells +
        '<td style="text-align:center"><span class="badge ' + (r.yoy >= 0 ? 'b-up' : 'b-down') + '">' + yoyDisplay + '</span></td>' +
        '<td style="text-align:center;cursor:pointer;color:#059669;font-weight:700" onclick="event.stopPropagation();App.showGrowthDetailModal(\'' + labelCell + '\',\'new\',' + newCust + ')" title="点击查看新增客户明细">' + newCust + '</td>' +
        '<td style="text-align:center;cursor:pointer;color:#3b82f6;font-weight:700" onclick="event.stopPropagation();App.showGrowthDetailModal(\'' + labelCell + '\',\'deep\',' + deepCust + ')" title="点击查看存量深耕明细">' + deepCust + '</td>' +
        '<td style="text-align:center;cursor:pointer;color:#ef4444;font-weight:700" onclick="event.stopPropagation();App.showGrowthDetailModal(\'' + labelCell + '\',\'lost\',' + lostCust + ')" title="点击查看流失预警明细">' + lostCust + '</td>' +
        '<td style="text-align:center"><span class="badge ' + r.gt.cls + '">' + r.gt.icon + ' ' + r.gt.label + '</span></td></tr>';
    }).join('');

    // 分页器
    var gPager = document.getElementById('p-growth-pager');
    if (gPager && gPages > 1) {
      var ph = '';
      for (var pg = 1; pg <= gPages; pg++) {
        var ac = pg === App._growthPage ? 'style="background:#1a56db;color:#fff;font-weight:700"' : 'style="cursor:pointer"';
        ph += '<button ' + ac + ' onclick="App._growthPage=' + pg + ';App.renderGapDeepDive(App.getFilterState(&apos;page-potential&apos;))" style="margin:0 2px;padding:2px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:11px">' + pg + '</button>';
      }
      gPager.innerHTML = ph;
    } else if (gPager) { gPager.innerHTML = ''; }
  }
};

// ===== 差距看板：横向竞争 & 目标追踪 =====
// 目标数据存储
App._scorecardDim = 'group'; // dept | group | person

App.setScorecardDim = function(dim) {
  App._scorecardDim = dim;
  // 同步两个卡片的按钮
  ['#p-scorecard-dim-btns', '#p-growth-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });
  App.renderTeamScorecard(App.getFilterState('page-potential'));
  // 同步刷新增长结构
  try { App.renderGapDeepDive(App.getFilterState('page-potential')); } catch(e) {}
};

App.renderTeamScorecard = function(state) {
  var team = state.team, group = state.group, person = state.person;
  var dim = App._scorecardDim || 'group';
  var metric = (document.getElementById('p-scorecard-metric') || {}).value || 'sales';

  // 筛选自动下钻：部门 → 组 → 个人
  if (team !== 'all' && group === 'all' && person === 'all') { dim = 'dept'; App._scorecardDim = 'dept'; }
  else if (group !== 'all' && person === 'all') { dim = 'group'; App._scorecardDim = 'group'; }
  else if (person !== 'all') { dim = 'person'; App._scorecardDim = 'person'; }
  // 同步两个卡片的按钮active
  ['#p-scorecard-dim-btns','#p-growth-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });

  // ── 根据 dim 构建行数据 ──
  // 行结构: { dept, grp, name, sales, newProdSales, coverage, cw, yoy, newCust }
  var rows = [];

  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var sales = Math.round(d.cw * 42 + 0);
      rows.push({
        dept: d.n, grp: '', name: '',
        sales: sales, newProdSales: Math.round(sales * (0.08 + 0)),
        coverage: parseFloat((d.cov || 65).toString()), cw: d.cw,
        yoy: parseFloat((d.yoy || '+5').toString()), newCust: Math.round(d.cw * 0.12)
      });
    });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) {
      if (team !== 'all' && g.dept !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var sales = (g.cw || 80) * 42 + 0;
      rows.push({
        dept: g.dept, grp: g.n, name: '',
        sales: sales, newProdSales: Math.round(sales * (0.08 + 0)),
        coverage: parseFloat((g.cov || 65).toString()), cw: g.cw,
        yoy: parseFloat((g.yoy || '+5').toString()), newCust: Math.round(g.cw * 0.1)
      });
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var sales = (p.cw || 15) * 38 + 0;
      rows.push({
        dept: p.dept || '-', grp: p.grp || '-', name: p.n,
        sales: sales, newProdSales: Math.round(sales * (0.05 + 0)),
        coverage: parseFloat((p.cov || 60).toString()), cw: p.cw || 10,
        yoy: parseFloat((p.yoy || '+3').toString()), newCust: Math.round((p.cw || 10) * 0.08)
      });
    });
  }

  // 计算趋势
  rows.forEach(function(r) {
    r._yoy = r.yoy;
    r._trend = r._yoy > 10 ? '↑' : (r._yoy > 0 ? '↗' : (r._yoy > -5 ? '→' : '↓'));
    r._trendCls = r._yoy > 10 ? 'b-up' : (r._yoy > 0 ? 'b-up' : (r._yoy > -5 ? 'b-flat' : 'b-down'));
  });

  // 排序
  var sortKey = metric === 'newProd' ? 'newProdSales' : (metric === 'coverage' ? 'coverage' : (metric === 'newCust' ? 'newCust' : 'sales'));
  rows.sort(function(a, b) { return b[sortKey] - a[sortKey]; });

  // ── 分页 ──
  var scorePageSize = parseInt((document.getElementById('p-scorecard-page-size')||{}).value) || 20;
  var scoreTotal = rows.length;
  var scorePages = Math.ceil(scoreTotal / scorePageSize);
  if (!App._scorecardPage || App._scorecardPage > scorePages) App._scorecardPage = scorePages || 1;
  var scoreStart = (App._scorecardPage - 1) * scorePageSize;
  var pageRows = rows.slice(scoreStart, scoreStart + scorePageSize);
  App.setText('p-scorecard-total', '共 ' + scoreTotal + ' 条');

  // 列头（动态生成，按筛选层级精简：选小组隐藏部门，选个人隐藏部门+组）
  var showDept = (group === 'all' && person === 'all');
  var showGrp  = (person === 'all' && (dim === 'group' || dim === 'person'));
  var showPerson = (dim === 'person');
  var colNames = { sales: ['销售额(万)', '覆盖率%'], newProd: ['新品营收(万)', '新品占比%'], coverage: ['覆盖率%', '客户数'], newCust: ['新增客户', '新增占比%'] };
  var cn = colNames[metric] || ['销售额(万)', '覆盖率%'];

  var thead = document.getElementById('p-scorecard-thead');
  if (thead) {
    var thHtml = '<tr><th style="width:32px">#</th>';
    if (showDept) thHtml += '<th>部门</th>';
    if (showGrp) thHtml += '<th>组</th>';
    if (showPerson) thHtml += '<th>个人</th>';
    thHtml += '<th style="text-align:right;white-space:nowrap">' + cn[0] + '</th>';
    thHtml += '<th style="text-align:center;white-space:nowrap">同比</th>';
    thHtml += '<th style="text-align:right;white-space:nowrap">' + cn[1] + '</th>';
    thHtml += '<th style="text-align:center;white-space:nowrap">趋势</th></tr>';
    thead.innerHTML = thHtml;
  }

  // 表体
  var tbody = document.getElementById('p-scorecard-body');
  if (tbody) {
    tbody.innerHTML = pageRows.map(function(r, i) {
      var idx = scoreStart + i + 1;
      var rn = idx <= 3 ? 'rn' + idx : 'rn0';
      var val1 = metric === 'newProd' ? r.newProdSales : (metric === 'coverage' ? r.coverage.toFixed(1) + '%' : (metric === 'newCust' ? r.newCust : r.sales));
      var val2 = metric === 'newProd' ? (r.newProdSales / r.sales * 100).toFixed(1) + '%' : (metric === 'coverage' ? r.cw : (metric === 'newCust' ? (r.newCust / r.cw * 100).toFixed(1) + '%' : r.coverage.toFixed(1) + '%'));
      var yoyDisplay = (r._yoy >= 0 ? '+' : '') + r._yoy.toFixed(1) + '%';
      var clickTarget = dim === 'dept' ? r.dept : (dim === 'group' ? r.grp : r.name);
      var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : '');
      var clickHandler = clickFn ? 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"' : '';
      var cells = '';
      if (showDept) cells += '<td style="color:#1a56db;font-weight:600">' + r.dept + '</td>';
      if (showGrp) cells += '<td style="text-decoration:underline;color:#1a56db;font-weight:600">' + r.grp + '</td>';
      if (showPerson) cells += '<td style="font-weight:600">' + r.name + '</td>';
      return '<tr style="cursor:pointer" ' + clickHandler + ' title="点击查看详情">' +
        '<td><span class="rn ' + rn + '">' + idx + '</span></td>' + cells +
        '<td style="text-align:right;font-weight:600">' + (typeof val1 === 'number' ? val1.toLocaleString() : val1) + '</td>' +
        '<td style="text-align:center"><span class="badge ' + r._trendCls + '">' + yoyDisplay + '</span></td>' +
        '<td style="text-align:right">' + val2 + '</td>' +
        '<td style="text-align:center;font-size:14px;' + (r._trend === '↓' ? 'color:#dc2626' : 'color:#059669') + '">' + r._trend + '</td></tr>';
    }).join('');
  }

  // 分页器
  var pager = document.getElementById('p-scorecard-pager');
  if (pager && scorePages > 1) {
    var ph = '';
    for (var pg = 1; pg <= scorePages; pg++) {
      var ac = pg === App._scorecardPage ? 'style="background:#1a56db;color:#fff;font-weight:700"' : 'style="cursor:pointer"';
      ph += '<button ' + ac + ' onclick="App._scorecardPage=' + pg + ';App.renderTeamScorecard(App.getFilterState(&apos;page-potential&apos;))" style="margin:0 2px;padding:2px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:11px">' + pg + '</button>';
    }
    pager.innerHTML = ph;
  } else if (pager) { pager.innerHTML = ''; }
};

App.refreshTeamScorecard = function() {
  App._scorecardPage = 1;
  App.renderTeamScorecard(App.getFilterState('page-potential'));
};

// ===== 客户分层数据引擎 =====
App._custSegData = {
  star: [
    { cust:'深圳市政府', sales:880, width:9, yoy:'+18%', prods:['观澜编码','出入口停车','前端大模型','网络产品','后端大模型','人员通道','会议平板','国密产品','执法记录仪'], prevSeg:'star' },
    { cust:'宝安公安局', sales:720, width:8, yoy:'+12%', prods:['观澜编码','前端大模型','网络产品','会议平板','国密产品','执法记录仪','物联安全','音频产品'], prevSeg:'star' },
    { cust:'罗湖教育局', sales:650, width:7, yoy:'+22%', prods:['观澜编码','出入口停车','前端大模型','会议平板','国密产品','物联安全','音频产品'], prevSeg:'cash' },
    { cust:'广东省交通厅', sales:580, width:8, yoy:'+15%', prods:['出入口停车','前端大模型','网络产品','后端大模型','人员通道','国密产品','执法记录仪','物联安全'], prevSeg:'star' },
    { cust:'高峰10', sales:520, width:7, yoy:'+35%', prods:['观澜编码','前端大模型','后端大模型','会议平板','国密产品','执法记录仪','物联安全'], prevSeg:'potential' }
  ],
  cash: [
    { cust:'招商17', sales:420, width:6, yoy:'+5%', prods:['观澜编码','出入口停车','前端大模型','人员通道','会议平板','国密产品'], prevSeg:'cash' },
    { cust:'深圳大学', sales:380, width:5, yoy:'+8%', prods:['观澜编码','出入口停车','会议平板','国密产品','物联安全'], prevSeg:'cash' },
    { cust:'南方科技大学', sales:350, width:6, yoy:'+10%', prods:['观澜编码','前端大模型','网络产品','国密产品','执法记录仪','物联安全'], prevSeg:'cash' },
    { cust:'深圳市卫健委', sales:320, width:5, yoy:'-3%', prods:['前端大模型','人员通道','会议平板','国密产品','音频产品'], prevSeg:'star' },
    { cust:'深圳机场集团', sales:280, width:4, yoy:'+12%', prods:['出入口停车','人员通道','国密产品','音频产品'], prevSeg:'cash' }
  ],
  potential: [
    { cust:'深圳巴士集团', sales:220, width:3, yoy:'-5%', prods:['出入口停车','后端大模型','人员通道'], prevSeg:'sleep' },
    { cust:'天眼监控', sales:180, width:2, yoy:'+18%', prods:['前端大模型','物联安全'], prevSeg:'sleep' },
    { cust:'招商局地产', sales:150, width:3, yoy:'+8%', prods:['观澜编码','出入口停车','网络产品'], prevSeg:'potential' },
    { cust:'鹏城科技', sales:130, width:2, yoy:'+25%', prods:['会议平板','国密产品'], prevSeg:'potential' },
    { cust:'深圳交警支队', sales:110, width:1, yoy:'新增', prods:['前端大模型'], prevSeg:'new' }
  ],
  sleep: [
    { cust:'龙岗分局', sales:80, width:1, yoy:'-15%', prods:['观澜编码'], prevSeg:'potential' },
    { cust:'南山教育局', sales:60, width:1, yoy:'-8%', prods:['会议平板'], prevSeg:'sleep' },
    { cust:'深圳文体局', sales:45, width:1, yoy:'新增', prods:['音频产品'], prevSeg:'new' },
    { cust:'港口集团', sales:35, width:1, yoy:'-22%', prods:['物联安全'], prevSeg:'cash' },
    { cust:'车管所', sales:25, width:1, yoy:'-30%', prods:['网络产品'], prevSeg:'potential' }
  ]
};

// 客户分层卡片渲染

// 点击卡片 → 筛选下钻

// 客户分层下钻弹窗

// 增长结构指标下钻
App.showGrowthDetailModal = function(groupName, type, count) {
  var typeLabel = type === 'new' ? '新增客户' : (type === 'deep' ? '存量深耕' : '流失预警');
  var typeColor = type === 'new' ? '#059669' : (type === 'deep' ? '#3b82f6' : '#ef4444');
  var g = App.GROUPS.find(function(x) { return x.n === groupName; });

  // 模拟明细数据
  var details = [];
  if (type === 'new') {
    details = [
      { cust: groupName + '新客户A', product: '前端大模型', amt: 280, yoy: '新增', note: '首次合作' },
      { cust: groupName + '新客户B', product: '后端大模型(文搜大模型）', amt: 200, yoy: '新增', note: '首次合作' },
      { cust: groupName + '新客户C', product: '观澜编码产品（非大模型）', amt: 150, yoy: '新增', note: '首次合作' },
      { cust: groupName + '新客户D', product: '会议平板与视频会议', amt: 120, yoy: '新增', note: '首次合作' },
      { cust: groupName + '新客户E', product: '物联安全', amt: 90, yoy: '新增', note: '首次合作' }
    ];
  } else if (type === 'deep') {
    details = [
      { cust: groupName + '存量A', product: '观澜编码产品（非大模型）', amt: 420, yoy: '+18%', note: '增购品类' },
      { cust: groupName + '存量B', product: '国密产品', amt: 350, yoy: '+12%', note: '扩容升级' },
      { cust: groupName + '存量C', product: '网络产品', amt: 280, yoy: '+8%', note: '交叉销售' },
      { cust: groupName + '存量D', product: '出入口停车', amt: 200, yoy: '+25%', note: '增购品类' },
      { cust: groupName + '存量E', product: '执法记录仪', amt: 150, yoy: '+5%', note: '稳定采购' }
    ];
  } else {
    details = [
      { cust: groupName + '流失A', product: '音频产品', amt: 50, yoy: '-32%', note: '预算缩减' },
      { cust: groupName + '流失B', product: '人员通道', amt: 35, yoy: '-18%', note: '竞品替代' },
      { cust: groupName + '预警C', product: '网络产品', amt: 80, yoy: '-8%', note: '采购放缓' }
    ];
  }

  var h = '<h3 style="margin:0 0 4px">' + groupName + ' · ' + typeLabel + ' <span style="font-size:14px;color:' + typeColor + '">' + count + '个</span></h3>';
  if (g) h += '<div style="font-size:12px;color:#6b7280;margin-bottom:12px">' + g.dept + ' · ' + g.cw + '客户</div>';
  h += '<table class="table tight-table"><thead><tr><th>客户</th><th>产品</th><th style="text-align:right">销售额(万)</th><th style="text-align:center">同比</th><th>说明</th></tr></thead><tbody>';
  details.forEach(function(d) {
    var yoyCls = d.yoy === '新增' ? 'b-new' : (d.yoy.indexOf('-') >= 0 ? 'b-down' : 'b-up');
    h += '<tr><td>' + d.cust + '</td><td>' + d.product + '</td><td style="text-align:right">¥' + d.amt + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + d.yoy + '</span></td><td>' + d.note + '</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(groupName + ' · ' + typeLabel + ' 明细', h);
};

// 部门下钻 → 展示该部门下所有小组
App.showDeptDrillModal = function(deptName) {
  var d = App.DEPTS.find(function(x) { return x.n === deptName; });
  if (!d) return;
  var groups = App.GROUPS.filter(function(g) { return g.dept === deptName; });
  var h = '<h3 style="margin:0 0 8px">🏢 ' + deptName + ' <span style="font-size:13px;color:#6b7280">主管: ' + (d.ld || '-') + ' · ' + d.cw + '客户</span></h3>';
  h += '<table class="table tight-table"><thead><tr><th>小组</th><th style="text-align:center">客户数</th><th style="text-align:center">覆盖率</th><th style="text-align:center">同比</th><th>主管</th></tr></thead><tbody>';
  groups.forEach(function(g) {
    var yoyVal = parseFloat(g.yoy) || 0;
    var yoyCls = yoyVal > 0 ? 'b-up' : (yoyVal < -5 ? 'b-down' : 'b-warn');
    var yoyDisp = (yoyVal >= 0 ? '+' : '') + yoyVal.toFixed(1) + '%';
    h += '<tr style="cursor:pointer" onclick="App.closeModal();App.showGroupDrillModal(\'' + g.n + '\')" title="点击查看' + g.n + '详情">' +
      '<td style="text-decoration:underline;color:#1a56db;font-weight:600">' + g.n + '</td>' +
      '<td style="text-align:center">' + g.cw + '</td>' +
      '<td style="text-align:center">' + (g.cov || '-') + '%</td>' +
      '<td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td>' +
      '<td>' + (g.ld || '-') + '</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(deptName + ' 部门详情', h);
};

App.showGroupDrillModal = function(groupName) {
  var g = App.GROUPS.find(function(x) { return x.n === groupName; });
  if (!g) return;

  // 该小组产品趋势数据
  var prods = App.ALL_POT_PRODUCTS;
  var prodCurr = prods.map(function(p) { return 0; });
  var prodPrev = prodCurr.map(function(v) { return 0; });

  // 该小组成员业绩
  var members = App.PERSONS.filter(function(p) { return p.grp === groupName; });
  if (members.length === 0) members = [{ n: '成员A', cw: 15, cov: 62 }, { n: '成员B', cw: 12, cov: 58 }, { n: '成员C', cw: 18, cov: 71 }, { n: '成员D', cw: 10, cov: 55 }];

  // 客户清单
  var custs = [
    { name: groupName + '核心客户1', type: '存量', amt: Math.round(g.cw * 15), yoy: '+18%' },
    { name: groupName + '核心客户2', type: '存量', amt: Math.round(g.cw * 10), yoy: '+5%' },
    { name: groupName + '新增客户A', type: '新增', amt: Math.round(g.cw * 5), yoy: 'NEW' },
    { name: groupName + '预警客户1', type: '流失', amt: Math.round(g.cw * 3), yoy: '-32%' }
  ];

  var h = '<div style="max-height:70vh;overflow-y:auto">';

  // 标题
  h += '<h3 style="margin:0 0 8px">📋 ' + groupName + ' <span style="font-size:13px;color:#6b7280">' + g.dept + '</span></h3>';

  // 1. 产品趋势
  h += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">📈 12产品销售额趋势</div>';
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
  prods.forEach(function(p, i) {
    var yoy = prodPrev[i] > 0 ? Math.round((prodCurr[i] - prodPrev[i]) / prodPrev[i] * 100) : 100;
    var clr = yoy > 10 ? '#059669' : (yoy > 0 ? '#6366f1' : (yoy > -10 ? '#d97706' : '#dc2626'));
    h += '<div style="width:calc(25% - 3px);background:#f8fafc;border-radius:6px;padding:6px 8px;font-size:11px">';
    h += '<div style="font-weight:600">' + p + '</div>';
    h += '<div>本期 ¥' + prodCurr[i] + '万</div>';
    h += '<div style="font-size:10px;color:#9ca3af">同期 ¥' + prodPrev[i] + '万</div>';
    h += '<span style="color:' + clr + ';font-weight:600">' + (yoy >= 0 ? '+' : '') + yoy + '%</span></div>';
  });
  h += '</div></div>';

  // 2. 成员业绩
  h += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">👤 业务员业绩明细</div>';
  h += '<table class="table tight-table"><thead><tr><th>姓名</th><th style="text-align:center">客户数</th><th style="text-align:center">覆盖率</th><th style="text-align:right">预估销售额</th></tr></thead><tbody>';
  members.forEach(function(m) {
    h += '<tr><td>' + m.n + '</td><td style="text-align:center">' + (m.cw || 10) + '</td><td style="text-align:center">' + (m.cov || 60) + '%</td><td style="text-align:right">¥' + Math.round((m.cw || 10) * 38) + '万</td></tr>';
  });
  h += '</tbody></table></div>';

  // 3. 客户清单
  h += '<div><div style="font-weight:700;margin-bottom:6px">🏢 客户清单</div>';
  h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:center">类型</th><th style="text-align:right">销售额</th><th style="text-align:center">同比</th></tr></thead><tbody>';
  custs.forEach(function(c) {
    var tc = c.type === '新增' ? 'b-new' : (c.type === '流失' ? 'b-down' : 'b-up');
    h += '<tr><td>' + c.name + '</td><td style="text-align:center"><span class="badge ' + tc + '">' + c.type + '</span></td><td style="text-align:right">¥' + c.amt + '万</td><td style="text-align:center">' + c.yoy + '</td></tr>';
  });
  h += '</tbody></table></div>';

  h += '</div>';
  App.showModal(groupName + ' 详情', h);
};

App.showGroupProductDrillModal = function(groupName, productName) {
  // 该产品在小组内的贡献客户明细
  var custs = [
    { name: '客户A', amt: 420, prev: 350, yoy: '+20%', yoyCls: 'b-up', note: '增长客户' },
    { name: '客户B', amt: 280, prev: 310, yoy: '-9.7%', yoyCls: 'b-warn', note: '小幅下滑' },
    { name: '客户C', amt: 180, prev: 0, yoy: '新增', yoyCls: 'b-new', note: '新拓客户' },
    { name: '客户D', amt: 120, prev: 200, yoy: '-40%', yoyCls: 'b-down', note: '⚠️ 严重下滑' },
    { name: '客户E', amt: 90, prev: 85, yoy: '+5.9%', yoyCls: 'b-up', note: '稳定增长' }
  ];

  var h = '<h3 style="margin:0 0 8px">📦 ' + groupName + ' · ' + productName + ' 客户明细</h3>';
  h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">本期(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th><th>定位</th></tr></thead><tbody>';
  custs.forEach(function(c) {
    h += '<tr><td>' + c.name + '</td><td style="text-align:right">¥' + c.amt + '万</td><td style="text-align:right">¥' + c.prev + '万</td><td style="text-align:center"><span class="badge ' + c.yoyCls + '">' + c.yoy + '</span></td><td>' + c.note + '</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(groupName + ' · ' + productName + ' 客户明细', h);
};

// ===== 客户维度共享 dim 状态 =====
App._custDim = 'person';
App.setCustDim = function(dim) {
  App._custDim = dim;
  App._custPage = 1;
  App.renderPotentialCustTab();
};

// ===== 客户交叉矩阵（11产品 + hover + 汇总 + 切换） =====

// ===== 生命周期下钻 =====

// ===== 客户生命周期分析 =====

// ===== 交叉销售机会清单 =====
App.renderCrossSell = function(state) {
  state = state || App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;

  var opps = [
    { cust:'招商17', covered:['观澜编码','出入口停车','前端大模型','人员通道','会议平板','国密产品'], uncovered:['网络产品','后端大模型','执法记录仪','物联安全','音频产品'], value:280, person:'陈伟杰' },
    { cust:'深圳大学', covered:['观澜编码','出入口停车','会议平板','国密产品','物联安全'], uncovered:['前端大模型','网络产品','后端大模型','人员通道','执法记录仪','音频产品'], value:350, person:'罗兴华' },
    { cust:'天眼监控', covered:['前端大模型','物联安全'], uncovered:['观澜编码','出入口停车','网络产品','后端大模型','人员通道','会议平板','国密产品','执法记录仪','音频产品'], value:620, person:'张栋柱' },
    { cust:'龙岗分局', covered:['观澜编码'], uncovered:['出入口停车','前端大模型','网络产品','后端大模型','人员通道','会议平板','国密产品','执法记录仪','物联安全','音频产品'], value:480, person:'张伟' },
    { cust:'深圳机场集团', covered:['出入口停车','人员通道','国密产品','音频产品'], uncovered:['观澜编码','前端大模型','网络产品','后端大模型','会议平板','执法记录仪','物联安全'], value:260, person:'朱绪浩' },
    { cust:'鹏城科技', covered:['会议平板','国密产品'], uncovered:['观澜编码','出入口停车','前端大模型','网络产品','后端大模型','人员通道','执法记录仪','物联安全','音频产品'], value:440, person:'陈刚' }
  ];

  var tbody = document.getElementById('p-cross-sell-body');
  if (tbody) {
    tbody.innerHTML = opps.map(function(o) {
      return '<tr>' +
        '<td style="font-weight:600">' + o.cust + '</td>' +
        '<td style="font-size:10px">' + o.covered.join('、') + '</td>' +
        '<td style="font-size:10px;color:#dc2626">' + o.uncovered.join('、') + '</td>' +
        '<td style="text-align:right;color:#1a56db;font-weight:700">¥' + o.value + '万</td>' +
        '<td>' + o.person + '</td></tr>';
    }).join('');
  }
};

// ===== 大客户依赖风险分析 =====
App.renderCustRisk = function(state) {
  state = state || App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var dim = App._scorecardDim || 'group';
  var scopeLabel = person !== 'all' ? '个人: '+person : group !== 'all' ? '小组: '+group : team !== 'all' ? '部门: '+team : '全部部门';
  App.setText('p-risk-scope', scopeLabel);

  // 根据 dim 聚合实体列表
  var entities = [];
  if (dim === 'dept') {
    App.DEPTS.forEach(function(d) { if (team === 'all' || d.n === team) entities.push({ name: d.n, sales: Math.round(d.cw * 42), count: d.cw }); });
  } else if (dim === 'group') {
    App.GROUPS.forEach(function(g) {
      if (team !== 'all' && g.dept !== team) return;
      if (group !== 'all' && g.n !== group) return;
      entities.push({ name: g.n, sales: (g.cw || 80) * 42, count: g.cw });
    });
  } else {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      entities.push({ name: p.n, sales: (p.cw || 15) * 38, count: p.cw || 10 });
    });
  }

  var totalSales = entities.reduce(function(s, e) { return s + e.sales; }, 0);
  var sorted = entities.slice().sort(function(a, b) { return b.sales - a.sales; });
  var top3 = sorted.slice(0, 3);
  var top3Total = top3.reduce(function(s, e) { return s + e.sales; }, 0);
  var top3Pct = totalSales > 0 ? (top3Total / totalSales * 100).toFixed(1) : 0;

  var metricsEl = document.getElementById('p-risk-metrics');
  if (metricsEl) {
    var label = dim === 'dept' ? '部门' : dim === 'group' ? '小组' : '个人';
    metricsEl.innerHTML =
      '<div>📌 ' + label + '总数: <b>' + entities.length + '</b></div>' +
      '<div>📌 总营收: <b>¥' + totalSales.toLocaleString() + '万</b></div>' +
      '<div>📌 TOP3 营收: <b>¥' + top3Total.toLocaleString() + '万</b></div>' +
      '<div style="margin-top:4px">' + (parseFloat(top3Pct) > 40
        ? '<span style="color:#dc2626;font-weight:700">⚠️ 高风险：TOP3占比' + top3Pct + '% > 40%阈值，业绩过度集中</span>'
        : '<span style="color:#059669">✅ 健康：TOP3占比' + top3Pct + '%，集中度可控</span>') + '</div>';
  }

  var barEl = document.getElementById('p-risk-bar');
  if (barEl) {
    barEl.innerHTML = '<div style="height:100%;width:' + top3Pct + '%;background:' + (parseFloat(top3Pct) > 40 ? '#ef4444' : '#f59e0b') + ';border-radius:6px"></div>';
  }

  var top3El = document.getElementById('p-risk-top3');
  if (top3El) {
    top3El.innerHTML = top3.map(function(e, i) {
      var share = totalSales > 0 ? (e.sales / totalSales * 100).toFixed(1) : 0;
      return '<div>#' + (i+1) + ' ' + e.name + ' · ¥' + e.sales.toLocaleString() + '万 · 占' + share + '%</div>';
    }).join('');
  }

  // 明细表
  var thead = document.getElementById('p-risk-thead');
  var tbody = document.getElementById('p-risk-body');
  var label = dim === 'dept' ? '部门' : dim === 'group' ? '小组' : '个人';
  if (thead) {
    thead.innerHTML = '<tr><th>' + label + '</th><th style="text-align:right">营收(万)</th><th style="text-align:center">占比</th><th style="text-align:right">客户数</th><th style="text-align:center">集中度</th></tr>';
  }
  if (tbody) {
    tbody.innerHTML = sorted.map(function(e, i) {
      var share = totalSales > 0 ? (e.sales / totalSales * 100).toFixed(1) : 0;
      var barPct = Math.min(100, parseFloat(share));
      var riskCls = i === 0 && parseFloat(share) > 30 ? 'color:#dc2626;font-weight:700' : (parseFloat(share) > 20 ? 'color:#f59e0b' : 'color:#059669');
      var riskIcon = i === 0 && parseFloat(share) > 30 ? '🔴' : (parseFloat(share) > 20 ? '🟡' : '🟢');
      return '<tr>' +
        '<td style="font-weight:600">' + e.name + '</td>' +
        '<td style="text-align:right">¥' + e.sales.toLocaleString() + '万</td>' +
        '<td style="text-align:center">' + share + '%</td>' +
        '<td style="text-align:center">' + (e.count || '-') + '</td>' +
        '<td style="text-align:center;' + riskCls + '">' + riskIcon + ' ' + (parseFloat(share) > 30 ? '高风险' : parseFloat(share) > 20 ? '关注' : '健康') + '</td></tr>';
    }).join('');
  }
};

// ===== 高贡献 & 薄弱客户 =====
App.renderCustTopBottom = function() {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var scopeLabel = person !== 'all' ? '个人: '+person : group !== 'all' ? '小组: '+group : team !== 'all' ? '部门: '+team : '全部客户';
  App.setText('p-top10-scope', scopeLabel);
  App.setText('p-bottom10-scope', scopeLabel);

  var all = (App._custLifeData || []).filter(function(c) {
    if (team !== 'all' && c.dept !== team) return false;
    if (group !== 'all' && c.team !== group) return false;
    if (person !== 'all' && c.person !== person) return false;
    return c.sales > 0;
  });

  var sorted = all.slice().sort(function(a, b) { return b.sales - a.sales; });
  var top10 = sorted.slice(0, 10);
  var bottom10 = sorted.slice(-10).reverse();

  function renderTable(tbodyId, list) {
    var tbody = document.getElementById(tbodyId);
    if (tbody) {
      tbody.innerHTML = list.map(function(c, i) {
        var yoyCls = c.yoy === '新增' ? 'b-new' : (c.yoy.indexOf('-') >= 0 ? 'b-down' : 'b-up');
        var covCnt = Math.min(Math.round((c.sales || 10) / 80), App.ALL_POT_PRODUCTS.length);
        return '<tr>' +
          '<td style="width:1%"><span class="rn ' + (i < 3 ? 'rn'+(i+1) : 'rn0') + '">' + (i+1) + '</span></td>' +
          '<td style="font-weight:600">' + c.cust + '</td>' +
          '<td style="text-align:right;font-weight:700">¥' + c.sales + '万</td>' +
          '<td style="text-align:center"><span class="badge ' + yoyCls + '">' + c.yoy + '</span></td>' +
          '<td style="text-align:center">' + covCnt + '/' + App.ALL_POT_PRODUCTS.length + '</td>' +
          '<td>' + c.person + '</td></tr>';
      }).join('');
    }
  }
  renderTable('p-cust-top10-body', top10);
  renderTable('p-cust-bottom10-body', bottom10);
};

// ===== 潜力产品 - 客户维度 Tab 动态渲染（跟随页级筛选） =====
App.renderPotentialCustTab = function() {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var dim = App._custDim || 'person';

  // 自动下钻
  if (team !== 'all' && group === 'all' && person === 'all') { dim = 'dept'; App._custDim = 'dept'; }
  else if (group !== 'all' && person === 'all') { dim = 'group'; App._custDim = 'group'; }
  else if (person !== 'all') { dim = 'person'; App._custDim = 'person'; }

  // 客户分层卡片渲染
  // 交叉矩阵
  // 生命周期
  // 大客户依赖风险
  try { App.renderCustTopBottom(); } catch(e) {}
  // 客户分层散点图 resize
  if (App.charts.custSegment) {
    setTimeout(function() { App.charts.custSegment.resize(); }, 100);
  }
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;
  var s = function(v) { return Math.round(v * sf); };

  // 客户 × 潜力产品交叉矩阵 — 从导入数据动态计算
  var raw = App.ImportPotential.CustRAW || [];
  var prods = App.ImportPotential.PRODUCTS || (App.WidthTeamMatrix.PRODUCTS && App.WidthTeamMatrix.PRODUCTS.length > 0 ? App.WidthTeamMatrix.PRODUCTS : []);
  if (prods.length === 0 && raw.length > 0) {
    var ps = {}; raw.forEach(function(r) { if (r.product) ps[r.product] = true; });
    prods = Object.keys(ps);
  }
  var custNames = [];
  var custMap = {};
  raw.forEach(function(r) {
    var cn = r.custName || r.userName || '';
    if (!cn) return;
    if (!custMap[cn]) { custMap[cn] = {}; custNames.push(cn); }
    custMap[cn][r.product] = (custMap[cn][r.product] || 0) + (r.amount || 0);
  });
  custNames = custNames.slice(0, 12);
  var top8Prods = prods.slice(0, 8);
  var tbody1 = document.getElementById('pCustMatrixBody');
  if (tbody1) {
    if (raw.length === 0) {
      tbody1.innerHTML = '<tr><td colspan="' + (top8Prods.length + 1) + '" style="text-align:center;padding:20px;color:#94a3b8">请先导入潜力产品数据</td></tr>';
    } else {
      // 更新 thead
      var thead = document.querySelector('#p-customer table:first-of-type thead');
      if (thead) {
        thead.innerHTML = '<tr><th>客户</th>' + top8Prods.map(function(p) { return '<th>' + (p.length > 6 ? p.substring(0,6) + '…' : p) + '</th>'; }).join('') + '</tr>';
      }
      tbody1.innerHTML = custNames.map(function(cn) {
        var cells = top8Prods.map(function(p) {
          var amt = custMap[cn][p] || 0;
          if (amt === 0) return '<td style="color:#d1d5db;text-align:center">-</td>';
          return '<td style="text-align:center;font-weight:600;color:#059669">' + (amt >= 10 ? amt.toFixed(0) : amt.toFixed(1)) + '</td>';
        }).join('');
        return '<tr><td><strong>' + cn.substring(0, 18) + '</strong></td>' + cells + '</tr>';
      }).join('');
    }
  }

  // 高贡献客户 TOP 10 — 从导入数据动态计算
  var custAmt = {};
  raw.forEach(function(r) {
    var cn = r.custName || r.userName || '';
    if (!cn) return;
    custAmt[cn] = (custAmt[cn] || 0) + (r.amount || 0);
  });
  var custTop = Object.entries(custAmt).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10).map(function(e) {
    return { cust: e[0], prods: Object.keys(custMap[e[0]] || {}).length, amt: e[1], yoy: '-', yoyCls: 'b-flat' };
  });
  var tbody2 = document.getElementById('pCustTop10Body');
  if (tbody2) {
    if (custTop.length === 0) {
      tbody2.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8">请先导入潜力产品数据</td></tr>';
    } else {
      tbody2.innerHTML = custTop.map(function(c, i) {
        var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
        return '<tr>' +
          '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
          '<td>' + c.cust.substring(0, 25) + '</td>' +
          '<td style="text-align:center">' + c.prods + '</td>' +
          '<td style="text-align:right;font-weight:600">' + c.amt.toFixed(0).toLocaleString() + '</td>' +
          '<td style="text-align:center"><span class="badge ' + c.yoyCls + '">' + c.yoy + '</span></td>' +
          '</tr>';
      }).join('');
    }
  }
};

// ===== 潜力产品 - 用户维度 Tab 动态渲染（跟随页级筛选） =====
App.renderPotentialUserTab = function() {
  try { App.renderUserDimension(); } catch(e) {}
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;
  var s = function(v) { return Math.round(v * sf); };

  // 最终用户潜力产品推广情况 — 从导入数据动态计算
  var rawUser = App.ImportPotential.UserRAW || [];
  var rawCust = App.ImportPotential.CustRAW || [];
  // 优先用 UserRAW，如果没有则从 CustRAW 提取 user 维度
  var userSource = rawUser.length > 0 ? rawUser : rawCust;
  var userAgg = {};
  userSource.forEach(function(r) {
    var un = r.userName || r.custName || '';
    if (!un) return;
    if (!userAgg[un]) userAgg[un] = { amt: 0, prods: {}, custs: {} };
    userAgg[un].amt += (parseFloat(r.outAmt || r.amount) || 0);
    if (r.product) userAgg[un].prods[r.product] = true;
    var cn = r.custName || '';
    if (cn) userAgg[un].custs[cn] = true;
  });
  var users = Object.entries(userAgg).sort(function(a, b) { return b[1].amt - a[1].amt; }).slice(0, 20).map(function(e) {
    var v = e[1];
    var prodList = Object.keys(v.prods);
    return { name: e[0], custCnt: Object.keys(v.custs).length, cov: prodList.length + '/' + (App.ImportPotential.PRODUCTS || []).length || '8', contrib: v.amt, yoy: '-', yoyCls: 'b-flat', prods: prodList.slice(0, 4).join(', ') };
  });

  var tbody1 = document.getElementById('pUserPromoBody');
  if (tbody1) {
    if (users.length === 0) {
      tbody1.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8">请先导入潜力产品数据</td></tr>';
    } else {
      tbody1.innerHTML = users.map(function(u) {
        return '<tr>' +
          '<td>' + u.name.substring(0, 25) + '</td>' +
          '<td style="text-align:center">' + u.custCnt + '</td>' +
          '<td style="text-align:center;font-weight:700;color:var(--primary)">' + u.cov + '</td>' +
          '<td style="text-align:center;font-weight:700">' + u.contrib.toFixed(0).toLocaleString() + '</td>' +
          '<td style="text-align:center"><span class="badge ' + u.yoyCls + '">' + u.yoy + '</span></td>' +
          '<td>' + u.prods + '</td></tr>';
      }).join('');
    }
  }

  // 用户关联客户潜力覆盖明细 — 从导入数据动态计算
  var userCustDetails = [];
  if (rawCust.length > 0) {
    var ucMap = {};
    rawCust.forEach(function(r) {
      var un = r.userName || '';
      var cn = r.custName || '';
      if (!un || !cn) return;
      if (!ucMap[un]) ucMap[un] = [];
      var existing = ucMap[un].find(function(x) { return x.cust === cn; });
      if (existing) { existing.amt += (r.amount || 0); existing.prods.push(r.product); }
      else { ucMap[un].push({ cust: cn, amt: r.amount || 0, prods: [r.product], person: r.sales || '' }); }
    });
    userCustDetails = Object.entries(ucMap).slice(0, 8).map(function(e) {
      return { user: e[0], custs: e[1].slice(0, 5).map(function(c) { return { cust: c.cust, cov: c.prods.length, amt: c.amt, person: c.person }; }) };
    });
  }

  var tbody2 = document.getElementById('pUserCustDetailBody');
  if (tbody2) {
    if (userCustDetails.length === 0) {
      tbody2.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8">请先导入潜力产品数据</td></tr>';
    } else {
      var html = '';
      userCustDetails.forEach(function(u) {
        u.custs.forEach(function(c, ci) {
          if (ci === 0) {
            html += '<tr><td rowspan="' + u.custs.length + '" style="vertical-align:middle;font-weight:600">' + u.user.substring(0, 20) + '</td>';
          } else {
            html += '<tr>';
          }
          html += '<td>' + c.cust.substring(0, 25) + '</td>' +
            '<td style="text-align:center;color:var(--success)">' + c.cov + '</td>' +
            '<td style="text-align:right;font-weight:600">' + c.amt.toFixed(0).toLocaleString() + '</td>' +
            '<td>' + c.person + '</td></tr>';
        });
      });
      tbody2.innerHTML = html;
    }
  }
};

// ===== 潜力产品 · 产品维度 — 覆盖率排名 =====
App.renderPotentialProductCoverage = function() {
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;

  // 11 潜力产品全量基准（客户）
  var custBase = [
    { name:'观澜编码产品（非大模型）', cov:36.7, covered:326, yoy:'+18.5%', yoyCls:'b-up' },
    { name:'出入口停车', cov:7.4,  covered:66,  yoy:'+15.2%', yoyCls:'b-up' },
    { name:'前端大模型', cov:7.9,  covered:70,  yoy:'+85%',   yoyCls:'b-up' },
    { name:'网络产品', cov:14.6,  covered:130, yoy:'-5.0%',  yoyCls:'b-warn' },
    { name:'后端大模型(文搜大模型）', cov:5.2, covered:46, yoy:'新增', yoyCls:'b-new' },
    { name:'人员通道', cov:6.4,  covered:57,  yoy:'+2.1%',  yoyCls:'b-flat' },
    { name:'会议平板与视频会议', cov:17.6, covered:156, yoy:'+22.4%', yoyCls:'b-up' },
    { name:'国密产品', cov:11.5,  covered:102, yoy:'+8.4%',  yoyCls:'b-up' },
    { name:'执法记录仪', cov:8.5,  covered:76,  yoy:'+18.7%', yoyCls:'b-up' },
    { name:'物联安全', cov:5.9,  covered:52,  yoy:'+5.2%',  yoyCls:'b-up' },
    { name:'音频产品', cov:9.4,  covered:84,  yoy:'-3.5%',  yoyCls:'b-down' }
  ];

  // 11 潜力产品全量基准（用户）
  var userBase = [
    { name:'观澜编码产品（非大模型）', cov:69.4, covered:268, yoy:'+22.1%', yoyCls:'b-up' },
    { name:'出入口停车', cov:18.7, covered:72,  yoy:'+15.2%', yoyCls:'b-up' },
    { name:'前端大模型', cov:14.2, covered:55,  yoy:'+85%',   yoyCls:'b-up' },
    { name:'网络产品', cov:28.5,  covered:110, yoy:'-2.1%',  yoyCls:'b-warn' },
    { name:'后端大模型(文搜大模型）', cov:8.5, covered:33, yoy:'新增', yoyCls:'b-new' },
    { name:'人员通道', cov:10.8, covered:42,  yoy:'+2.1%',  yoyCls:'b-flat' },
    { name:'会议平板与视频会议', cov:31.1, covered:120, yoy:'+15.6%', yoyCls:'b-up' },
    { name:'国密产品', cov:36.8, covered:142, yoy:'+11.2%', yoyCls:'b-up' },
    { name:'执法记录仪', cov:15.6, covered:60,  yoy:'+5.2%',  yoyCls:'b-up' },
    { name:'物联安全', cov:9.4,  covered:36,  yoy:'+6.8%',  yoyCls:'b-up' },
    { name:'音频产品', cov:15.6, covered:60,  yoy:'-1.2%',  yoyCls:'b-warn' }
  ];

  var scopeTotalCust = App._getScopeTotal(state, 'cust');
  var scopeTotalUser = App._getScopeTotal(state, 'user');

  // 客户覆盖率表
  var tbody1 = document.getElementById('pProdCovCustBody');
  if (tbody1) {
    tbody1.innerHTML = custBase.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      var ps = App._getProductScale(p.name, state);
      var coveredScaled = Math.round(p.covered * ps);
      var covCalc = scopeTotalCust > 0 ? Math.round(coveredScaled / scopeTotalCust * 100) : Math.round(p.cov * ps);
      covCalc = Math.min(100, Math.max(1, covCalc));
      return '<tr style="cursor:pointer;" onclick="App.showProdCovDrill(\'' + p.name + '\',\'cust\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + coveredScaled + '</td>' +
        '<td style="text-align:center;font-weight:700;color:var(--success)">' + covCalc + '%</td>' +
        '<td style="text-align:center"><span class="badge ' + p.yoyCls + '">' + p.yoy + '</span></td></tr>';
    }).join('');
  }

  // 用户覆盖率表
  var tbody2 = document.getElementById('pProdCovUserBody');
  if (tbody2) {
    tbody2.innerHTML = userBase.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      var ps = App._getProductScale(p.name, state);
      var coveredScaled = Math.round(p.covered * ps);
      var covCalc = scopeTotalUser > 0 ? Math.round(coveredScaled / scopeTotalUser * 100) : Math.round(p.cov * ps);
      covCalc = Math.min(100, Math.max(1, covCalc));
      return '<tr style="cursor:pointer;" onclick="App.showProdCovDrill(\'' + p.name + '\',\'user\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + coveredScaled + '</td>' +
        '<td style="text-align:center;font-weight:700;color:var(--success)">' + covCalc + '%</td>' +
        '<td style="text-align:center"><span class="badge ' + p.yoyCls + '">' + p.yoy + '</span></td></tr>';
    }).join('');
  }

  // 更新卡片标题中的范围客户/用户数
  App.setText('p-cust-scale-count', scopeTotalCust);
  App.setText('p-user-scale-count', scopeTotalUser);
};

// ===== 潜力产品 · 产品维度 — 预警概览卡片 =====
;


// 点击预警卡片 → 筛选下方表格

// ===== 集中刷新所有子Tab动态表格 =====
App.refreshAllSubTabs = function() {
  try { App.renderWidthProblemDiag(); } catch(e) {}
  try { App.renderWidthProductTab(); } catch(e) {}
  try { App.renderWidthUserTab(); } catch(e) {}
  try { App.renderPotentialTeamTab(); } catch(e) {}
  try { App.renderPotentialCustTab(); } catch(e) {}
  try { App.renderPotentialUserTab(); } catch(e) {}
  try { App.renderPotentialProductCoverage(); } catch(e) {}
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
  App.initCompare();
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

  // 初始化所有子Tab动态表格
  App.refreshAllSubTabs();

  // 强制二次刷新客户矩阵（确保首次加载数据正确）
  setTimeout(function() {
  }, 200);

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
