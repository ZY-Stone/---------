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

  // 账号下拉菜单：数据备份（仅管理员 + 运营可见）
  var umBackup = document.getElementById('um-backup');
  if (umBackup) umBackup.style.display = App.hasPerm('data_backup') ? '' : 'none';

  // 权限 UI 显隐：隐藏无权限的顶级导航按钮和 Admin 子标签
  if (!App.hasPerm('user_manage') && !App.hasPerm('role_manage') && !App.hasPerm('audit_log') && !App.hasPerm('data_backup')) {
    var adminNav = document.querySelector('.topbar-nav-btn[data-page="admin"]');
    if (adminNav) adminNav.style.display = 'none';
  }
  // 隐藏无权限的 Admin 子标签
  var adminTabs = {
    'a-users': 'user_manage', 'a-roles': 'role_manage', 'a-audit': 'audit_log'
  };
  Object.keys(adminTabs).forEach(function(tabId) {
    if (!App.hasPerm(adminTabs[tabId])) {
      var tab = document.querySelector('#page-admin .subtab[data-tab="' + tabId + '"]');
      if (tab) tab.style.display = 'none';
    }
  });
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
      if (App.AI && App.AI.restoreResult) App.AI.restoreResult();
    }
    if (tabName === 'w-product') {
      App.renderWidthProductTab();
      var cs = (App.Data.getWidth('all') || {}).crossSell;
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
    if (tabName === 'p-import') {
      App.ImportPotential.render();
    }
    if (tabName === 'p-ai') {
      if (App.PotAI && App.PotAI.init) App.PotAI.init();
      if (App.PotAI && App.PotAI.restoreResult) App.PotAI.restoreResult();
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
  // footer：显式传 null/'' 时不显示，否则保留默认关闭按钮
  var footerEl = document.querySelector('#appModalBox .modal-footer');
  if (footerEl) {
    if (footerHtml === null || footerHtml === '') {
      footerEl.innerHTML = '';
    } else {
      footerEl.innerHTML = (footerHtml || '') +
        '<button class="btn-ghost" onclick="App.closeModal()" style="padding:6px 16px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:12px">关闭</button>';
    }
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

// ===== 右上角 Toast 通知 =====
App.showToast = function(msg, duration) {
  var toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = 'position:fixed;top:16px;right:20px;z-index:10000;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.25);opacity:0;transform:translateY(-10px);transition:opacity .3s,transform .3s;max-width:420px;word-break:break-all';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  clearTimeout(toast._tid);
  toast._tid = setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
  }, duration || 4000);
};

// ===== 权限过滤：获取可见部门/组/人员（增强版：严格隔离） =====
App.getVisibleDepts = function() {
  var u = App.loggedInUser;
  if (!u) return [];
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return App.BUSINESS_DEPTS.map(function(d) { return d.n; });
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
  var depts = App.BUSINESS_DEPTS;
  if (!u) return depts;
  if (u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return depts;
  if (u.role === 'director') return depts.filter(function(d) { return d.n === u.dept; });
  return depts.filter(function(d) { return d.n === u.dept; });
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
  // 潜力产品页：筛选变更后自动联动颗粒度按钮
  if (pageId === 'page-potential') { App.updatePotDimButtons(); App.updateTeamDimButtons(); }
  // 产品宽度页：筛选变更后自动联动颗粒度按钮
  if (pageId === 'page-width') App.updateWidthDimButtons();
  App.refreshPageData(pageId);
};
App.onGrpChange = function(pageId) {
  // ── 反向选择：选中小组 → 自动回填所属部门 ──
  var grpSel = document.querySelector('#' + pageId + ' .filter-group-sel');
  var grpVal = grpSel ? grpSel.value : 'all';
  if (grpVal !== 'all') {
    var grpInfo = App.GROUPS.find(function(g) { return g.n === grpVal; });
    if (grpInfo && grpInfo.dept) {
      var deptSel = document.querySelector('#' + pageId + ' .filter-dept');
      if (deptSel) deptSel.value = grpInfo.dept;
    }
  }

  // 强制重置下层筛选（人员）
  var personSel = document.querySelector('#' + pageId + ' .filter-person');
  if (personSel) personSel.value = 'all';

  // 级联刷新下拉（部门下拉此时可能已变化，需要重新填充小组和人员）
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);

  // 确保小组值在重新填充后仍保持（populateGrpDropdown 内部会保留有效值）
  if (grpSel) grpSel.value = grpVal;

  // 颗粒度按钮联动
  if (pageId === 'page-potential') { App.updatePotDimButtons(); App.updateTeamDimButtons(); }
  if (pageId === 'page-width') App.updateWidthDimButtons();
  App.refreshPageData(pageId);
};
App.onPersonChange = function(pageId) {
  // ── 反向选择：选中个人 → 自动回填所属小组 + 所属部门 ──
  var personSel = document.querySelector('#' + pageId + ' .filter-person');
  var personVal = personSel ? personSel.value : 'all';
  if (personVal !== 'all') {
    var pInfo = App.PERSONS.find(function(p) { return p.n === personVal; });
    if (pInfo) {
      // 回填小组
      if (pInfo.grp && pInfo.grp !== '-') {
        var grpSel = document.querySelector('#' + pageId + ' .filter-group-sel');
        if (grpSel) grpSel.value = pInfo.grp;
      }
      // 回填部门
      if (pInfo.dept) {
        var deptSel = document.querySelector('#' + pageId + ' .filter-dept');
        if (deptSel) deptSel.value = pInfo.dept;
      }
    }
  }

  // 级联刷新下拉（部门/小组可能已变化，需要重新填充）
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);

  // 确保人员和小组值在重新填充后仍保持
  if (personSel) personSel.value = personVal;
  if (personVal !== 'all') {
    var pInfo2 = App.PERSONS.find(function(p) { return p.n === personVal; });
    if (pInfo2 && pInfo2.grp && pInfo2.grp !== '-') {
      var grpSel2 = document.querySelector('#' + pageId + ' .filter-group-sel');
      if (grpSel2) grpSel2.value = pInfo2.grp;
    }
  }

  // 颗粒度按钮联动
  if (pageId === 'page-potential') { App.updatePotDimButtons(); App.updateTeamDimButtons(); }
  if (pageId === 'page-width') App.updateWidthDimButtons();
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
  // 潜力产品页：重置颗粒度为默认「部门」
  if (pageId === 'page-potential') {
    App._potDim = 'dept';
    App._potSalesPage = 1;
    App._scorecardDim = 'dept';
    App._sellerDim = 'person';
    App.WidthTeamMatrix._dim = 'group';
    App.updatePotDimButtons();
    App.updateTeamDimButtons();
  }
  // 产品宽度页：重置颗粒度为默认「部门」
  if (pageId === 'page-width') {
    App.WidthDetail.dim = 'dept';
    App.WidthDetail.page = 1;
    App.updateWidthDimButtons();
  }
  App.refreshPageData(pageId);
  App.addLog('筛选查询', '重置筛选', '重置了筛选条件');
};

// ===== 数据总览 - 筛选联动（支持部门→组→个人级联 + 时间过滤） =====
App.updateOverview = function() {
  // 筛选变化时重置手动维度选择，恢复自动跟随
  App._ovWidthTrendManual = false;
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

  var team = state.team, group = state.group, person = state.person;

  // ---- \u4ece\u5bfc\u5165\u6570\u636e\u76f4\u63a5\u8ba1\u7b97\u7b5b\u9009\u540e\u7684\u771f\u5b9e KPI\uff08\u4e0d\u518d\u7528\u7f29\u653e\u56e0\u5b50\u8fd1\u4f3c\uff09 ----
  var ovUser = (App.ImportData.UserGS || []).slice();
  var ovCust = (App.ImportData.CustGS || []).slice();
  // \u6708\u4efd\u7b5b\u9009\uff08\u4ece\u8868\u5185\u4e0b\u62c9\u540c\u6b65\uff09
  var ovPeriodSel = document.getElementById('wImportPeriodFilter');
  var ovPeriod = ovPeriodSel ? (ovPeriodSel.value !== 'all' ? ovPeriodSel.value : '') : '';
  if (ovPeriod) {
    ovUser = ovUser.filter(function(r) { return (r.snapshotPeriod || '') === ovPeriod; });
    ovCust = ovCust.filter(function(r) { return (r.snapshotPeriod || '') === ovPeriod; });
  }
  // \u2500\u2500 Layer 1: \u89d2\u8272\u6570\u636e\u8303\u56f4\uff08\u5f3a\u5236\u8fc7\u6ee4\uff09\u2500\u2500
  var ovRoleFilter = function(arr) {
    var uu = App.loggedInUser || {}, rr = uu.role || 'admin';
    if (rr === 'director' || rr === 'interface') return arr.filter(function(x) { return x.dept === uu.dept; });
    if (rr === 'manager') return arr.filter(function(x) { return x.group === uu.group && x.dept === uu.dept; });
    if (rr === 'sales') return arr.filter(function(x) { return x.sales === uu.username; });
    return arr;
  };
  ovUser = ovRoleFilter(ovUser);
  ovCust = ovRoleFilter(ovCust);

  // \u7ea7\u8054\u7b5b\u9009
  if (person !== 'all') {
    ovUser = ovUser.filter(function(r) { return r.sales === person; });
    ovCust = ovCust.filter(function(r) { return r.sales === person; });
  } else if (group !== 'all') {
    ovUser = ovUser.filter(function(r) { return r.group === group; });
    ovCust = ovCust.filter(function(r) { return r.group === group; });
  } else if (team !== 'all') {
    ovUser = ovUser.filter(function(r) { return r.dept === team; });
    ovCust = ovCust.filter(function(r) { return r.dept === team; });
  }
  var ovAll = ovCust.concat(ovUser);
  var isGs = function(r) { var g = (r.guishang || '').toString().trim(); return g === '\u662f' || g === '1'; };

  // \u4ea7\u54c1\u5bbd\u5ea6\uff08\u5168\u90e8\uff09
  var totalW = ovAll.reduce(function(s, r) { return s + (r.width || 0); }, 0);
  var widthVal = ovAll.length > 0 ? totalW / ovAll.length : 0;
  // \u7528\u6237\u4ea7\u54c1\u5bbd\u5ea6
  var totalUW = ovUser.reduce(function(s, r) { return s + (r.width || 0); }, 0);
  var userWidthVal = ovUser.length > 0 ? totalUW / ovUser.length : 0;
  // \u5ba2\u6237\u4ea7\u54c1\u5bbd\u5ea6
  var totalCW = ovCust.reduce(function(s, r) { return s + (r.width || 0); }, 0);
  var custWidthVal = ovCust.length > 0 ? totalCW / ovCust.length : 0;
  // \u89c4\u4e0a\u7528\u6237\u6570 / \u89c4\u4e0a\u5ba2\u6237\u6570\uff08\u4ea7\u54c1\u5bbd\u5ea6\u53e3\u5f84\uff09
  var scaleUsers = ovUser.filter(isGs).length;
  var scaleCust = ovCust.filter(isGs).length;

  // \u6f5c\u529b\u4ea7\u54c1\u6570\u636e\uff08\u4e09\u5c42\u8fc7\u6ee4\uff1a\u89d2\u8272\u8303\u56f4 \u2192 \u6708\u4efd \u2192 \u7ea7\u8054\u7b5b\u9009\uff0c\u4e0e\u6f5c\u529b\u4ea7\u54c1\u9875\u4e00\u81f4\uff09
  var fPotCustAll = (App.ImportPotential.CustRAW || []).slice();
  var fPotUserAll = (App.ImportPotential.UserRAW || []).slice();

  // \u2500\u2500 Layer 1: \u89d2\u8272\u6570\u636e\u8303\u56f4 \u2500\u2500
  var potRoleFilter = function(arr) {
    var uu = App.loggedInUser || {}, rr = uu.role || 'admin';
    if (rr === 'director' || rr === 'interface') return arr.filter(function(x) { return x.dept3 === uu.dept || x.dept4 === uu.dept; });
    if (rr === 'manager') return arr.filter(function(x) { return (x.dept5 === uu.group || x.dept4 === uu.group) && (x.dept3 === uu.dept || x.dept4 === uu.dept); });
    if (rr === 'sales') return arr.filter(function(x) { return x.sales === uu.username; });
    return arr;
  };
  fPotCustAll = potRoleFilter(fPotCustAll);
  fPotUserAll = potRoleFilter(fPotUserAll);

  // \u2500\u2500 Layer 2: \u6708\u4efd\u7b5b\u9009\uff08\u4e0e\u4ea7\u54c1\u5bbd\u5ea6\u5171\u7528\u540c\u4e00\u4e2a\u6708\u4efd\u9009\u62e9\u5668\uff09\u2500\u2500
  var potPeriod = ovPeriodSel ? (ovPeriodSel.value !== 'all' && ovPeriodSel.value !== '\u65e0\u6570\u636e' ? ovPeriodSel.value : '') : '';
  if (potPeriod) {
    fPotCustAll = fPotCustAll.filter(function(r) { return (r.snapshotPeriod || '') === potPeriod; });
    fPotUserAll = fPotUserAll.filter(function(r) { return (r.snapshotPeriod || '') === potPeriod; });
  }

  // \u2500\u2500 Layer 3: \u7ea7\u8054\u7b5b\u9009 \u2500\u2500
  if (person !== 'all') {
    fPotCustAll = fPotCustAll.filter(function(r) { return r.sales === person; });
    fPotUserAll = fPotUserAll.filter(function(r) { return r.sales === person; });
  } else if (group !== 'all') {
    fPotCustAll = fPotCustAll.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
    fPotUserAll = fPotUserAll.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
  } else if (team !== 'all') {
    fPotCustAll = fPotCustAll.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
    fPotUserAll = fPotUserAll.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
  }

  var fPotCust = fPotCustAll;
  var fPotUser = fPotUserAll;
  var potAmtVal = 0;
  var potCustSet = {}, potUserSet = {};
  fPotCust.forEach(function(r) { potAmtVal += (r.amount || 0); if (r.custName) potCustSet[r.custName] = true; });
  fPotUser.forEach(function(r) { if (r.userName) potUserSet[r.userName] = true; });
  var custVal = Object.keys(potCustSet).length;
  var usersVal = Object.keys(potUserSet).length;

  // 基线时间标识（从角色过滤后的数据获取最新月份，但不限月份）
  var ovBaseline = document.getElementById('ov-baseline-tag');
  if (ovBaseline) {
    var ovBaseRaw = potRoleFilter((App.ImportPotential.CustRAW || []).slice()).concat(potRoleFilter((App.ImportPotential.UserRAW || []).slice()));
    var ovPeriods = {};
    ovBaseRaw.forEach(function(r) {
      var sp = r.snapshotPeriod || '';
      if (sp) ovPeriods[sp] = true;
    });
    var ovSorted = Object.keys(ovPeriods).sort();
    var ovLatest = ovSorted.length > 0 ? ovSorted[ovSorted.length - 1] : '';
    if (ovLatest) {
      var ovParts = ovLatest.split('-');
      ovBaseline.textContent = '📅 基线：' + (ovParts.length === 2 ? (ovParts[0] + '年' + parseInt(ovParts[1]) + '月') : ovLatest);
    }
  }

  App.setText('ov-kpi-width',             widthVal.toFixed(2));
  App.setText('ov-kpi-user-width',        userWidthVal.toFixed(2));
  App.setText('ov-kpi-cust-width',        custWidthVal.toFixed(2));
  App.setText('ov-kpi-potential-amt-v',   '\u00a5 ' + potAmtVal.toFixed(2) + '\u4e07');
  App.setText('ov-kpi-users',             usersVal);
  App.setText('ov-kpi-customers',         custVal.toLocaleString());
  App.setText('ov-kpi-cust-mom',          '-');
  App.setText('ov-kpi-scale-users',       scaleUsers);
  App.setText('ov-kpi-scale-customers',   scaleCust);

  App._refreshOvBarCharts();


  // 更新产品宽度趋势图（跟随筛选联动）
  App._updateOvWidthTrend();

  // 更新潜力产品历史趋势图 — 从真实导入数据聚合
  var ptChart = App.charts['ov_potential-trend'];
  if (ptChart) {
    try {
      // 使用 getFilteredPotData 严格遵循筛选边界
      // 用数据总览自己的筛选器
      var fPotAll = (App.ImportPotential.CustRAW || []).slice();
      if (person !== 'all') fPotAll = fPotAll.filter(function(r) { return r.sales === person; });
      else if (group !== 'all') fPotAll = fPotAll.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
      else if (team !== 'all') fPotAll = fPotAll.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
      var prodAggOv = {};
      fPotAll.forEach(function(r) {
        if (!r.product) return;
        if (!prodAggOv[r.product]) prodAggOv[r.product] = { name: r.product, curr: 0, prev: 0 };
        prodAggOv[r.product].curr += (r.amount || 0);
        prodAggOv[r.product].prev += (r.amountPrev || 0);
      });
      var prodNames = Object.keys(prodAggOv).sort(function(a, b) { return prodAggOv[b].curr - prodAggOv[a].curr; });
      // 无导入数据时回退默认产品列表
      if (prodNames.length === 0) prodNames = App.ALL_POT_PRODUCTS.slice(0, 11);
      var prodCurr = prodNames.map(function(p) { return Math.round((prodAggOv[p] || {}).curr || 0); });
      var prodPrev = prodNames.map(function(p) { return Math.round((prodAggOv[p] || {}).prev || 0); });

      while (ptChart.data.datasets.length < 2) {
        ptChart.data.datasets.push({ label: '', data: [] });
      }
      ptChart.data.labels = prodNames;
      ptChart.data.datasets[0].label = '本期销售额';
      ptChart.data.datasets[0].data = prodCurr;
      ptChart.data.datasets[0].backgroundColor = '#3b82f6';
      ptChart.data.datasets[1].label = '同期销售额';
      ptChart.data.datasets[1].data = prodPrev;
      ptChart.data.datasets[1].backgroundColor = '#cbd5e1';
      while (ptChart.data.datasets.length > 2) { ptChart.data.datasets.pop(); }
      ptChart.update('none');
    } catch(e) {
      console.warn('更新潜力产品趋势图失败:', e);
    }
  }
};

// 级联缩放计算：根据 部门/组/个人 选择返回缩放因子和图表数据
// 横坐标标签和数据从 App.BUSINESS_DEPTS/GROUPS/PERSONS 动态获取
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
  s.chartLabels = App.BUSINESS_DEPTS.map(function(d){ return d.n; });
  s.chartWidthData = App.BUSINESS_DEPTS.map(function(d){ return d.aw; });
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
// 核心规则：颗粒度切换不能突破顶部筛选划定的数据边界
App._potDim = 'dept';
App._potSalesPage = 1;
App._potSalesPageSize = 10;

// 获取当前筛选条件下可用的颗粒度选项
// - 筛选「部门」：部门/组/个人 三级都可用
// - 筛选「小组」：仅 组/个人 可用（部门粒度已锁定到小组）
// - 筛选「个人」：仅 个人 可用
App.getAvailablePotDims = function() {
  var state = App.getFilterState('page-potential');
  if (state.person !== 'all') return ['person'];
  if (state.group !== 'all') return ['group', 'person'];
  return ['dept', 'group', 'person'];
};

// 更新颗粒度按钮的可见性和激活状态
// 筛选变更后自动调用，确保按钮不超出筛选范围
App.updatePotDimButtons = function() {
  var available = App.getAvailablePotDims();
  var current = App._potDim || 'dept';
  // 筛选变更后重置到第一页
  App._potSalesPage = 1;

  // 如果当前粒度在筛选缩窄后不可用，自动降级到最细可用粒度
  if (available.indexOf(current) === -1) {
    App._potDim = available[available.length - 1];
    App._potSalesPage = 1;  // 粒度变化时重置页码
  }

  // 更新按钮显示/隐藏 + 激活状态
  var allDims = ['dept', 'group', 'person'];
  allDims.forEach(function(dim) {
    var btn = document.querySelector('#page-potential [data-p-dim="' + dim + '"]');
    if (!btn) return;
    if (available.indexOf(dim) === -1) {
      btn.style.display = 'none';
      btn.classList.remove('active');
    } else {
      btn.style.display = '';
      btn.classList.toggle('active', dim === App._potDim);
    }
  });
};

App.switchPotDim = function(type) {
  var available = App.getAvailablePotDims();
  // 请求的粒度不在可用范围内，静默忽略
  if (available.indexOf(type) === -1) return;

  App._potDim = type;
  App._potSalesPage = 1;  // 切换粒度时重置页码
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

  // ── 核心规则：所有展示数据必须是顶部筛选范围的子集 ──
  // 优先使用 WidthTeamMatrix.RAW，无数据时回退到 getPotential
  var raw = (App.WidthTeamMatrix.RAW && App.WidthTeamMatrix.RAW.length > 0) ? App.WidthTeamMatrix.RAW : null;
  var aggMap = {};

  if (raw) {
    raw.forEach(function(r) {
      // 部门筛选：只保留选定部门的数据
      if (state.team !== 'all') {
        var gDept = (App.GROUPS.find(function(g){return g.n===r.team;})||{}).dept;
        if (gDept !== state.team) return;
      }
      // 小组筛选：只保留选定小组的数据
      if (state.group !== 'all' && r.team !== state.group) return;
      // 个人筛选：只保留该人员所属小组的数据（基础过滤）
      if (state.person !== 'all') {
        var pInfo = App.PERSONS.find(function(p){return p.n===state.person;});
        if (pInfo && r.team !== pInfo.grp) return;
      }

      // 按维度聚合
      var key;
      if (dim === 'dept') {
        key = (App.GROUPS.find(function(g){return g.n===r.team;})||{}).dept || r.team;
      } else if (dim === 'group') {
        key = r.team;
      } else {
        // 个人维度：从 WidthCustomer 数据中找到该 team 下的销售人员
        key = r.team;  // 回退到组级别（潜力数据无人员字段）
      }
      if (!key) return;
      if (!aggMap[key]) aggMap[key] = { name: key, sales: 0, prev: 0 };
      aggMap[key].sales += r.amount || 0;
      aggMap[key].prev += r.amountPrev || 0;
    });
  }

  // 无矩阵数据时从 getPotential 取
  if (Object.keys(aggMap).length === 0) {
    var potData = App.Data.getPotential(state.team !== 'all' ? state.team : 'all');
    var srcList = [];
    if (dim === 'dept' && potData && potData.deptRank) {
      srcList = potData.deptRank.map(function(d) { return { name: d.dept, sales: d.sales, prev: 0 }; });
    } else if (dim === 'group' && potData && potData.top10) {
      // top10 是产品维度，不是组维度 — 回退到空
    }
    srcList.forEach(function(r) {
      if (!aggMap[r.name]) aggMap[r.name] = { name: r.name, sales: 0, prev: 0 };
      aggMap[r.name].sales += r.sales;
    });
  }

  // ── 构建排序列表（严格遵循边界约束）──
  var rows = [];
  if (dim === 'dept') {
    // 部门粒度：如果顶部筛选了某个部门，仅展示该部门汇总（1条）
    if (state.team !== 'all') {
      if (aggMap[state.team]) rows.push(aggMap[state.team]);
      // 确保不展示其他部门数据
    } else {
      // 全部部门：按业务部门顺序展示
      App.BUSINESS_DEPTS.forEach(function(d) { if (aggMap[d.n]) rows.push(aggMap[d.n]); });
      var EXCLUDE_DEPTS = ['深圳','深圳业务中心','产品营销部'];
      Object.keys(aggMap).forEach(function(k) {
        if (!rows.find(function(r){return r.name===k;}) && EXCLUDE_DEPTS.indexOf(k) < 0) rows.push(aggMap[k]);
      });
    }
  } else if (dim === 'group') {
    // 小组粒度：
    // - 筛选「部门」：仅展示该部门下属小组数据
    // - 筛选「小组」：仅展示该小组汇总（1条）
    // - 筛选「全部」：展示全部小组
    if (state.group !== 'all') {
      // 已锁定到具体小组，仅展示该小组
      if (aggMap[state.group]) rows.push(aggMap[state.group]);
    } else if (state.team !== 'all') {
      // 筛选了某个部门：仅展示该部门下属小组
      var deptGroups = App.GROUPS.filter(function(g) { return g.dept === state.team; });
      deptGroups.forEach(function(g) {
        rows.push(aggMap[g.n] || { name: g.n, sales: 0, prev: 0 });
      });
      // 也包含 aggMap 中属于该部门但不在 GROUPS 列表的
      Object.keys(aggMap).forEach(function(k) {
        if (!rows.find(function(r){return r.name===k;})) {
          var gd = (App.GROUPS.find(function(g){return g.n===k;})||{}).dept;
          if (gd === state.team) rows.push(aggMap[k]);
        }
      });
    } else {
      // 全部：按 GROUPS 顺序展示
      App.GROUPS.forEach(function(g) { rows.push(aggMap[g.n] || { name: g.n, sales: 0, prev: 0 }); });
      var EXCLUDE_NAMES = ['深圳','深圳业务中心','产品营销部'];
      Object.keys(aggMap).forEach(function(k) {
        if (!rows.find(function(r){return r.name===k;}) && EXCLUDE_NAMES.indexOf(k) < 0) rows.push(aggMap[k]);
      });
    }
  } else {
    // 个人维度：从潜力产品客户 RAW 按销售人员聚合
    // - 筛选「个人」：仅展示该个人（1条）
    // - 筛选「小组」：仅展示该小组内成员
    // - 筛选「部门」：仅展示该部门下属个人
    var custRaw = (App.ImportPotential.CustRAW || []).slice();
    var periodSelP = document.getElementById('pImportPeriodFilter');
    var periodFilterP = periodSelP ? (periodSelP.value && periodSelP.value !== 'all' ? periodSelP.value : '') : '';
    if (periodFilterP) custRaw = custRaw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilterP; });

    // 严格按筛选范围过滤
    if (state.person !== 'all') {
      // 已锁定到具体个人：仅展示该个人
      custRaw = custRaw.filter(function(r) { return (r.sales || '') === state.person; });
    } else if (state.group !== 'all') {
      // 筛选了小组：仅展示该小组内成员
      custRaw = custRaw.filter(function(r) { return r.dept5 === state.group || r.dept4 === state.group; });
    } else if (state.team !== 'all') {
      // 筛选了部门：仅展示该部门下属个人
      custRaw = custRaw.filter(function(r) { return r.dept3 === state.team || r.dept4 === state.team; });
    }

    var personAgg = {};
    custRaw.forEach(function(r) {
      var acc = r.sales || '(未填写)';
      if (!personAgg[acc]) personAgg[acc] = { name: acc, sales: 0, count: 0 };
      personAgg[acc].sales += r.amount || 0;
      personAgg[acc].count++;
    });
    rows = Object.values(personAgg).map(function(p) {
      return { name: p.name, sales: p.sales, prev: 0, count: p.count };
    });
  }

  if (rows.length === 0) {
    rankEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px">暂无数据</td></tr>';
    // 清空分页
    var pagerEl = document.getElementById('pOvDeptPager');
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }

  // 按销售额降序
  rows.sort(function(a, b) { return b.sales - a.sales; });

  // ── 分页逻辑 ──
  var pageSize = App._potSalesPageSize || 10;
  var totalPages = Math.ceil(rows.length / pageSize);
  if (App._potSalesPage < 1) App._potSalesPage = 1;
  if (App._potSalesPage > totalPages) App._potSalesPage = totalPages;
  var start = (App._potSalesPage - 1) * pageSize;
  var pageRows = rows.slice(start, start + pageSize);

  var maxS = Math.max.apply(null, rows.map(function(r){return r.sales;}).concat([1]));
  var html = '';
  pageRows.forEach(function(r, i) {
    var globalIdx = start + i;
    var rn = globalIdx < 3 ? 'rn' + (globalIdx + 1) : 'rn0';
    var yoy = r.prev > 0 ? ((r.sales - r.prev) / r.prev * 100) : 0;
    var yoyC = yoy >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    html += '<tr>' +
      '<td style="text-align:center"><span class="' + rn + '">' + (globalIdx + 1) + '</span></td>' +
      '<td><strong>' + App.escapeHtml(r.name) + '</strong></td>' +
      '<td style="text-align:right;font-weight:700;font-size:13px">¥' + r.sales.toLocaleString() + '<span style="font-size:10px;color:#94a3b8;font-weight:400">万</span></td>' +
      '<td style="text-align:center;' + yoyC + ';font-weight:600">' + (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%</td>' +
      '</tr>';
  });
  rankEl.innerHTML = html;

  // ── 渲染分页控件 ──
  var pagerEl = document.getElementById('pOvDeptPager');
  if (pagerEl) {
    if (totalPages <= 1) {
      pagerEl.innerHTML = '<span style="font-size:11px;color:#94a3b8">共 ' + rows.length + ' 条</span>';
    } else {
      var ph = '<span style="font-size:11px;color:#64748b;margin-right:8px">共 ' + rows.length + ' 条，' + totalPages + ' 页</span>';
      ph += '<button onclick="App.goPotSalesPage(' + Math.max(1, App._potSalesPage - 1) + ')" ' +
        'style="padding:3px 8px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;margin:0 2px"' +
        (App._potSalesPage <= 1 ? ' disabled' : '') + '>◀</button>';

      // 页码按钮（最多显示7个）
      var maxBtns = 7;
      var startPg = Math.max(1, App._potSalesPage - Math.floor(maxBtns / 2));
      var endPg = Math.min(totalPages, startPg + maxBtns - 1);
      if (endPg - startPg < maxBtns - 1) startPg = Math.max(1, endPg - maxBtns + 1);

      for (var pg = startPg; pg <= endPg; pg++) {
        var isActive = pg === App._potSalesPage;
        ph += '<button onclick="App.goPotSalesPage(' + pg + ')" ' +
          'style="padding:3px 8px;border:1px solid ' + (isActive ? '#1a56db' : '#d1d5db') + ';border-radius:4px;' +
          'background:' + (isActive ? '#1a56db' : '#fff') + ';color:' + (isActive ? '#fff' : '#374151') + ';' +
          'cursor:pointer;font-size:11px;margin:0 1px;font-weight:' + (isActive ? '600' : '400') + '">' + pg + '</button>';
      }

      ph += '<button onclick="App.goPotSalesPage(' + Math.min(totalPages, App._potSalesPage + 1) + ')" ' +
        'style="padding:3px 8px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;margin:0 2px"' +
        (App._potSalesPage >= totalPages ? ' disabled' : '') + '>▶</button>';
      pagerEl.innerHTML = ph;
    }
  }
};

// 潜力产品销售额分页跳转
App.goPotSalesPage = function(pg) {
  App._potSalesPage = pg;
  App.renderPotSalesRank();
};

// ===== 总览页产品宽度历史趋势 — 跟随筛选联动（总体数据变化） =====
// 人均产品宽度历史趋势 — 维度切换（宽度页）
App._widthTrendDim = 'dept';
App.switchWidthTrendDim = function(dim) {
  App._widthTrendDim = dim;
  document.querySelectorAll('#page-width [data-wt-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-wt-dim') === dim);
  });
  App._updateOvWidthTrend();
};

// 总览页维度切换（手动点击按钮时设置）
App._ovWidthTrendDim = 'dept';
App._ovWidthTrendManual = false;  // 用户是否手动选择了维度
App.switchOvWidthTrendDim = function(dim) {
  App._ovWidthTrendDim = dim;
  App._ovWidthTrendManual = true;
  document.querySelectorAll('#page-overview [data-ov-wt-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-ov-wt-dim') === dim);
  });
  App._updateOvWidthTrend();
};

App._updateOvWidthTrend = function() {
  // 同时更新产品宽度页和数据总览页两个图表
  var charts = [];
  if (App.charts.wWidthTrend) charts.push({ chart: App.charts.wWidthTrend, pageId: 'page-width' });
  if (App.charts['ov_width-trend']) charts.push({ chart: App.charts['ov_width-trend'], pageId: 'page-overview' });
  if (charts.length === 0) return;

  // 使用第一个图表的筛选状态（两个图表通常同步，优先用可见页面的状态）
  var ovChart = App.charts['ov_width-trend'];
  var pageId = (ovChart && document.getElementById('page-overview') && document.getElementById('page-overview').classList.contains('active')) ? 'page-overview' : 'page-width';
  var state = App.getFilterState(pageId);
  var team = state.team, group = state.group, person = state.person;
  // 根据当前可见页面选择对应的维度状态
  var isOvPage = document.getElementById('page-overview') && document.getElementById('page-overview').classList.contains('active');
  var dim;
  if (isOvPage) {
    // 总览页：自动跟随筛选级联（除非用户手动点击了维度按钮）
    if (!App._ovWidthTrendManual) {
      if (person !== 'all') App._ovWidthTrendDim = 'person';
      else if (group !== 'all') App._ovWidthTrendDim = 'group';
      else App._ovWidthTrendDim = 'dept';
    }
    dim = App._ovWidthTrendDim || 'dept';
    // 同步按钮 active 状态
    document.querySelectorAll('#page-overview [data-ov-wt-dim]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-ov-wt-dim') === dim);
    });
  } else {
    dim = App._widthTrendDim || 'dept';
  }

  // 横坐标：始终取全量数据的月份（不受筛选限制），确保 X 轴完整
  var allRaw = (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []);
  var allMonths = {}; allRaw.forEach(function(r) { if (r.snapshotPeriod) allMonths[r.snapshotPeriod] = true; });
  var labels = Object.keys(allMonths).sort();
  if (labels.length === 0) { labels = ['暂无数据']; }

  // 筛选后的数据
  var all = allRaw.slice();
  if (person !== 'all') all = all.filter(function(r) { return r.sales === person; });
  else if (group !== 'all') all = all.filter(function(r) { return r.group === group; });
  else if (team !== 'all') all = all.filter(function(r) { return r.dept === team; });
  all = all.filter(function(r) { return r.snapshotPeriod; });

  var COLORS = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

  // 构建 datasets（对所有图表共用）
  function buildDatasets(dim, labels, all, team, group, person) {
    // 统一按实体聚合：每个实体一条趋势线
    var entityKey;
    if (dim === 'dept') entityKey = 'dept';
    else if (dim === 'group') entityKey = 'group';
    else entityKey = 'sales';

    var entities = {};
    // 预填组织架构中所有实体
    if (dim === 'dept') {
      // 仅显示业务部门（排除运营部等非销售部门）
      var VALID_DEPTS = ['客户销售一部','客户销售二部','大客户销售部','场景数字化销售部','行业一部','行业二部'];
      VALID_DEPTS.forEach(function(dn) {
        if (team !== 'all' && dn !== team) return;
        if (!entities[dn]) entities[dn] = [];
      });
    } else if (dim === 'group') {
      App.GROUPS.forEach(function(g) {
        if (team !== 'all' && g.dept !== team) return;
        if (group !== 'all' && g.n !== group) return;
        if (!entities[g.n]) entities[g.n] = [];
      });
      App.BUSINESS_DEPTS.forEach(function(d) {
        if (team !== 'all' && d.n !== team) return;
        if (!App.GROUPS.some(function(g) { return g.dept === d.n; }) && !entities[d.n]) entities[d.n] = [];
      });
    } else {
      App.PERSONS.forEach(function(p) {
        if (team !== 'all' && p.dept !== team) return;
        if (group !== 'all' && p.grp !== group) return;
        if (person !== 'all' && p.n !== person) return;
        if (!entities[p.n]) entities[p.n] = [];
      });
    }
    // 填入实际数据（部门维度仅接受预定义的6个业务部门）
    all.forEach(function(r) {
      var k = r[entityKey] || r.dept || '其他';
      if (dim === 'dept' && !entities.hasOwnProperty(k)) return;  // 跳过非业务部门
      if (!entities[k]) entities[k] = [];
      entities[k].push(r);
    });
    var entityNames = Object.keys(entities).sort();
    return entityNames.map(function(en, ei) {
      var ed = {};
      entities[en].forEach(function(r) {
        var sp = r.snapshotPeriod;
        if (!ed[sp]) ed[sp] = { total: 0, count: 0 };
        ed[sp].total += (r.width || 0);
        ed[sp].count++;
      });
      var data = labels.map(function(m) {
        var e = ed[m];
        return e && e.count > 0 ? parseFloat((e.total / e.count).toFixed(2)) : null;
      });
      return {
        label: en,
        data: data,
        borderColor: COLORS[ei % COLORS.length],
        tension: .3, fill: false, pointRadius: 3
      };
    });
  } // end buildDatasets

  var datasets = buildDatasets(dim, labels, all, team, group, person);

  // 应用到所有图表实例
  charts.forEach(function(c) {
    c.chart.data.labels = labels;
    c.chart.data.datasets = datasets;
    c.chart.update();
  });
};

// ===== 产品宽度页维度切换：部门 / 组 =====
App._wWidthDim = 'dept';
App.switchWidthDim = function(type) {
  App._wWidthDim = type;
  document.querySelectorAll('#page-width [data-w-dim]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-w-dim') === type);
  });
  App._updateDimBarChart('page-width', 'wTeamAvg');
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
  // 同步热力图维度
  if (App._hmDim !== type) { App._hmDim = type; App._renderHeatmap(); }
};

// ===== 产品宽度 - 筛选联动 =====
App.updateWidth = function() {
  // 更新基线时间标识 + 当前粒度
  var baselineTag = document.getElementById('w-baseline-tag');
  if (baselineTag) {
    var periods = {};
    (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
      var sp = r.snapshotPeriod || '';
      if (sp) periods[sp] = true;
    });
    var sorted = Object.keys(periods).sort();
    var latest = sorted.length > 0 ? sorted[sorted.length - 1] : '';
    if (latest) {
      var parts = latest.split('-');
      var label = parts.length === 2 ? (parts[0] + '年' + parseInt(parts[1]) + '月') : latest;
      baselineTag.textContent = '📅 基线：' + label;
    }
  }

  var state = App.getFilterState('page-width');
  var granularityTag = document.getElementById('w-granularity-tag');
  if (granularityTag) {
    var gLabel = App.getFilterLabel(state);
    var gName = state.person !== 'all' ? state.person : state.group !== 'all' ? state.group : state.team !== 'all' ? state.team : '全部';
    granularityTag.textContent = '🎯 当前粒度：' + gName;
  }
  var label = App.getFilterLabel(state);

  var team = state.team, group = state.group, person = state.person;

  var data = App.Data.getWidth(state.team);
  if (!data) return;

  // 同步表内月份筛选
  var periodSel = document.getElementById('wImportPeriodFilter');
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';

  // ---- KPI 卡片：从导入数据直接计算筛选后的真实值 ----
  var userGS = (App.ImportData.UserGS || []);
  var custGS = (App.ImportData.CustGS || []);
  var fUser = userGS.slice();
  var fCust = custGS.slice();
  // ── Layer 1: 角色数据范围（强制）──
  var roleFilter = function(arr, fieldDept, fieldGroup, fieldSales) {
    var u = App.loggedInUser || {}, r = u.role || 'admin';
    if (r === 'director' || r === 'interface') return arr.filter(function(x) { return x[fieldDept] === u.dept; });
    if (r === 'manager') return arr.filter(function(x) { return x[fieldGroup] === u.group && x[fieldDept] === u.dept; });
    if (r === 'sales') return arr.filter(function(x) { return x[fieldSales] === u.username; });
    return arr;
  };
  fUser = roleFilter(fUser, 'dept', 'group', 'sales');
  fCust = roleFilter(fCust, 'dept', 'group', 'sales');

  // 月份筛选（选中哪个就筛哪个）
  if (periodFilter) {
    fUser = fUser.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    fCust = fCust.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  if (person !== 'all') {
    fUser = fUser.filter(function(r) { return r.sales === person; });
    fCust = fCust.filter(function(r) { return r.sales === person; });
  } else if (group !== 'all') {
    fUser = fUser.filter(function(r) { return r.group === group; });
    fCust = fCust.filter(function(r) { return r.group === group; });
  } else if (team !== 'all') {
    fUser = fUser.filter(function(r) { return r.dept === team; });
    fCust = fCust.filter(function(r) { return r.dept === team; });
  }
  var fAll = fCust.concat(fUser);
  var fCount = fAll.length;
  var actualAvgWidth = 0;
  if (fCount > 0) {
    var totalW = fAll.reduce(function(s, r) { return s + (r.width || 0); }, 0);
    actualAvgWidth = totalW / fCount;
  }
  var isGuishang = function(r) { var g = (r.guishang || '').toString().trim(); return g === '是' || g === '1'; };
  var actualGuishangUsers = fUser.filter(isGuishang).length;
  var actualGuishangCusts = fCust.filter(isGuishang).length;
  var actualCoverage = fCust.length > 0 ? (actualGuishangCusts / fCust.length * 100) : 0;

  // 用户产品宽度（仅用户数据）
  var userWidthVal = fUser.length > 0 ? fUser.reduce(function(s, r) { return s + (r.width || 0); }, 0) / fUser.length : 0;
  // 客户产品宽度（仅客户数据）
  var custWidthVal = fCust.length > 0 ? fCust.reduce(function(s, r) { return s + (r.width || 0); }, 0) / fCust.length : 0;

  App.setText('w-kpi-avgwidth',        actualAvgWidth.toFixed(2));
  App.setText('w-kpi-user-width',      userWidthVal.toFixed(2));
  App.setText('w-kpi-cust-width',      custWidthVal.toFixed(2));
  App.setText('w-kpi-scale-users',     actualGuishangUsers);
  App.setText('w-user-scale-count',    actualGuishangUsers);
  App.setText('w-kpi-scale-customers', actualGuishangCusts);
  App.setText('w-cust-scale-count',    actualGuishangCusts);
  App.setText('w-kpi-coverage',        actualCoverage.toFixed(1) + '%');

  // 同比/环比暂时保留 data.kpi 的值
  var kpi = data.kpi;
  App.setText('w-kpi-yoy',      kpi.widthYoY);
  App.setText('w-kpi-cov-yoy',  kpi.coverageYoY);
  App.setText('w-kpi-cust-mom', '0');

  // 级联缩放因子（保留给图表缩放用）
  var sf = 1;
  if (person !== 'all') sf = 0.03;
  else if (group !== 'all') sf = 0.10;
  else if (team !== 'all') sf = 0.28;
  var s = function(v) { return Math.round(v * sf); };

  // 销售人员人均宽度区间分布（先筛选记录 → 再按 sales 聚合 → 分桶）
  if (App.charts.wDist) {
    var userGS = (App.ImportData.UserGS || []);
    var custGS = (App.ImportData.CustGS || []);
    var allImported = userGS.concat(custGS);

    // 1. 先按筛选器过滤记录（部门 → 组 → 人员，三级级联）
    var filteredRecords = allImported.slice();
    if (person !== 'all') {
      filteredRecords = filteredRecords.filter(function(r) { return r.sales === person; });
    } else if (group !== 'all') {
      filteredRecords = filteredRecords.filter(function(r) { return r.group === group; });
    } else if (team !== 'all') {
      filteredRecords = filteredRecords.filter(function(r) { return r.dept === team; });
    }

    // 2. 再按 sales 聚合每个销售的人均宽度、部门、小组、品类覆盖率
    var totalProds = (App.ImportData.PRODS || []).length || 27;
    var salesMap = {};
    filteredRecords.forEach(function(r) {
      var sl = r.sales;
      if (!sl) return;
      if (!salesMap[sl]) salesMap[sl] = { total: 0, count: 0, dept: '', grp: '', coveredProds: {} };
      salesMap[sl].total += (r.width || 0);
      salesMap[sl].count++;
      if (!salesMap[sl].dept && r.dept) salesMap[sl].dept = r.dept;
      if (!salesMap[sl].grp && r.group) salesMap[sl].grp = r.group;
      // 统计该销售覆盖的所有产品品类（去重）
      if (r.prods) {
        Object.keys(r.prods).forEach(function(p) {
          if (r.prods[p] === 1 || r.prods[p] === '1') salesMap[sl].coveredProds[p] = 1;
        });
      }
    });
    var allProdNames = App.ImportData.PRODS || [];
    var shortProds = App.ImportData.shortProds || [];
    var distPersons = Object.keys(salesMap).map(function(sl) {
      var m = salesMap[sl];
      var coveredCount = Object.keys(m.coveredProds).length;
      // 生成覆盖/未覆盖品类列表
      var coveredList = [], uncoveredList = [];
      allProdNames.forEach(function(pn, i) {
        if (m.coveredProds[pn]) coveredList.push(shortProds[i] || pn);
        else uncoveredList.push(shortProds[i] || pn);
      });
      return { n: sl, aw: m.total / m.count, dept: m.dept, grp: m.grp, cw: m.count,
               cov: totalProds > 0 ? (coveredCount / totalProds * 100) : 0,
               coveredCount: coveredCount, coveredList: coveredList, uncoveredList: uncoveredList };
    });

    // 3. 分桶
    var distBuckets = [0, 0, 0, 0, 0, 0]; // 0-2, 2-3, 3-4, 4-5, 5-6, 6+
    var bucketPersons = [[], [], [], [], [], []];
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
    App.charts.wDist.data.datasets[0].data = distBuckets;
    // 更新 onClick 下钻处理器（点击柱状图 → 弹窗显示该区间人员明细）
    App.charts.wDist.options.onClick = function(evt, elements) {
      if (elements && elements.length > 0) {
        var idx = elements[0].index;
        var labels = App.charts.wDist.data.labels;
        App.showWidthDrill(labels[idx], idx);
      }
    };
    App.charts.wDist.update();
  }
  if (App.charts.wTeam && data.chartTeam) {
    App.charts.wTeam.data.labels = data.chartTeam.labels;
    App.charts.wTeam.data.datasets[0].data = data.chartTeam.data.map(function(v) { return Math.round(v * sf * 10) / 10; });
    App.charts.wTeam.update();
  }
  // 产品覆盖率图表 — 从筛选后数据直接计算，不缩放
  if (App.charts.wCov) {
    var allProds = App.ImportData.PRODS || [];
    // 客户覆盖率
    var custCov = allProds.map(function(p) {
      var cnt = fCust.filter(function(r) { return r.prods && r.prods[p]; }).length;
      return fCust.length > 0 ? parseFloat((cnt / fCust.length * 100).toFixed(1)) : 0;
    });
    // 用户覆盖率
    var userCov = allProds.map(function(p) {
      var cnt = fUser.filter(function(r) { return r.prods && r.prods[p]; }).length;
      return fUser.length > 0 ? parseFloat((cnt / fUser.length * 100).toFixed(1)) : 0;
    });
    App.charts.wCov.data.labels = allProds;
    App.charts.wCov.data.datasets[0].data = custCov;
    App.charts.wCov._userData = userCov;
    if (App.charts.wCov.data.datasets.length < 2) {
      App.charts.wCov.data.datasets.push({ label: '用户覆盖率', data: userCov, backgroundColor: '#93c5fd', borderRadius: 4, barPercentage: .7 });
    } else {
      App.charts.wCov.data.datasets[1].data = userCov;
    }
    App.charts.wCov.setDatasetVisibility(0, App._covType === 'cust');
    App.charts.wCov.setDatasetVisibility(1, App._covType === 'user');
    App.charts.wCov.update();
  }
  // 按筛选维度的产品宽度柱状图（复用总览页同款逻辑）
  App._updateDimBarChart('page-width', 'wTeamAvg');
  // 产品宽度历史趋势 — 从 snapshot_period 真实计算月度趋势
  if (App.charts.wWidthTrend) {
    var trendBase = (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []);
    // 应用当前筛选
    if (person !== 'all') { trendBase = trendBase.filter(function(r) { return r.sales === person; }); }
    else if (group !== 'all') { trendBase = trendBase.filter(function(r) { return r.group === group; }); }
    else if (team !== 'all') { trendBase = trendBase.filter(function(r) { return r.dept === team; }); }
    // 只保留有月份标签的数据
    trendBase = trendBase.filter(function(r) { return r.snapshotPeriod; });
    // 获取所有月份并排序
    var months = {}; trendBase.forEach(function(r) { months[r.snapshotPeriod] = true; });
    var twl = Object.keys(months).sort();
    if (twl.length === 0) { twl = ['暂无数据']; }
    var twSets = [];
    // 按当前筛选层级分组
    var groupFn;
    if (person !== 'all') { groupFn = function() { return person; }; }
    else if (group !== 'all') { groupFn = function() { return group; }; }
    else if (team !== 'all') { groupFn = function(r) { return r.group || r.dept; }; }
    else { groupFn = function(r) { return r.dept || '未知'; }; }
    // 分组聚合
    var groups = {};
    trendBase.forEach(function(r) {
      var g = groupFn(r);
      if (!groups[g]) groups[g] = {};
      if (!groups[g][r.snapshotPeriod]) groups[g][r.snapshotPeriod] = { total: 0, count: 0 };
      groups[g][r.snapshotPeriod].total += (r.width || 0);
      groups[g][r.snapshotPeriod].count++;
    });
    var colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#7c3aed','#0891b2','#ec4899','#06b6d4','#84cc16','#f97316'];
    var ci = 0;
    Object.keys(groups).sort().forEach(function(g) {
      var series = twl.map(function(m) {
        var d = groups[g][m];
        return d && d.count > 0 ? parseFloat((d.total / d.count).toFixed(2)) : null;
      });
      twSets.push({ label: g, data: series, color: colors[ci % colors.length] });
      ci++;
    });
    // 平均参考线
    var avgLine = twl.map(function(m) {
      var all = { total: 0, count: 0 };
      Object.keys(groups).forEach(function(g) {
        var d = groups[g][m];
        if (d) { all.total += d.total; all.count += d.count; }
      });
      return all.count > 0 ? parseFloat((all.total / all.count).toFixed(2)) : null;
    });
    twSets.push({ label: '平均宽度', data: avgLine, color: '#94a3b8' });
    App.charts.wWidthTrend.data.labels = twl;
    App.charts.wWidthTrend.data.datasets = twSets.map(function(ds) {
      return { label: ds.label, data: ds.data, borderColor: ds.color, backgroundColor: 'transparent', borderDash: ds.label === '平均宽度' ? [6,4] : undefined, tension: .3, fill: false, pointRadius: ds.label === '平均宽度' ? 3 : 4, pointBackgroundColor: ds.color, spanGaps: true };
    });
    App.charts.wWidthTrend.update();
  }
  // 刷新差距分析
  App.renderWidthGapAnalysis();
  // 刷新问题诊断表
  try { App.renderWidthProblemDiag(); } catch(e) {}

  // 刷新产品覆盖热力图 — 从筛选后数据直接计算，不缩放
  App._hmCust = []; App._hmUser = [];
  var allProds2 = App.ImportData.PRODS || [];
  allProds2.forEach(function(p) {
    var custCnt = fCust.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var userCnt = fUser.filter(function(r) { return r.prods && r.prods[p]; }).length;
    App._hmCust.push({ name: p, count: custCnt, total: fCust.length, rate: fCust.length > 0 ? parseFloat((custCnt / fCust.length * 100).toFixed(1)) : 0 });
    App._hmUser.push({ name: p, count: userCnt, total: fUser.length, rate: fUser.length > 0 ? parseFloat((userCnt / fUser.length * 100).toFixed(1)) : 0 });
  });
  // 按覆盖率从大到小排序
  App._hmCust.sort(function(a, b) { return b.rate - a.rate; });
  App._hmUser.sort(function(a, b) { return b.rate - a.rate; });
  App._renderHeatmap();

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
  // 刷新套包组合卡片计数 + 交叉销售推荐（跟随筛选联动）
  try {
    var cs2 = (App.Data.getWidth('all') || {}).crossSell;
    if (cs2 && cs2.bundles && document.getElementById('w-cross-bundles')) {
      App.renderCrossBundles(cs2.bundles);
      App.renderCrossRecommend(cs2);
    }
  } catch(e) {}
  // 刷新低宽度客户统计（跟随筛选联动）
  try { App.filterLowWidth(); } catch(e) {}
  try { App.filterLowWidthUser(); } catch(e) {}
  // 刷新产品宽度后端图表（跟随筛选）
  try { App.reloadWidthCharts(); } catch(e) {}
  // 同步顶部筛选到数据表内下拉 + 刷新明细表
  try {
    var iDept = document.getElementById('wImportDeptFilter');
    var iGrp  = document.getElementById('wImportGroupFilter');
    if (iDept) {
      if (iDept.value !== team) { iDept.value = team; App.ImportData.populateImportGrpDropdown(); if (iGrp) iGrp.value = 'all'; }
      else if (iGrp && iGrp.value !== group) { iGrp.value = group; }
      if (typeof App.ImportData.render === 'function') App.ImportData.render();
    }
  } catch(e) {}
};

  // 刷新宽度趋势图（跟随筛选联动）
  try { App._updateOvWidthTrend(); } catch(e) {}

// ===== 潜力产品 - 筛选联动 =====
App.updatePotential = function() {
  // 更新基线时间标识
  var baselineTag = document.getElementById('p-baseline-tag');
  if (baselineTag) {
    var periods = {};
    (App.ImportPotential.CustRAW || []).concat(App.ImportPotential.UserRAW || []).forEach(function(r) {
      var sp = r.snapshotPeriod || '';
      if (sp) periods[sp] = true;
    });
    var sorted = Object.keys(periods).sort();
    var latest = sorted.length > 0 ? sorted[sorted.length - 1] : '';
    if (latest) {
      var parts = latest.split('-');
      var label = parts.length === 2 ? (parts[0] + '年' + parseInt(parts[1]) + '月') : latest;
      baselineTag.textContent = '📅 基线：' + label;
    }
  }
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

  // 同步潜力产品列表（从导入数据提取）
  if (App.WidthTeamMatrix.RAW && App.WidthTeamMatrix.RAW.length > 0) {
    var potProdSet = {};
    App.WidthTeamMatrix.RAW.forEach(function(r) { if (r.product) potProdSet[r.product] = true; });
    var potProds = Object.keys(potProdSet).sort();
    if (potProds.length > 0) App.ALL_POT_PRODUCTS = potProds;
  }

  // 根据筛选状态获取数据（不再硬编码 'all'）
  var dataTeam = team !== 'all' ? team : 'all';
  var data = App.Data.getPotential(dataTeam);
  if (!data) { console.warn('updatePotential: getPotential 返回空数据'); return; }

  var s = function(v) { return Math.round(v * sf); };

  // ===== 经营概述 (商机预测版) — 传入筛选状态 =====
  try { App.renderPotentialOverview(state); } catch(e) { console.warn('renderPotentialOverview 失败:', e); }

  // ===== 颗粒度按钮联动（筛选变更后自动调整可用粒度） =====
  try { App.updatePotDimButtons(); } catch(e) { console.warn('updatePotDimButtons 失败:', e); }
  try { App.updateTeamDimButtons(); } catch(e) { console.warn('updateTeamDimButtons 失败:', e); }
  // ===== KPI 卡片由 renderPotentialOverview 统一更新，此处保留销售额排名刷新 =====
  try { App.renderPotSalesRank(); } catch(e) { console.warn('renderPotSalesRank 失败:', e); }

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
  // 客户维度 + 用户维度（跟随筛选联动）
  try { App.renderPotentialCustTab(); } catch(e) {}
  try { App.renderPotentialUserTab(); } catch(e) {}

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

  // 1. 历史趋势图 chart-trend（从导入数据动态计算）
  var trendChart = Chart.getChart('chart-trend');
  if (trendChart && trendChart.data && trendChart.data.datasets && trendChart.data.datasets.length >= 3) {
    var potData = App.Data.getPotential(team !== 'all' ? team : 'all');
    var totalCur = potData && potData.overview ? potData.overview.sales : 0;
    var totalPrev = potData && potData.overview ? potData.overview.salesPrev : 0;
    // 用本期/上期数据填充趋势（无月度明细时显示两期对比）
    var trendMonths = ['上期', '本期'];
    trendChart.data.labels = trendMonths;
    trendChart.data.datasets[0].data = [Math.round(totalPrev), Math.round(totalCur)];
    trendChart.data.datasets[1].data = [0, Math.round(totalCur * 0.35)];
    trendChart.data.datasets[2].data = [Math.round(totalPrev * 0.92), Math.round(totalCur * 0.88)];
    trendChart.update('none');
  }

  // 2. 销售量构成 chart-p-composition（跟随筛选）
  try { App._updateCompositionChart(); } catch(e) { console.warn('_updateCompositionChart 失败:', e); }

  // 3. 产品销售额趋势 chart-p-yoy（12月折线，缩放跟随筛选+多选）
  try { App._updateYoyChart(); } catch(e) { console.warn('_updateYoyChart 失败:', e); }

  // 4. 量价四象限 chart-p-quadrant（严格三级数据隔离）
  var quadChart = Chart.getChart('chart-p-quadrant') || (App.charts && App.charts.potQuadrant);
  if (quadChart) {
    // ── 使用 getFilteredPotData 严格遵循筛选边界 ──
    var qCust = App.getFilteredPotData('cust');
    var qAgg = {};
    qCust.forEach(function(r) {
      if (!r.product) return;
      if (!qAgg[r.product]) qAgg[r.product] = { amount: 0, amountPrev: 0 };
      qAgg[r.product].amount += (r.amount || 0);
      qAgg[r.product].amountPrev += (r.amountPrev || 0);
    });
    var quadColors = { '量价齐升': '#10b981', '量跌价增': '#f59e0b', '量价齐跌': '#ef4444', '量增价跌': '#8b5cf6' };
    var datasets = { '量价齐升': [], '量跌价增': [], '量价齐跌': [], '量增价跌': [] };

    // 无真实数据时补充 WidthTeamMatrix 数据源
    if (Object.keys(qAgg).length === 0) {
      (App.WidthTeamMatrix.RAW || []).forEach(function(d) {
        if (!d.product) return;
        // WidthTeamMatrix 需额外过滤（它不受 getFilteredPotData 筛选）
        if (person !== 'all') {
          var pi = App.PERSONS.find(function(p){return p.n===person;});
          if (!pi || !pi.grp || d.team !== pi.grp) return;
        } else if (group !== 'all' && d.team !== group) return;
        else if (team !== 'all') {
          var gd = (App.GROUPS.find(function(g){return g.n===d.team;})||{}).dept;
          if (gd !== team && d.team !== team) return;
        }
        if (!qAgg[d.product]) qAgg[d.product] = { amount: 0, amountPrev: 0 };
        qAgg[d.product].amount += d.amount || 0;
        qAgg[d.product].amountPrev += d.amountPrev || 0;
      });
    }

    // 仍然无数据：显示空象限（无 DEMO 兜底）
    var products = Object.keys(qAgg);
    products.forEach(function(p) {
      var amtYoy, qtyYoy;
      var v = qAgg[p] || { amount: 0, amountPrev: 0 };
      amtYoy = v.amountPrev > 0 ? ((v.amount - v.amountPrev) / v.amountPrev * 100) : (v.amount > 0 ? 100 : 0);
      qtyYoy = amtYoy * 0.5;
      var q = amtYoy >= 0 && qtyYoy >= 0 ? '量价齐升' : amtYoy >= 0 && qtyYoy < 0 ? '量跌价增' : amtYoy < 0 && qtyYoy < 0 ? '量价齐跌' : '量增价跌';
      var amt = v.amount || 500;
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

  // 7. 从后端 API 刷新潜力产品图表（composition / trend / quadrant）
  try { App.reloadPotentialCharts(); } catch(e) {}
};

// ===== 产品线 & 组织范围数据引擎 =====
// 11个标准潜力产品
App.ALL_POT_PRODUCTS = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型（文搜&多模态）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
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
  var avgShare = 100 / App.BUSINESS_DEPTS.length; // ~16.7%
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
    var d = App.BUSINESS_DEPTS.find(function(x) { return x.n === team; });
    if (d) return Math.round(d.cw * ratio) || 1;
    return Math.round(totalGlobal * 0.28);
  }
  return totalGlobal;
};

// 根据当前筛选范围获取某个产品的12月折线数据（优先真实数据，无数据回退DEMO）
App.getScopedYoyData = function(prodName) {
  // ── 真实数据路径：跨所有月份聚合（不受月份筛选器限制）──
  var fCustAll = App.getFilteredPotDataAllPeriods('cust');
  var monthlyMap = {};
  fCustAll.forEach(function(r) {
    if (r.product !== prodName) return;
    var sp = r.snapshotPeriod || '';
    if (!sp) return;
    monthlyMap[sp] = (monthlyMap[sp] || 0) + (r.amount || 0);
  });
  // 用户数据补充
  var fUserAll = App.getFilteredPotDataAllPeriods('user');
  fUserAll.forEach(function(r) {
    if (r.product !== prodName) return;
    var sp = r.snapshotPeriod || '';
    if (!sp || monthlyMap[sp]) return;
    monthlyMap[sp] = (monthlyMap[sp] || 0) + (r.outAmt || 0);
  });
  var months = Object.keys(monthlyMap).sort();
  if (months.length >= 2) {
    return months.map(function(m) { return Math.round(monthlyMap[m]); });
  }
  if (months.length === 1) {
    var arr = new Array(12).fill(null);
    arr[11] = Math.round(monthlyMap[months[0]]);
    return arr;
  }

  // 无导入数据：返回空（不回退 DEMO，遵循"无数据兜底"规则）
  return [];
};

// 根据当前筛选范围获取某个产品的销售额（优先真实数据，无数据回退DEMO）
App.getScopedCompositionValue = function(prodName) {
  // ── 真实数据路径 ──
  var fCust = App.getFilteredPotData('cust');
  var fUser = App.getFilteredPotData('user');
  var total = 0;
  fCust.forEach(function(r) { if (r.product === prodName) total += (r.amount || 0); });
  fUser.forEach(function(r) { if (r.product === prodName) total += (r.outAmt || 0); });
  // 无导入数据：返回 0（不回退 DEMO，遵循"无数据兜底"规则）
  return Math.round(total);
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
  var totalProds = (App.ImportData && App.ImportData.PRODS ? App.ImportData.PRODS.length : 27);

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
      '<th style="text-align:center;padding:8px">品类覆盖率<span title="该销售覆盖的产品品类数 ÷ 总品类数(27)。例如覆盖了IPC、NVR、门禁3个品类，则覆盖率=3/27=11.1%"> ⓘ</span></th>' +
      '</tr></thead><tbody>';
    persons.forEach(function(p, i) {
      var detailId = 'wdrill-detail-' + idx + '-' + i;
      html += '<tr style="border-bottom:1px solid #f3f4f6;cursor:pointer" onclick="var d=document.getElementById(\'' + detailId + '\');d.style.display=d.style.display===\'none\'?\'\':\'none\'" title="点击查看品类覆盖明细">' +
        '<td style="padding:6px 8px;color:#9ca3af">' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-weight:600">' + p.n + ' ▸</td>' +
        '<td style="padding:6px 8px;color:#6b7280">' + (p.dept || '-') + '</td>' +
        '<td style="padding:6px 8px;color:#6b7280">' + (p.grp || '-') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:700;color:#1a56db">' + p.aw.toFixed(2) + '</td>' +
        '<td style="padding:6px 8px;text-align:center">' + (p.cw || 0) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:600;color:' + (p.cov >= 50 ? '#059669' : p.cov >= 25 ? '#d97706' : '#dc2626') + '">' + (p.cov || 0).toFixed(1) + '%</td>' +
        '</tr>';
      // 品类覆盖明细行（默认隐藏，点击展开）
      html += '<tr id="' + detailId + '" style="display:none;border-bottom:1px solid #e5e7eb;background:#fafbfc">' +
        '<td colspan="7" style="padding:4px 8px 6px 16px;font-size:11px;line-height:1.6">' +
        '<span style="color:#059669;font-weight:600">✓ 已覆盖(' + (p.coveredCount || 0) + '/' + totalProds + '):</span> ' +
        '<span style="color:#065f46">' + (p.coveredList && p.coveredList.length > 0 ? p.coveredList.join('、') : '无') + '</span>' +
        '<br><span style="color:#dc2626;font-weight:600">✗ 未覆盖(' + (totalProds - (p.coveredCount || 0)) + '/' + totalProds + '):</span> ' +
        '<span style="color:#991b1b">' + (p.uncoveredList && p.uncoveredList.length > 0 ? p.uncoveredList.join('、') : '无') + '</span>' +
        '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  App.showModal('人均产品宽度分布明细', html);
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
  var canvas = document.getElementById('chart-p-quad2');
  if (!canvas) return;
  // 如果容器不可见则延迟重试
  if (canvas.offsetWidth === 0) {
    setTimeout(function() { App._updateQuad2Chart(); }, 300);
    return;
  }
  // 图表未创建则初始化
  if (!App.charts.potQuad2) {
    var quad2Colors = { '成熟核心': '#10b981', '蓝海潜力': '#3b82f6', '增长见顶': '#f59e0b', '弱势品类': '#ef4444' };
    App.charts.potQuad2 = new Chart(canvas, {
      type: 'scatter',
      data: { datasets: [
        { label: '成熟核心', data: [], backgroundColor: quad2Colors['成熟核心'], pointRadius: 8, pointHoverRadius: 12 },
        { label: '蓝海潜力', data: [], backgroundColor: quad2Colors['蓝海潜力'], pointRadius: 8, pointHoverRadius: 12 },
        { label: '增长见顶', data: [], backgroundColor: quad2Colors['增长见顶'], pointRadius: 8, pointHoverRadius: 12 },
        { label: '弱势品类', data: [], backgroundColor: quad2Colors['弱势品类'], pointRadius: 8, pointHoverRadius: 12 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 10 } } },
          tooltip: { callbacks: { label: function(ctx) { var d = ctx.raw; return d.prodName + ': 覆盖率' + d.x.toFixed(1) + '% 增速' + (d.y>=0?'+':'') + d.y.toFixed(1) + '% 销售额¥' + (d.amount||0) + '万'; }}}
        },
        scales: { x: { title: { display:true, text:'客户覆盖率 (%)', font:{size:10} }, grid: { color:'#f3f4f6' }, min:0, max:60 },
                  y: { title: { display:true, text:'销售额同比增速 (%)', font:{size:10} }, grid: { color:'#f3f4f6' }, min:-30, max:100 } }
      }
    });
  }
  var chart = App.charts.potQuad2;
  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;

  // 统一数据过滤
  var raw = App.getFilteredPotData('cust');

  // 按产品聚合
  var prodAgg = {};
  var allCusts = {};
  raw.forEach(function(r) {
    var p = r.product || '';
    if (!p) return;
    if (!prodAgg[p]) prodAgg[p] = { amount: 0, amountPrev: 0, custs: {} };
    prodAgg[p].amount += r.amount || 0;
    prodAgg[p].amountPrev += r.amountPrev || 0;
    if (r.custName) { prodAgg[p].custs[r.custName] = true; allCusts[r.custName] = true; }
  });
  var totalCusts = Object.keys(allCusts).length || 1;

  var quadData = { '成熟核心':[], '蓝海潜力':[], '增长见顶':[], '弱势品类':[] };
  var hasRealData = Object.keys(prodAgg).length > 0;

  if (hasRealData) {
    Object.keys(prodAgg).forEach(function(p) {
      var d = prodAgg[p];
      var cov = parseFloat((Object.keys(d.custs).length / totalCusts * 100).toFixed(1));
      var yoy = d.amountPrev > 0 ? parseFloat(((d.amount - d.amountPrev) / d.amountPrev * 100).toFixed(1)) : (d.amount > 0 ? 100 : 0);
      var pt = { x: cov, y: yoy, prodName: p, amount: Math.round(d.amount) };
      if (cov >= 12 && yoy >= 10) quadData['成熟核心'].push(pt);
      else if (cov < 12 && yoy >= 10) quadData['蓝海潜力'].push(pt);
      else if (cov >= 12 && yoy < 10) quadData['增长见顶'].push(pt);
      else quadData['弱势品类'].push(pt);
    });
  } else {
    // 无导入数据：显示空象限（不回退 DEMO，遵循"无数据兜底"规则）
  }

  var keys = ['成熟核心','蓝海潜力','增长见顶','弱势品类'];
  var allPoints = [];
  keys.forEach(function(k, ki) {
    chart.data.datasets[ki].data = quadData[k];
    allPoints = allPoints.concat(quadData[k]);
  });

  // 动态调整坐标轴范围
  if (allPoints.length > 0) {
    var maxX = Math.max.apply(null, allPoints.map(function(p) { return p.x; }));
    var maxY = Math.max.apply(null, allPoints.map(function(p) { return p.y; }));
    var minY = Math.min.apply(null, allPoints.map(function(p) { return p.y; }));
    chart.options.scales.x.max = Math.max(20, Math.ceil(maxX * 1.3));
    chart.options.scales.y.max = Math.max(20, Math.ceil(Math.abs(maxY) * 1.3));
    chart.options.scales.y.min = Math.min(hasRealData ? -10 : -30, Math.floor(Math.min(0, minY) * 1.3));
  } else {
    chart.options.scales.x.max = 60;
    chart.options.scales.y.max = 100;
    chart.options.scales.y.min = -30;
  }
  chart.update('none');
  try { chart.resize(); } catch(e) {}

  var prodCount = hasRealData ? Object.keys(prodAgg).length : 10;
  var tagEl = document.getElementById('p-quad2-tag');
  if (tagEl) {
    var scope = person !== 'all' ? '个人: ' + person : group !== 'all' ? '组: ' + group : team !== 'all' ? '部门: ' + team : '全部部门';
    tagEl.textContent = prodCount + '品类 · ' + scope + (hasRealData ? '' : ' (示例数据)');
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
// 热力图切换维度（客户/用户）
App._hmDim = 'cust';
App.switchHeatmapDim = function(dim) {
  App._hmDim = dim;
  document.querySelectorAll('#page-width [data-hm]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-hm') === dim);
  });
  // 同步更新产品覆盖率图表的切换维度
  if (dim !== App._covType) App.switchCovType(dim);
  App._renderHeatmap();
};
App._renderHeatmap = function() {
  var el = document.getElementById('w-heatmap');
  if (!el) return;
  var data = App._hmDim === 'cust' ? (App._hmCust || []) : (App._hmUser || []);
  var label = App._hmDim === 'cust' ? '客户' : '用户';
  if (!data.length) { el.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af">暂无数据</p>'; return; }
  el.innerHTML = data.map(function(p) {
    var rate = p.rate;
    var cls = rate >= 70 ? 'h-great' : (rate >= 40 ? 'h-good' : (rate >= 10 ? 'h-medium' : 'h-low'));
    return '<div class="heatmap-cell ' + cls + '" onclick="App._drillHeatmap(\'' + p.name + '\')" title="点击查看覆盖' + label + '明细" style="cursor:pointer">' +
             '<div class="h-name">' + p.name + '</div>' +
             '<div class="h-rate">' + rate.toFixed(1) + '%</div>' +
             '<div class="h-count">' + p.count + ' / ' + p.total + '</div>' +
           '</div>';
  }).join('');
};
// 热力图下钻：点击卡片查看覆盖该产品的客户/用户清单（跟随筛选层级）
App._drillHeatmap = function(prodName) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '1000px'; modalBox.style.width = '95%'; }
  var isCust = App._hmDim === 'cust';
  var data = (isCust ? (App.ImportData.CustGS || []) : (App.ImportData.UserGS || [])).slice();
  // 应用当前筛选层级（月份 + 部门/组/人员）
  var state = (typeof App.getFilterState === 'function') ? App.getFilterState('page-width') : { team: 'all', group: 'all', person: 'all' };
  var periodSel = document.getElementById('wImportPeriodFilter');
  var pf = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  if (pf) { data = data.filter(function(r) { return (r.snapshotPeriod || '') === pf; }); }
  if (state.person !== 'all') {
    data = data.filter(function(r) { return r.sales === state.person; });
  } else if (state.group !== 'all') {
    data = data.filter(function(r) { return r.group === state.group; });
  } else if (state.team !== 'all') {
    data = data.filter(function(r) { return r.dept === state.team; });
  }
  // 筛选覆盖了该产品的记录，按 name/user 去重（避免多月重复）
  var covered = data.filter(function(r) { return r.prods && r.prods[prodName]; });
  var seen = {};
  covered = covered.filter(function(r) {
    var key = (r.user || r.name || '') + '|' + (r.siebel || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  var label = isCust ? '客户' : '用户';
  var html = '<h3 style="margin:0 0 8px">' + prodName + ' — 覆盖' + label + '明细</h3>' +
    '<p style="color:#6b7280;margin:0 0 16px">共 <strong>' + covered.length + '</strong> 个' + label + '覆盖了该产品</p>';
  if (covered.length === 0) {
    html += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无覆盖记录</p>';
  } else {
    html += '<table style="width:100%;table-layout:fixed;font-size:13px;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb">' +
      '<th style="text-align:left;padding:8px 10px">' + label + '名称</th>' +
      '<th style="text-align:left;padding:8px 10px">销售</th>' +
      '<th style="text-align:left;padding:8px 10px">部门</th>' +
      '<th style="text-align:left;padding:8px 10px">小组</th>' +
      '<th style="text-align:center;padding:8px 10px">产品宽度</th>' +
      '</tr></thead><tbody>';
    covered.forEach(function(r) {
      html += '<tr style="border-bottom:1px solid #f3f4f6">' +
        '<td style="padding:6px 10px;font-weight:600;white-space:nowrap">' + (r.user || r.name || '-') + '</td>' +
        '<td style="padding:6px 10px;white-space:nowrap">' + (r.sales || '-') + '</td>' +
        '<td style="padding:6px 10px;color:#6b7280;word-break:break-all">' + (r.dept || '-') + '</td>' +
        '<td style="padding:6px 10px;color:#6b7280;word-break:break-all">' + (r.group || '-') + '</td>' +
        '<td style="padding:6px 10px;text-align:center;font-weight:700;color:#1a56db">' + (r.width || 0) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }
  App.showModal(prodName + ' — 覆盖' + label + '明细', html);
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

// ===== 产品分组定义（综合安防体系 5 层） =====
App.WidthProductGroups = {
  '核心感知':   ['IPC','球机','专用摄像机','NVR','存储'],
  '通行管控':   ['门禁','人员通道','出入口停车','对讲'],
  '报警联动':   ['报警','传感产品','音频产品','智慧屏','LED与拼控','LCD与解码'],
  '网络设施':   ['网络产品','服务器','网络安全','综合布线'],
  '智能分析':   ['智能计算','智能交通','通用软件','行业软件'],
  '其他':       ['移动终端','基础软件','新业务','消防']
};

// ===== 当前 Lift 数据缓存 =====
App._liftCache = null;
App._liftGroupFilter = null;

// ===== 7 级热力色阶（对齐 Lift_27产品分析） =====
App._liftHeatClass = function(v) {
  if (v === 0) return 'x0';
  if (v < 0.8) return 'heat-1';
  if (v < 1.0) return 'heat-2';
  if (v < 1.2) return 'heat-3';
  if (v < 1.8) return 'heat-4';
  if (v < 2.5) return 'heat-5';
  if (v < 4)   return 'heat-6';
  return 'heat-7';
};

// ===== 渲染产品分组胶囊 =====
App._renderGroupPills = function() {
  var bar = document.getElementById('w-cross-group-bar');
  if (!bar) return;
  var html = '<span class="group-pill sel" onclick="App._filterLiftGroup(null,this)">全部</span>';
  Object.keys(App.WidthProductGroups).forEach(function(g) {
    html += '<span class="group-pill" onclick="App._filterLiftGroup(\'' + g + '\',this)">' + g + '（' + App.WidthProductGroups[g].length + '个）</span>';
  });
  bar.innerHTML = html;
};

// ===== 分组筛选 =====
App._filterLiftGroup = function(g, el) {
  var pills = document.querySelectorAll('#w-cross-group-bar .group-pill');
  pills.forEach(function(p) { p.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  App._liftGroupFilter = g;
  App.renderCrossSellMatrix();
};

// ===== 产品交叉销售关联矩阵（Lift · 27×27） =====
App.renderCrossSellMatrix = function(data) {
  // 获取数据
  if (!data) {
    var cs = (App.Data.getWidth('all') || {}).crossSell;
    if (!cs || !cs.prods || !cs.matrix) return;
    data = cs;
  }
  App._liftCache = data;  // 缓存供 TOP20 / 差距 / CSV 使用

  var el = document.getElementById('w-cross-sell-matrix');
  if (!el || !data.prods || !data.matrix) return;

  // ── 分组胶囊（首次渲染） ──
  if (!document.getElementById('w-cross-group-bar') || document.getElementById('w-cross-group-bar').children.length === 0) {
    App._renderGroupPills();
  }

  var allProds = data.prods;
  var mat = data.matrix;

  // ── 分组筛选 ──
  var group = App._liftGroupFilter;
  var indices = [];
  if (group && App.WidthProductGroups[group]) {
    var gProds = App.WidthProductGroups[group];
    allProds.forEach(function(p, i) {
      if (gProds.indexOf(p) >= 0) indices.push(i);
    });
  } else {
    for (var k = 0; k < allProds.length; k++) indices.push(k);
  }

  // ── 排序 ──
  var sortBy = (document.getElementById('w-cross-sort') || {}).value || 'default';
  if (sortBy === 'alpha') {
    indices.sort(function(a, b) { return allProds[a].localeCompare(allProds[b]); });
  } else if (sortBy === 'lift_desc' || sortBy === 'coverage') {
    // 计算每个产品的平均Lift / 覆盖率用于排序
    var scores = {};
    indices.forEach(function(i) {
      var sum = 0, cnt = 0;
      indices.forEach(function(j) {
        if (i === j) return;
        var v = (i < j) ? mat[i][j] : mat[j][i];
        if (sortBy === 'lift_desc') { sum += v; cnt++; }
        else { if (v > 0) cnt++; }  // coverage: count non-zero
      });
      scores[i] = sortBy === 'lift_desc' ? (cnt > 0 ? sum / cnt : 0) : cnt;
    });
    indices.sort(function(a, b) { return scores[b] - scores[a]; });
  }

  var prods = indices.map(function(i) { return allProds[i]; });
  var n = prods.length;

  // ── 统计卡片（对齐参考阈值） ──
  var stats = { strong: 0, medium: 0, weak: 0, neg: 0, total: 0 };
  for (var si = 0; si < n; si++) {
    for (var sj = si + 1; sj < n; sj++) {
      var ri = indices[si], rj = indices[sj];
      var sv = (ri < rj) ? mat[ri][rj] : mat[rj][ri];
      if (sv <= 0) continue;
      stats.total++;
      if (sv >= 2.5) stats.strong++;
      else if (sv >= 1.8) stats.medium++;
      else if (sv >= 1.2) stats.weak++;
      else if (sv < 0.8) stats.neg++;
    }
  }

  var statsHtml = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:12px">' +
    '<div style="background:#f8fafc;border-left:4px solid #4338ca;border-radius:6px;padding:8px 14px;min-width:90px"><div style="color:#6b7280">强关联(≥2.5)</div><div style="font-size:20px;font-weight:700;color:#4338ca">' + stats.strong + ' 对</div></div>' +
    '<div style="background:#f8fafc;border-left:4px solid #059669;border-radius:6px;padding:8px 14px;min-width:90px"><div style="color:#6b7280">中关联(1.8-2.5)</div><div style="font-size:20px;font-weight:700;color:#059669">' + stats.medium + ' 对</div></div>' +
    '<div style="background:#f8fafc;border-left:4px solid #16a34a;border-radius:6px;padding:8px 14px;min-width:90px"><div style="color:#6b7280">弱关联(1.2-1.8)</div><div style="font-size:20px;font-weight:700;color:#16a34a">' + stats.weak + ' 对</div></div>' +
    '<div style="background:#f8fafc;border-left:4px solid #ef4444;border-radius:6px;padding:8px 14px;min-width:90px"><div style="color:#6b7280">互斥/弱(<0.8)</div><div style="font-size:20px;font-weight:700;color:#ef4444">' + stats.neg + ' 对</div></div>' +
    '<div style="background:#f8fafc;border-left:4px solid #e5e7eb;border-radius:6px;padding:8px 14px;min-width:80px"><div style="color:#6b7280">产品对总计</div><div style="font-size:20px;font-weight:700;color:#374151">' + stats.total + ' 对</div></div>' +
    '</div>';

  // ── 矩阵表头（截断长名称） ──
  var short = function(p) { return p.length > 6 ? p.substring(0, 5) + '…' : p; };
  var html = '<table class="cross-matrix" style="font-size:10px"><thead><tr><th class="row-label">产品 A ╲ B</th>';
  for (var i = 0; i < n; i++) { html += '<th title="' + prods[i] + '">' + short(prods[i]) + '</th>'; }
  html += '</tr></thead><tbody>';

  for (var i = 0; i < n; i++) {
    html += '<tr><td class="row-label" style="font-size:11px">' + prods[i] + '</td>';
    for (var j = 0; j < n; j++) {
      var ri2 = indices[i], rj2 = indices[j];
      if (ri2 === rj2) {
        html += '<td class="x0">·</td>';
      } else {
        var v = (ri2 < rj2) ? mat[ri2][rj2] : mat[rj2][ri2];
        var cls = App._liftHeatClass(v);
        html += '<td class="' + cls + '" title="' + allProds[ri2] + ' → ' + allProds[rj2] + ': Lift ' + v.toFixed(2) + '">' + v.toFixed(1) + '</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  el.innerHTML = statsHtml + html;
};

// ===== 按钮高亮切换 =====
App._setLiftActiveBtn = function(active) {
  var btnTop = document.getElementById('w-cross-btn-top');
  var btnGap = document.getElementById('w-cross-btn-gap');
  if (active === 'top') {
    if (btnTop) { btnTop.className = 'btn btn-blue'; btnTop.style.background = '#2563eb'; btnTop.style.color = '#fff'; btnTop.style.border = 'none'; }
    if (btnGap) { btnGap.className = 'btn btn-ghost'; btnGap.style.background = '#fff'; btnGap.style.color = '#64748b'; btnGap.style.border = '1px solid #e2e8f0'; }
  } else {
    if (btnGap) { btnGap.className = 'btn btn-blue'; btnGap.style.background = '#2563eb'; btnGap.style.color = '#fff'; btnGap.style.border = 'none'; }
    if (btnTop) { btnTop.className = 'btn btn-ghost'; btnTop.style.background = '#fff'; btnTop.style.color = '#64748b'; btnTop.style.border = '1px solid #e2e8f0'; }
  }
};

// ===== TOP 20 强关联对 =====
App.showTopPairs = function() {
  App._setLiftActiveBtn('top');
  var data = App._liftCache;
  if (!data) { data = (App.Data.getWidth('all') || {}).crossSell; App._liftCache = data; }
  if (!data || !data.prods || !data.matrix) return;
  var prods = data.prods, mat = data.matrix, n = prods.length;
  var pairs = [];
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      if (mat[i][j] > 0) pairs.push({ a: prods[i], b: prods[j], lift: mat[i][j] });
    }
  }
  pairs.sort(function(a, b) { return b.lift - a.lift; });
  var top = pairs.slice(0, 20);

  var card = document.getElementById('w-cross-pairs-card');
  card.style.display = 'block';
  document.getElementById('w-cross-pairs-title').textContent = '🏆 综合安防 · TOP 20 强关联产品对 (Lift)';
  document.getElementById('w-cross-pairs-body').innerHTML = top.map(function(p, i) {
    var color = p.lift >= 4 ? '#4338ca' : p.lift >= 2.5 ? '#2563eb' : p.lift >= 1.8 ? '#059669' : '#16a34a';
    return '<div class="pair-row">' +
      '<span class="pair-rank">' + (i + 1) + '</span>' +
      '<span class="pair-name"><strong>' + p.a + '</strong> → <strong style="color:#2563eb">' + p.b + '</strong></span>' +
      '<span class="pair-lift" style="color:' + color + '">' + p.lift.toFixed(2) + 'x</span></div>';
  }).join('');
};

// ===== 高覆盖率 + 低关联 差距分析 =====
App.showGapPairs = function() {
  App._setLiftActiveBtn('gap');
  var data = App._liftCache;
  if (!data) { data = (App.Data.getWidth('all') || {}).crossSell; App._liftCache = data; }
  if (!data || !data.prods || !data.matrix) return;
  var prods = data.prods, mat = data.matrix, n = prods.length;

  // 计算覆盖率
  var allData = (App.ImportData.CustGS || []).concat(App.ImportData.UserGS || []);
  var N = allData.length;
  var coverage = {};
  prods.forEach(function(p) {
    var cnt = allData.filter(function(r) { return r.prods && r.prods[p]; }).length;
    coverage[p] = { count: cnt, rate: N > 0 ? parseFloat((cnt / N * 100).toFixed(1)) : 0 };
  });

  var pairs = [];
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var crA = coverage[prods[i]].rate, crB = coverage[prods[j]].rate;
      if (crA > 60 && crB > 60 && mat[i][j] < 1.2 && mat[i][j] > 0) {
        pairs.push({ a: prods[i], b: prods[j], lift: mat[i][j], crA: crA, crB: crB });
      }
    }
  }
  pairs.sort(function(a, b) { return a.lift - b.lift; });

  var card = document.getElementById('w-cross-pairs-card');
  card.style.display = 'block';
  document.getElementById('w-cross-pairs-title').textContent = '🎯 高覆盖率但关联弱的增销机会 (Lift < 1.2)';
  document.getElementById('w-cross-pairs-body').innerHTML = pairs.slice(0, 15).map(function(p, i) {
    return '<div class="pair-row">' +
      '<span class="pair-rank">' + (i + 1) + '</span>' +
      '<span class="pair-name"><strong>' + p.a + '</strong> + <strong>' + p.b + '</strong> &nbsp; <span style="font-size:11px;color:#64748b">覆盖率 ' + p.crA + '% / ' + p.crB + '%</span></span>' +
      '<span class="pair-lift" style="color:#dc2626">' + p.lift.toFixed(2) + 'x <span style="font-size:10px;color:#94a3b8">增销机会</span></span></div>';
  }).join('') || '<p style="color:#94a3b8;padding:12px">当前数据中所有高覆盖率产品都已有较好的关联度，无需特别关注的增销差距。</p>';
};

// ===== CSV 导出 =====
App.exportLiftCSV = function() {
  var data = App._liftCache;
  if (!data) { data = (App.Data.getWidth('all') || {}).crossSell; App._liftCache = data; }
  if (!data || !data.prods || !data.matrix) return;
  var prods = data.prods, mat = data.matrix, n = prods.length;
  var allData = (App.ImportData.CustGS || []).concat(App.ImportData.UserGS || []);
  var csv = '产品A,产品B,Lift,共同客户数,A覆盖数,B覆盖数\n';
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var cntA = allData.filter(function(r) { return r.prods && r.prods[prods[i]]; }).length;
      var cntB = allData.filter(function(r) { return r.prods && r.prods[prods[j]]; }).length;
      var both = allData.filter(function(r) { return r.prods && r.prods[prods[i]] && r.prods[prods[j]]; }).length;
      csv += '"' + prods[i] + '","' + prods[j] + '",' + mat[i][j] + ',' + both + ',' + cntA + ',' + cntB + '\n';
    }
  }
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'Lift_27products.csv'; a.click();
  App.addLog('数据导出', '产品宽度', '导出Lift分析CSV');
};

App._bundleStock = {};
;

App.renderCrossBundles = function(bundles) {
  var el = document.getElementById('w-cross-bundles');
  if (!el || !bundles) return;

  // ── 根据页面筛选限定计数范围 ──
  var state = App.getFilterState('page-width');
  var filterFn = function(r) { return true; };
  if (state.person !== 'all') filterFn = function(r) { return r.person === state.person; };
  else if (state.group !== 'all') filterFn = function(r) { return r.group === state.group; };
  else if (state.team !== 'all') filterFn = function(r) { return r.team === state.team; };

  el.innerHTML = bundles.map(function(b) {
    var scoreColor = b.score >= 3.5 ? '#7c3aed' : (b.score >= 2.5 ? '#dc2626' : (b.score >= 2 ? '#f59e0b' : '#10b981'));
    var stock = App._bundleStock[b.name] || { custs:[], users:[] };
    var filteredCusts = (stock.custs || []).filter(filterFn);
    var filteredUsers = (stock.users || []).filter(filterFn);
    return '<div class="bundle-card" style="border-left:3px solid ' + scoreColor + ';cursor:pointer" onclick="App.showBundleDrill(\'' + b.name + '\')" title="点击查看客户用户明细">' +
      '<div class="bundle-header"><strong>' + b.name + '</strong><span class="bundle-score" style="background:' + scoreColor + '">' + b.score.toFixed(1) + '</span></div>' +
      '<div class="bundle-prods">' + b.prods.map(function(p) { return '<span class="bundle-pill">' + p + '</span>'; }).join('') + '</div>' +
      '<div class="bundle-desc">覆盖率: <strong>' + b.rate + '</strong> | ' + b.desc + '</div>' +
      '<div style="font-size:11px;color:#6b7280;margin-top:4px">📊 涉及客户 ' + filteredCusts.length + ' 家 / 用户 ' + filteredUsers.length + ' 个</div>' +
      '</div>';
  }).join('');
};

App.showBundleDrill = function(bundleName) {
  var stock = App._bundleStock[bundleName];
  if (!stock) { App.showModal('套包明细', '<p style="text-align:center;padding:40px">暂无明细数据</p>'); return; }

  // ── 根据页面筛选限定数据范围 ──
  var state = App.getFilterState('page-width');
  var filterFn = function(r) { return true; };
  if (state.person !== 'all') filterFn = function(r) { return r.person === state.person; };
  else if (state.group !== 'all') filterFn = function(r) { return r.group === state.group; };
  else if (state.team !== 'all') filterFn = function(r) { return r.team === state.team; };
  var custs = (stock.custs || []).filter(filterFn);
  var users = (stock.users || []).filter(filterFn);

  var cell = function(v, style) { return '<td style="padding:8px 10px;' + (style||'') + '">' + v + '</td>'; };
  var makeTable = function(title, titleColor, rowsData, cols) {
    var ths = cols.map(function(c) { return '<th style="text-align:' + (c.align||'left') + ';padding:8px 10px;white-space:nowrap;width:' + (c.w||'auto') + '">' + c.label + '</th>'; }).join('');
    var trs = rowsData.map(function(r) {
      return '<tr style="border-bottom:1px solid #f3f4f6">' + cols.map(function(c) { return cell(c.render(r), c.style||''); }).join('') + '</tr>';
    }).join('');
    return '<div><h4 style="margin:0 0 10px;color:' + titleColor + ';font-size:14px">' + title + '</h4>' +
      '<table style="width:100%;table-layout:fixed;font-size:13px;border-collapse:collapse"><thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb">' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
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
    '<div style="display:flex;gap:24px;margin-bottom:20px;padding:14px 18px;background:#f8fafc;border-radius:8px;font-size:14px;flex-wrap:wrap">' +
      '<div style="min-width:130px"><div style="color:#6b7280;font-size:12px">套包评分</div><div style="font-size:20px;color:#7c3aed;font-weight:700">' + (stock._score || '—') + '</div></div>' +
      '<div style="min-width:110px"><div style="color:#6b7280;font-size:12px">涉及客户</div><div style="font-size:20px;color:#1a56db;font-weight:700">' + custs.length + ' 家</div></div>' +
      '<div style="min-width:110px"><div style="color:#6b7280;font-size:12px">涉及用户</div><div style="font-size:20px;color:#059669;font-weight:700">' + users.length + ' 个</div></div>' +
      '<div style="min-width:140px"><div style="color:#6b7280;font-size:12px">待覆盖产品数</div><div style="font-size:20px;color:#dc2626;font-weight:700">' + custs.reduce(function(s,c){return s+(c.missing?c.missing.split(',').length:0);},0) + ' 项</div></div>' +
    '</div>' +
    makeTable('👥 客户清单 (' + custs.length + '家)', '#1a56db', custs, cols) +
    '<div style="margin-top:20px"></div>' +
    makeTable('🏢 用户清单 (' + users.length + '个)', '#059669', users, cols);

  App.showModal('📦 ' + bundleName + ' — 覆盖明细', html);
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

// ===== 产品宽度 - 差距分析（从导入数据动态计算，跟随页级筛选 + 月份） =====
App.renderWidthGapAnalysis = function() {
  var tbody = document.getElementById('wGapTable');
  var statsEl = document.getElementById('wGapStats');
  if (!tbody || !statsEl) return;

  var state = App.getFilterState('page-width');
  var team = state.team, group = state.group, person = state.person;
  var raw = App.WidthDetail.getFilteredRaw(); // 已含月份+部门/组/人员三级筛选

  if (!raw.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">当前筛选条件下无数据</td></tr>';
    statsEl.innerHTML = '';
    return;
  }

  // ── 从实际数据计算各组 / 个人 / 部门的平均宽度 ──
  var groupStats = {};   // { groupName: { total, count, dept } }
  var personStats = {};  // { account: { total, count, group } }
  raw.forEach(function(r) {
    var grp = r.team || '(未分组)';
    var acc = r.account || '(未填写)';
    var w = r.width || 0;
    if (!groupStats[grp]) groupStats[grp] = { total: 0, count: 0, dept: r.dept || '' };
    groupStats[grp].total += w; groupStats[grp].count++;
    if (!personStats[acc]) personStats[acc] = { total: 0, count: 0, group: grp };
    personStats[acc].total += w; personStats[acc].count++;
  });

  // 部门统计 = 下属各组汇总
  var deptStats = {};
  Object.keys(groupStats).forEach(function(g) {
    var d = groupStats[g].dept || '(未分类)';
    if (!deptStats[d]) deptStats[d] = { total: 0, count: 0 };
    deptStats[d].total += groupStats[g].total;
    deptStats[d].count += groupStats[g].count;
  });

  function avg(st) { return st.count > 0 ? st.total / st.count : 0; }

  var rows = [];
  var titleSuffix = '';

  if (person !== 'all') {
    // 优先级1: 个人 vs 所属组均值
    var ps = personStats[person];
    if (!ps) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">该人员在当前范围内无数据</td></tr>'; statsEl.innerHTML = ''; return; }
    var pAw = avg(ps);
    var grpAw = groupStats[ps.group] ? avg(groupStats[ps.group]) : pAw;
    var gap = pAw - grpAw;
    var gapRate = grpAw > 0 ? (gap / grpAw * 100) : 0;
    var status = gapRate > 5 ? '🚀 超前' : (gapRate < -5 ? '⚠ 落后' : '✓ 正常');
    var statusCls = gapRate > 5 ? 'b-up' : (gapRate < -5 ? 'b-down' : 'b-flat');
    rows.push({ name: person, parent: ps.group, aw: pAw, parentAvg: grpAw, gap: gap, gapRate: gapRate, status: status, statusCls: statusCls });
    titleSuffix = '（个人 vs 组均值）';
  } else if (group !== 'all') {
    // 优先级2: 组内人员 vs 组均值
    var gAw2 = groupStats[group] ? avg(groupStats[group]) : 0;
    Object.keys(personStats).forEach(function(acc) {
      var ps2 = personStats[acc];
      if (ps2.group !== group) return;
      var pAw2 = avg(ps2);
      if (pAw2 === 0) return;
      var gap2 = pAw2 - gAw2;
      var gapRate2 = gAw2 > 0 ? (gap2 / gAw2 * 100) : 0;
      var status2 = gapRate2 > 5 ? '🚀 超前' : (gapRate2 < -5 ? '⚠ 落后' : '✓ 正常');
      var statusCls2 = gapRate2 > 5 ? 'b-up' : (gapRate2 < -5 ? 'b-down' : 'b-flat');
      rows.push({ name: acc, parent: group, aw: pAw2, parentAvg: gAw2, gap: gap2, gapRate: gapRate2, status: status2, statusCls: statusCls2 });
    });
    titleSuffix = '（个人 vs ' + group + ' 组均值）';
  } else if (team !== 'all') {
    // 优先级3: 部门下小组 vs 部门均值
    var dAw3 = deptStats[team] ? avg(deptStats[team]) : 0;
    Object.keys(groupStats).forEach(function(grp) {
      var gs = groupStats[grp];
      if (gs.dept !== team) return;
      var gAw3 = avg(gs);
      if (gAw3 === 0) return;
      var gap3 = gAw3 - dAw3;
      var gapRate3 = dAw3 > 0 ? (gap3 / dAw3 * 100) : 0;
      var status3 = gapRate3 > 5 ? '🚀 超前' : (gapRate3 < -5 ? '⚠ 落后' : '✓ 正常');
      var statusCls3 = gapRate3 > 5 ? 'b-up' : (gapRate3 < -5 ? 'b-down' : 'b-flat');
      rows.push({ name: grp, parent: team, aw: gAw3, parentAvg: dAw3, gap: gap3, gapRate: gapRate3, status: status3, statusCls: statusCls3 });
    });
    titleSuffix = '（小组 vs ' + team + ' 部门均值）';
  } else {
    // 全部: 部门 vs 全局均值
    var allTotal = 0, allCount = 0;
    Object.keys(deptStats).forEach(function(d) { allTotal += deptStats[d].total; allCount += deptStats[d].count; });
    var allAw = allCount > 0 ? allTotal / allCount : 0;
    Object.keys(deptStats).forEach(function(d) {
      var dAw4 = avg(deptStats[d]);
      if (dAw4 === 0) return;
      var gap4 = dAw4 - allAw;
      var gapRate4 = allAw > 0 ? (gap4 / allAw * 100) : 0;
      var status4 = gapRate4 > 5 ? '🚀 超前' : (gapRate4 < -5 ? '⚠ 落后' : '✓ 正常');
      var statusCls4 = gapRate4 > 5 ? 'b-up' : (gapRate4 < -5 ? 'b-down' : 'b-flat');
      rows.push({ name: d, parent: '全局均值', aw: dAw4, parentAvg: allAw, gap: gap4, gapRate: gapRate4, status: status4, statusCls: statusCls4 });
    });
    titleSuffix = '（部门 vs 全局均值）';
  }

  // 更新标题标签
  var cardTitle = document.querySelector('#wGapAnalysis');
  if (cardTitle) {
    var tagEl = cardTitle.previousElementSibling ? cardTitle.previousElementSibling.querySelector('.tag') : null;
    if (tagEl) tagEl.textContent = titleSuffix.replace(/（/, '').replace(/）/, '');
  }

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">当前范围内无对比数据</td></tr>';
    statsEl.innerHTML = '';
    return;
  }

  // 按差距率升序（落后在前）
  rows.sort(function(a, b) { return a.gapRate - b.gapRate; });

  // 统计卡片
  var aheadCount = rows.filter(function(r) { return r.gapRate > 5; }).length;
  var behindCount = rows.filter(function(r) { return r.gapRate < -5; }).length;
  var normalCount = rows.length - aheadCount - behindCount;
  var maxGap = Math.max.apply(null, rows.map(function(r) { return r.gap; }));
  var minGap = Math.min.apply(null, rows.map(function(r) { return r.gap; }));
  var entityLabel = person !== 'all' ? '个人' : (group !== 'all' ? '个人' : (team !== 'all' ? '团队' : '部门'));

  statsEl.innerHTML =
    '<div class="kpi-card k-green" style="padding:10px 14px"><div class="kpi-label">🚀 超均值' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + aheadCount + '</div><div class="kpi-sub">个 · 差距率 > +5%</div></div>' +
    '<div class="kpi-card" style="padding:10px 14px"><div class="kpi-label">✓ 正常' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + normalCount + '</div><div class="kpi-sub">个 · 差距率 ±5%</div></div>' +
    '<div class="kpi-card k-red" style="padding:10px 14px"><div class="kpi-label">⚠ 落后' + entityLabel + '</div><div class="kpi-value" style="font-size:20px">' + behindCount + '</div><div class="kpi-sub">个 · 差距率 < -5%</div></div>' +
    '<div class="kpi-card k-orange" style="padding:10px 14px"><div class="kpi-label">📏 最大差距</div><div class="kpi-value" style="font-size:20px">' + (minGap < 0 ? minGap.toFixed(2) + ' ~ +' + maxGap.toFixed(2) : '+' + maxGap.toFixed(2)) + '</div><div class="kpi-sub">负=落后 · 正=超前</div></div>';

  // 表格列名
  var parentColLabel = person !== 'all' ? '所属组' : (group !== 'all' ? '所属组' : (team !== 'all' ? '所属部门' : '对比基准'));
  tbody.innerHTML = rows.map(function(r, i) {
    var rnCls = i < 3 ? 'rn rn' + (i + 1) : 'rn rn0';
    var gapSign = r.gap >= 0 ? '+' : '';
    var gapRateSign = r.gapRate >= 0 ? '+' : '';
    var gapColor = r.gap >= 0 ? 'color:#16a34a' : 'color:#dc2626';
    return '<tr>' +
      '<td><span class="' + rnCls + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + App.escapeHtml(r.name) + '</strong></td>' +
      '<td style="text-align:center">' + App.escapeHtml(r.parent) + '</td>' +
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
  App.addLog('数据导出', '产品宽度', '导出团队维度数据CSV');
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

  // 页级筛选状态 + 统一数据源（已含月份 + 三级筛选）
  var state = App.getFilterState('page-width');
  var scopedRaw = App.WidthDetail.getFilteredRaw();

  var itemsA = [], itemsB = [];

  if (mode === 'dept_mean' || mode === 'dept_dept') {
    // 部门维度：显示全部部门，跟随筛选缩减
    var depts = state.team !== 'all' ? [state.team] : App.BUSINESS_DEPTS.map(function(d) { return d.n; });
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

  // 跟随页级筛选的数据范围（已含月份 + 三级筛选）
  var state = App.getFilterState('page-width');
  var scopedRaw = App.WidthDetail.getFilteredRaw();

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
    // 宽度分布桶: 0, 1-3, 4-6, 7-10, 11-15, 16+
    var dist = [0, 0, 0, 0, 0, 0];
    widths.forEach(function(w) {
      if (w === 0) dist[0]++;
      else if (w <= 3) dist[1]++;
      else if (w <= 6) dist[2]++;
      else if (w <= 10) dist[3]++;
      else if (w <= 15) dist[4]++;
      else dist[5]++;
    });
    return { count: filtered.length, avgWidth: avgW, maxWidth: maxW, guishang: gs, guishangRate: filtered.length ? parseFloat((gs / filtered.length * 100).toFixed(1)) : 0, prodCnt: prodCnt, dist: dist };
  }

  function getCenterMean() {
    return getStats(scopedRaw);
  }

  function getDeptMean(deptName) {
    var dg = App.GROUPS.filter(function(g) { return g.dept === deptName; }).map(function(g) { return g.n; });
    return getStats(scopedRaw.filter(function(r) { return dg.indexOf(r.team) >= 0; }));
  }

  function getGroupOfPerson(acc) {
    var r = scopedRaw.find(function(x) { return x.account === acc; });
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
  if (legA) legA.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#1a56db;border-radius:2px;margin-right:4px"></span>' + labelA;
  var legB = document.getElementById('w-compare-dist-legend-B');
  if (legB) legB.innerHTML = '<span style="display:inline-block;width:10px;height:10px;background:#dc2626;border-radius:2px;margin-right:4px"></span>' + labelB;
  if (App.charts.wCompareDist) {
    App.charts.wCompareDist.data.datasets[0].label = labelA;
    App.charts.wCompareDist.data.datasets[0].data = dataA.dist;
    App.charts.wCompareDist.data.datasets[1].label = labelB;
    App.charts.wCompareDist.data.datasets[1].data = dataB.dist;
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
  App.addLog('数据导出', '分组对比', '导出分组对比结果CSV');
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
    var yoyBadge = String(p.yoy).indexOf('+') === 0 ? 'b-up' : (String(p.yoy).indexOf('-') === 0 ? 'b-down' : (p.yoy === '新增' ? 'b-new' : 'b-warn'));
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

// ===== 低宽度客户分析（跟随页级筛选 + 月份，数据隔离） =====
App.filterLowWidth = function(showDetail) {
  var input = document.getElementById('width-threshold');
  var threshold = input ? parseInt(input.value) || 3 : 3;
  var products = App.WidthDetail.PRODUCTS;

  // 数据源：仅客户维度 RAW（CustGS），含月份+三级筛选
  var state = App.getFilterState('page-width');
  var raw = App.WidthCustomer.RAW.slice();
  // 月份筛选
  var periodSel2 = document.getElementById('wImportPeriodFilter');
  var periodFilter2 = periodSel2 ? (periodSel2.value && periodSel2.value !== 'all' ? periodSel2.value : '') : '';
  if (periodFilter2) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter2; });
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.account === state.person; });
  else if (state.group !== 'all') raw = raw.filter(function(r) { return r.team === state.group; });
  else if (state.team !== 'all') {
    var dg2 = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    raw = raw.filter(function(r) { return dg2.indexOf(r.team) >= 0; });
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
  App.BUSINESS_DEPTS.forEach(function(dept) {
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
    var modalBox = document.getElementById('appModalBox');
    if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }
    // 数据源：仅客户维度 RAW，含月份筛选
    var raw = App.WidthCustomer.RAW.slice();
    var periodSel3 = document.getElementById('wImportPeriodFilter');
    var periodFilter3 = periodSel3 ? (periodSel3.value && periodSel3.value !== 'all' ? periodSel3.value : '') : '';
    if (periodFilter3) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter3; });
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
    bodyHtml += '<table class="modal-table" style="table-layout:auto;margin-bottom:14px"><thead><tr><th style="white-space:nowrap">销售</th><th>低宽度客户数</th><th>平均宽度</th></tr></thead><tbody>';
    accRows.forEach(function(a) {
      var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
      bodyHtml += '<tr><td><strong>' + App.escapeHtml(displayName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';

    // 客户明细表
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细</div>';
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table" style="table-layout:auto"><thead><tr><th style="white-space:nowrap">团队</th><th style="white-space:nowrap">销售</th><th style="white-space:nowrap">客户名称</th><th>产品宽度</th><th>规上</th>';
    products.slice(0, 10).forEach(function(p) {
      bodyHtml += '<th title="' + p + '">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 300;
    filtered.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.user || '') + '</td>';
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
    bodyHtml += '<table class="modal-table" style="table-layout:auto;margin-bottom:14px"><thead><tr><th style="white-space:nowrap">销售</th><th>低宽度客户数</th><th>平均宽度</th></tr></thead><tbody>';
    accRows.forEach(function(a) {
      var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
      bodyHtml += '<tr><td><strong>' + App.escapeHtml(displayName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';

    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细</div>';
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table"><thead><tr><th>团队</th><th>销售</th><th>最终用户</th><th>产品宽度</th><th>规上</th>';
    products.slice(0, 10).forEach(function(p) {
      bodyHtml += '<th title="' + p + '">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 300;
    lowCustomers.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.user || '') + '</td>';
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

// ===== 低宽度用户分析（跟随页级筛选 + 月份，数据隔离） =====
App.filterLowWidthUser = function(showDetail) {
  var input = document.getElementById('width-user-threshold');
  var threshold = input ? parseInt(input.value) || 3 : 3;
  var products = App.WidthDetail.PRODUCTS;

  // 数据源：仅用户维度 RAW（UserGS），含月份+三级筛选
  var state = App.getFilterState('page-width');
  var raw = (App.WidthUser.RAW || []).slice();
  // 月份筛选
  var periodSel = document.getElementById('wImportPeriodFilter');
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  if (periodFilter) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.account === state.person; });
  else if (state.group !== 'all') raw = raw.filter(function(r) { return r.team === state.group; });
  else if (state.team !== 'all') {
    var dg = App.GROUPS.filter(function(g) { return g.dept === state.team; }).map(function(g) { return g.n; });
    raw = raw.filter(function(r) { return dg.indexOf(r.team) >= 0; });
  }

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
      App.BUSINESS_DEPTS.forEach(function(dept) {
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
    var modalBox2 = document.getElementById('appModalBox');
    if (modalBox2) { modalBox2.style.maxWidth = '95vw'; modalBox2.style.width = '96%'; }
    var title = '低宽度用户明细（宽度 < ' + threshold + '，共 ' + lowCount + ' 人）';
    var bodyHtml = '<div style="overflow-x:auto;max-width:100%"><table class="modal-table" style="table-layout:auto"><thead><tr><th style="white-space:nowrap">用户名称</th><th style="text-align:center">关联客户</th><th style="text-align:center">用户宽度</th><th style="text-align:center">最大宽度</th><th>已有产品</th></tr></thead><tbody>';
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
  App.addLog('数据导出', '数据总览', '打印/导出总览PDF');
};

// ===== 通用导出 PDF =====
App.exportPDF = function() {
  window.print();
  App.addLog('数据导出', 'PDF打印', '打印当前页面');
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
  App.BUSINESS_DEPTS.forEach(function(d) { rows.push([d.n, d.ld, d.aw, d.cw, d.cov + '%']); });
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
  App.addLog('数据导出', '数据总览', '导出总览数据CSV');
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
  App.addLog('数据导出', '数据导出', '导出数据CSV: ' + (pageId||''));
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
// ===== 产品宽度-团队维度 数据明细 颗粒度约束 =====
// 核心规则：颗粒度切换不能突破顶部筛选划定的数据边界
App.getAvailableWidthDims = function() {
  var state = App.getFilterState('page-width');
  if (state.person !== 'all') return ['person'];
  if (state.group !== 'all') return ['group', 'person'];
  return ['dept', 'group', 'person'];
};

App.updateWidthDimButtons = function() {
  var available = App.getAvailableWidthDims();
  var current = App.WidthDetail.dim || 'dept';

  // 如果当前粒度在筛选缩窄后不可用，自动降级到最细可用粒度
  if (available.indexOf(current) === -1) {
    App.WidthDetail.dim = available[available.length - 1];
    App.WidthDetail.page = 1;
  }

  // 更新按钮显示/隐藏 + 激活状态
  var allDims = ['dept', 'group', 'person'];
  allDims.forEach(function(dim) {
    var btn = document.querySelector('#page-width [data-d="' + dim + '"]');
    if (!btn) return;
    if (available.indexOf(dim) === -1) {
      btn.style.display = 'none';
      btn.classList.remove('active');
    } else {
      btn.style.display = '';
      btn.classList.toggle('active', dim === App.WidthDetail.dim);
    }
  });
};

App.WidthDetail = {
  dim: 'dept',
  page: 1,
  PAGE_SIZE: 20,

  // 切换维度 tab
  switchDim: function(d) {
    var available = App.getAvailableWidthDims();
    // 请求的粒度不在可用范围内，静默忽略
    if (available.indexOf(d) === -1) return;

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
    var modalBox = document.getElementById('appModalBox');
    if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }
    var raw = App.WidthDetail.getFilteredRaw();
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
      bodyHtml += '<table class="modal-table" style="table-layout:auto;margin-bottom:14px"><thead><tr><th>销售</th><th>' + label + '客户数</th><th>平均宽度</th></tr></thead><tbody>';
      accRows.forEach(function(a) {
        var avgW = (a.rows.reduce(function(s, r) { return s + r.width; }, 0) / a.rows.length).toFixed(1);
        var accDispName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(a.account) : a.account;
        bodyHtml += '<tr><td><strong>' + App.escapeHtml(accDispName) + '</strong></td><td>' + a.rows.length + '</td><td class="avg-num">' + avgW + '</td></tr>';
      });
      bodyHtml += '</tbody></table></div>';
    }

    // 客户明细表（全部产品列）
    bodyHtml += '<div style="margin-bottom:8px;font-size:12px;color:#6b7280">📋 客户明细（共 ' + filtered.length + ' 条）</div>';
    bodyHtml += '<table class="modal-table" style="table-layout:auto"><thead><tr><th style="white-space:nowrap">团队</th><th style="white-space:nowrap">销售</th><th style="white-space:nowrap">最终用户</th><th>产品宽度</th>';
    products.forEach(function(p) {
      bodyHtml += '<th title="' + p + '">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 200;
    filtered.slice(0, maxRows).forEach(function(r) {
      bodyHtml += '<tr>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(r.account || '') + '</td>';
      bodyHtml += '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.user || '') + '</td>';
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
    var modalBox = document.getElementById('appModalBox');
    if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }
    var raw = App.WidthDetail.getFilteredRaw();
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
      bodyHtml += '<table class="modal-table" style="table-layout:auto;margin-bottom:14px"><thead><tr><th>销售</th><th>客户数</th><th>平均宽度</th><th>规上</th><th>非规上</th></tr></thead><tbody>';
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
    bodyHtml += '<div style="overflow-x:auto;max-width:100%"><table class="modal-table" style="table-layout:auto"><thead><tr><th style="white-space:nowrap">团队</th><th style="white-space:nowrap">销售</th><th style="white-space:nowrap">最终用户</th><th>产品宽度</th><th>规上</th>';
    products.forEach(function(p) {
      bodyHtml += '<th title="' + p + '">' + App.WidthDetail.productLabel(p) + '</th>';
    });
    bodyHtml += '</tr></thead><tbody>';
    var maxRows = 200;
    filtered.slice(0, maxRows).forEach(function(r) {
      var displayName = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(r.account) : r.account;
      bodyHtml += '<tr>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(r.team || '') + '</td>';
      bodyHtml += '<td style="white-space:nowrap">' + App.escapeHtml(displayName) + '</td>';
      bodyHtml += '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.user || '') + '</td>';
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
    // 筛选变更后自动联动颗粒度按钮 + 清除聚合缓存
    App.updateWidthDimButtons();
    App.WidthDetail.clearCache();
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

  // ── 按页级筛选过滤后的 RAW 数据（数据隔离的核心）──
  getFilteredRaw: function() {
    var raw = (App.WidthCustomer.RAW_MERGED || App.WidthCustomer.RAW || []).slice();
    var pageState = App.getFilterState ? App.getFilterState('page-width') : { team: 'all', group: 'all', person: 'all' };
    // 月份筛选（优先 — 限定数据快照范围）
    var periodSel = document.getElementById('wImportPeriodFilter');
    var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
    if (periodFilter) {
      raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    }
    // 三级级联：人员 > 组 > 部门
    if (pageState.person !== 'all') {
      raw = raw.filter(function(r) { return r.account === pageState.person; });
    } else if (pageState.group !== 'all') {
      raw = raw.filter(function(r) { return r.team === pageState.group; });
    } else if (pageState.team !== 'all') {
      var deptGroups = App.GROUPS.filter(function(g) { return g.dept === pageState.team; }).map(function(g) { return g.n; });
      raw = raw.filter(function(r) {
        if (deptGroups.indexOf(r.team) >= 0) return true;          // 组名匹配
        if (r.team === pageState.team) return true;                 // team=部门名(无组部门)
        var gi = App.GROUPS.find(function(g){return g.n===r.team;}); // GROUPS查归属
        return gi && gi.dept === pageState.team;
      });
    }
    return raw;
  },

  aggregateByTeam: function() {
    var raw = App.WidthDetail.getFilteredRaw();
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
    App.BUSINESS_DEPTS.forEach(function(deptInfo) {
      var dn = deptInfo.n;
      seenDepts[dn] = true;
      var teams = deptTeamMap[dn] || [];

      // 汇总该部门所有团队的原始数据行
      var allRows = [];
      var deptRaw = App.WidthDetail.getFilteredRaw();
      teams.forEach(function(t) {
        var rows = deptRaw.filter(function(r) { return r.team === t.n; });
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
        var deptRaw2 = App.WidthDetail.getFilteredRaw();
        teams.forEach(function(t) {
          var rows = deptRaw2.filter(function(r) { return r.team === t.n; });
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
    var raw = App.WidthDetail.getFilteredRaw();
    var products = App.WidthDetail.PRODUCTS;
    var accMap = {};
    raw.forEach(function(r) {
      var a = r.account || '(未填写)';
      if (!accMap[a]) accMap[a] = { rows: [], team: r.team };
      accMap[a].rows.push(r);
    });
    var result = [];
    var seenDisplayNames = {};  // 记录已有数据的中文名
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
      var dn = App.WidthCustomer.getDisplayName ? App.WidthCustomer.getDisplayName(acc) : acc;
      seenDisplayNames[dn] = true;
      result.push({
        n: acc, displayName: dn, team: am.team, type: 'person',
        cw: rows.length, aw: avgW, mw: maxW, gs: gs, ngs: ngs,
        cov: products.length > 0 ? (prodCnt.filter(function(c) { return c > 0; }).length / products.length * 100) : 0,
        prodCnt: prodCnt,
        yoy: '0%'
      });
    });

    // 补充无数据人员：筛选缩窄后，确保范围内所有人员都展示（数据为空）
    var pageState = App.getFilterState ? App.getFilterState('page-width') : { team: 'all', group: 'all', person: 'all' };
    var isNarrowed = pageState.team !== 'all' || pageState.group !== 'all' || pageState.person !== 'all';
    if (isNarrowed) {
      var zeroProds = products.map(function() { return 0; });
      App.PERSONS.forEach(function(p) {
        // 检查是否在当前筛选范围内
        if (pageState.person !== 'all' && p.n !== pageState.person) return;
        if (pageState.group !== 'all' && p.grp !== pageState.group) return;
        if (pageState.team !== 'all' && p.dept !== pageState.team) return;
        // 已有数据的跳过
        if (seenDisplayNames[p.n]) return;
        seenDisplayNames[p.n] = true;
        // 添加空数据条目
        result.push({
          n: p.n, displayName: p.n, team: p.grp !== '-' ? p.grp : p.dept, type: 'person',
          cw: 0, aw: 0, mw: 0, gs: 0, ngs: 0,
          cov: 0, prodCnt: zeroProds.slice(),
          yoy: '-'
        });
      });
    }

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

  // 月份筛选
  var periodSel = document.getElementById('wImportPeriodFilter');
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  if (periodFilter) {
    data = data.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }

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
  var available = App.getAvailableTeamDims();
  if (available.indexOf(dim) === -1) return;
  App.WidthTeamMatrix._dim = dim;
  var btns = document.querySelectorAll('#p-cross-dim-btns .dim-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  App.WidthTeamMatrix.render();
};

// ===== 团队维度颗粒度约束（差距看板/增长结构/覆盖排名/本期vs同期共用） =====
App.getAvailableTeamDims = function() {
  var state = App.getFilterState('page-potential');
  if (state.person !== 'all') return ['person'];
  if (state.group !== 'all') return ['group', 'person'];
  return ['dept', 'group', 'person'];
};

// 获取有效小组列表（含无小组的部门作为虚拟小组）
App.getEffectiveGroups = function(deptFilter) {
  var groups = App.GROUPS.slice().map(function(g) { return Object.assign({}, g, { _virtual: false }); });
  App.BUSINESS_DEPTS.forEach(function(d) {
    if (deptFilter && deptFilter !== 'all' && d.n !== deptFilter) return;
    var hasGroup = App.GROUPS.some(function(g) { return g.dept === d.n; });
    if (!hasGroup) {
      groups.push({ n: d.n, dept: d.n, ld: d.ld, cw: d.cw, cov: d.cov, yoy: d.yoy, _virtual: true });
    }
  });
  return groups;
};

// 确保当前 dim 在可用范围内；不可用时自动降级
App.ensureValidTeamDim = function(currentDim) {
  var available = App.getAvailableTeamDims();
  if (available.indexOf(currentDim) === -1) {
    return available[available.length - 1];
  }
  return currentDim;
};

// 更新团队维度四个模块的颗粒度按钮可见性
App.updateTeamDimButtons = function() {
  var available = App.getAvailableTeamDims();
  var allDims = ['dept', 'group', 'person'];
  // 四个模块的按钮容器
  var containers = ['#p-scorecard-dim-btns', '#p-growth-dim-btns', '#p-seller-dim-btns', '#p-cross-dim-btns'];
  containers.forEach(function(sel) {
    allDims.forEach(function(dim) {
      var btn = document.querySelector(sel + ' .dim-btn[data-dim="' + dim + '"]');
      if (!btn) return;
      if (available.indexOf(dim) === -1) {
        btn.style.display = 'none';
        btn.classList.remove('active');
      } else {
        btn.style.display = '';
      }
    });
  });
};
// 返回 { dept: { sales, prev, products:{}, custSet:{} }, group: ..., person: ... }
App.aggregateTeamSales = function() {
  var fCust = App.getFilteredPotData('cust');
  var result = { dept: {}, group: {}, person: {} };
  var allProds = {};
  fCust.forEach(function(r) {
    var p = r.product || '';
    if (p) allProds[p] = true;
    var amt = r.amount || 0;
    var prev = r.amountPrev || 0;
    // 部门级
    var dept = r.dept3 || r.dept4 || '';
    if (dept) {
      if (!result.dept[dept]) result.dept[dept] = { sales: 0, prev: 0, prods: {}, custSet: {} };
      var dd = result.dept[dept];
      dd.sales += amt; dd.prev += prev;
      if (p) dd.prods[p] = (dd.prods[p] || 0) + amt;
      if (r.custName) dd.custSet[r.custName] = true;
    }
    // 组级（无小组的部门用部门名作为组键）
    var grp = r.dept5 || r.dept4 || '';
    if (!grp) grp = dept;
    if (grp) {
      if (!result.group[grp]) result.group[grp] = { sales: 0, prev: 0, prods: {}, custSet: {}, dept: dept };
      var dg = result.group[grp];
      dg.sales += amt; dg.prev += prev;
      if (p) dg.prods[p] = (dg.prods[p] || 0) + amt;
      if (r.custName) dg.custSet[r.custName] = true;
    }
    // 个人级
    var person = r.sales || '';
    if (person && person !== '(未填写)') {
      if (!result.person[person]) result.person[person] = { sales: 0, prev: 0, prods: {}, custSet: {}, dept: dept, grp: grp };
      var dp = result.person[person];
      dp.sales += amt; dp.prev += prev;
      if (p) dp.prods[p] = (dp.prods[p] || 0) + amt;
      if (r.custName) dp.custSet[r.custName] = true;
    }
  });
  result._allProds = Object.keys(allProds).sort();
  result._hasData = fCust.length > 0;
  return result;
};

App.WidthTeamMatrix.render = function() {
  var thead = document.getElementById('p-team-cross-thead');
  var tbody = document.getElementById('p-team-cross-tbody');
  if (!thead || !tbody) return;

  var state = App.getFilterState('page-potential');
  var team = state.team, group = state.group, person = state.person;
  var dim = App.WidthTeamMatrix._dim || 'group';
  var prods = App.WidthTeamMatrix.PRODUCTS;
  // 优先 WidthTeamMatrix.RAW，为空时从 getFilteredPotData 重新聚合
  var raw = (App.WidthTeamMatrix.RAW || []).slice();
  if (raw.length === 0) {
    var fCustTM = App.getFilteredPotData('cust');
    fCustTM.forEach(function(r) {
      var tm = r.dept5 || r.dept4 || r.dept3 || '';
      if (tm) raw.push({ team: tm, product: r.product || '', amount: r.amount || 0, amountPrev: r.amountPrev || 0, snapshotPeriod: r.snapshotPeriod || '' });
    });
    // 从用户数据补充
    var fUserTM = App.getFilteredPotData('user');
    fUserTM.forEach(function(r) {
      var tm = r.dept5 || r.dept4 || r.dept3 || '';
      if (tm) {
        var existing = raw.find(function(x) { return x.team === tm && x.product === r.product; });
        if (existing) { existing.amount += (r.outAmt || 0); existing.amountPrev += (r.outAmtPrev || 0); }
        else raw.push({ team: tm, product: r.product || '', amount: r.outAmt || 0, amountPrev: r.outAmtPrev || 0, snapshotPeriod: r.snapshotPeriod || '' });
      }
    });
  }

  // 月份筛选
  var periodSelTM = document.getElementById('pImportPeriodFilter');
  var periodFilterTM = periodSelTM ? (periodSelTM.value && periodSelTM.value !== 'all' && periodSelTM.value !== '无数据' ? periodSelTM.value : '') : '';
  if (periodFilterTM) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilterTM; });

  // 确保当前维度在筛选范围内有效（不可用时自动降级，不强制覆盖用户选择）
  dim = App.ensureValidTeamDim(dim);
  App.WidthTeamMatrix._dim = dim;
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
    // 兼容：team 可能直接是部门名而不是小组名
    if (!deptName && App.BUSINESS_DEPTS.some(function(dd) { return dd.n === grpName; })) {
      deptName = grpName;
    }

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
    App.BUSINESS_DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      agg[d.n] = { label: d.n, dept: d.n, grp: '', totalCur: 0, totalPrev: 0, prods: {} };
    });
  } else if (dim === 'group') {
    App.getEffectiveGroups(team).forEach(function(g) {
      if (team !== 'all' && g.dept !== team && g.n !== team) return;
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

  // ── 排序：按 App.BUSINESS_DEPTS / App.GROUPS 顺序 ──
  var deptOrder = App.BUSINESS_DEPTS.map(function(d) { return d.n; });
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
        display = '<strong>' + v.amount.toFixed(2) + '</strong><br>' + yoyStr;
      } else if (v.amount > 0 && v.amountPrev === 0) {
        cls = 'cell-new'; display = '<strong>' + v.amount.toFixed(2) + '</strong><br><span class="c-yoy c-yoy-new">+新增</span>';
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
      '<td><strong>' + rowCur.toFixed(2) + '</strong></td><td>' + rowPrev.toFixed(2) + '</td>' +
      '<td class="' + rowCls + '"><strong>' + (rowYoy >= 0 ? '+' : '') + rowYoy.toFixed(1) + '%</strong></td></tr>';
  });

  // 总计行
  var grandYoy = grandPrev > 0 ? ((grandCur - grandPrev) / grandPrev * 100) : (grandCur > 0 ? 100 : 0);
  var totalPreCols = '';
  if (showDept || showGrp || dim === 'person') totalPreCols = '<td' + (showDept || showGrp ? ' colspan="' + ((showDept?1:0)+(showGrp?1:0)+(dim==='person'?1:0)) + '"' : '') + '><strong>总计</strong></td>';
  bodyHtml += '<tr class="total-row">' + totalPreCols +
    prods.map(function(p) {
      var v = rows.filter(function(d) { return d.product === p; }).reduce(function(s, d) { return s + d.amount; }, 0);
      return '<td><strong>' + v.toFixed(2) + '</strong></td>';
    }).join('') +
    '<td><strong>' + grandCur.toFixed(2) + '</strong></td><td><strong>' + grandPrev.toFixed(2) + '</strong></td>' +
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
  // 数据源：仅用户维度 RAW（UserGS），含月份+三级筛选
  var raw = (App.WidthUser.RAW || []).slice();
  // 月份筛选
  var periodSel = document.getElementById('wImportPeriodFilter');
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  if (periodFilter) {
    raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  // 页级筛选：人员 > 组 > 部门
  var pageState = App.getFilterState('page-width');
  if (pageState.person !== 'all') {
    raw = raw.filter(function(r) { return r.account === pageState.person; });
  } else if (pageState.group !== 'all') {
    raw = raw.filter(function(r) { return r.team === pageState.group; });
  } else if (pageState.team !== 'all') {
    var deptGroups = App.GROUPS.filter(function(g) { return g.dept === pageState.team; }).map(function(g) { return g.n; });
    raw = raw.filter(function(r) { return deptGroups.indexOf(r.team) >= 0; });
  }
  var data = raw;

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


// ===== 潜力产品 — 总览分析：经营概述（从导入数据动态计算） =====
App.renderPotentialOverview = function(state) {
  state = state || { team: 'all', group: 'all', person: 'all' };

  // ── 核心规则：KPI 数据必须遵循筛选边界（部门→小组→个人） ──
  // 统一使用 getFilteredPotData 获取筛选后的数据，不再使用 getPotential(team) 的宽松过滤
  var fCust = App.getFilteredPotData('cust');
  var fUser = App.getFilteredPotData('user');

  // 总销售额 & 同期销售额（从客户数据按金额汇总）
  var totalAmt = 0, totalPrev = 0;
  fCust.forEach(function(r) { totalAmt += (r.amount || 0); totalPrev += (r.amountPrev || 0); });

  // 潜力产品数（去重）
  var prodSet = {};
  fCust.forEach(function(r) { if (r.product) prodSet[r.product] = true; });
  fUser.forEach(function(r) { if (r.product) prodSet[r.product] = true; });
  var prodCount = Object.keys(prodSet).length;

  // 客户数（去重）
  var custSet = {};
  fCust.forEach(function(r) { if (r.custName) custSet[r.custName] = true; });
  var custCount = Object.keys(custSet).length;

  // 客单价
  var avgPrice = custCount > 0 ? totalAmt / custCount : 0;

  // 用户数（去重）
  var userSet = {};
  fUser.forEach(function(r) { if (r.userName) userSet[r.userName] = true; });
  var userCount = Object.keys(userSet).length;

  // 同比变化率
  var yoyPct = totalPrev > 0 ? ((totalAmt - totalPrev) / totalPrev * 100) : 0;

  // ── 更新 5 个 KPI 卡片 ──
  App.setText('p-kpi-sales',        '¥ ' + totalAmt.toFixed(2) + '万');
  App.setText('p-kpi-sales-prev',   totalPrev.toFixed(2) + '万');
  App.setText('p-kpi-prodcount',    prodCount);
  App.setText('p-kpi-custcount',    custCount);
  App.setText('p-kpi-avgprice',     avgPrice.toFixed(2));
  App.setText('p-kpi-usercount',    userCount);
  App.setText('p-kpi-usercount-prev', '-');

  // 同步更新 KPI 副标题中的同比信息
  var yoyEl = document.getElementById('p-kpi-sales-yoy');
  if (!yoyEl) {
    var salesSub = document.querySelector('#p-kpi-sales') && document.querySelector('#p-kpi-sales').parentNode.querySelector('.kpi-sub');
    if (salesSub) {
      var span = document.createElement('span');
      span.id = 'p-kpi-sales-yoy';
      span.style.cssText = 'margin-left:4px;font-weight:600';
      salesSub.appendChild(span);
    }
  }
  var yoyEl2 = document.getElementById('p-kpi-sales-yoy');
  if (yoyEl2) {
    yoyEl2.textContent = (yoyPct >= 0 ? '↑' : '↓') + Math.abs(yoyPct).toFixed(1) + '%';
    yoyEl2.style.color = yoyPct >= 0 ? '#16a34a' : '#dc2626';
  }
};

// 产品风险分布 & 团队概况（p-team，从导入数据动态计算）
App.renderTeamRiskPanel = function(state) {
  var el = document.getElementById('pTeamRiskPanel');
  if (!el) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var dataTeam = state.team !== 'all' ? state.team : 'all';
  var data = App.Data.getPotential(dataTeam);
  var deptRank = data ? data.deptRank : [];
  var top10 = data ? data.top10 : [];
  // 根据筛选缩小部门范围
  if (state.team !== 'all') {
    deptRank = deptRank.filter(function(d) { return d.dept === state.team || d.dept.indexOf(state.team) >= 0; });
  }
  var deptCount = deptRank.length || 0;
  // 统计有实际数据的团队数
  var teamSet = {};
  if (data && data.overview) teamSet['_'] = true;
  var totalTeams = Object.keys(teamSet).length || deptCount;

  // 从 top10 中提取同比下降产品作为风险清单
  var riskProducts = top10.filter(function(p) {
    var yv = parseFloat(p.yoy) || 0;
    return yv < 0;
  }).sort(function(a, b) { return (parseFloat(a.yoy) || 0) - (parseFloat(b.yoy) || 0); });

  var hiRisk = riskProducts.filter(function(p) { return (parseFloat(p.yoy) || 0) < -15; }).length;
  var mdRisk = riskProducts.filter(function(p) { var y = parseFloat(p.yoy) || 0; return y < -5 && y >= -15; }).length;
  var loRisk = riskProducts.filter(function(p) { var y = parseFloat(p.yoy) || 0; return y < 0 && y >= -5; }).length;

  function riskLevel(yoy) {
    if (yoy < -15) return { label: '高风险', cls: 'bg-red' };
    if (yoy < -5)  return { label: '中风险', cls: 'bg-amber' };
    return { label: '低风险', cls: 'bg-green' };
  }

  var riskRows = '';
  riskProducts.forEach(function(p) {
    var yv = parseFloat(p.yoy) || 0;
    var rl = riskLevel(yv);
    var suggestion = yv < -15 ? 'TOP10客户专项突破，联动打包' : (yv < -5 ? '与技术中心联动挖掘新场景' : '持续关注，暂不需要干预');
    riskRows += '<tr>' +
      '<td><strong>' + App.escapeHtml(p.product) + '</strong></td>' +
      '<td style="text-align:center;color:#dc2626;font-weight:700">' + yv.toFixed(1) + '%</td>' +
      '<td style="text-align:center"><span class="badge ' + rl.cls + '">' + rl.label + '</span></td>' +
      '<td style="font-size:11px;color:#6b7280">待分析</td>' +
      '<td style="font-size:11px">' + suggestion + '</td></tr>';
  });

  el.innerHTML =
    '<div class="stat-grid col3" style="margin-bottom:12px">' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">二级部门</div><div style="font-size:22px;font-weight:700;color:#1a56db;margin-top:4px">' + deptCount + '</div><div class="s-sub">个部门</div></div>' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">潜力产品</div><div style="font-size:22px;font-weight:700;color:#16a34a;margin-top:4px">' + top10.length + '</div><div class="s-sub">个产品</div></div>' +
      '<div class="stat-card" style="padding:12px 16px"><div class="s-label">产品风险分布</div><div style="display:flex;gap:8px;margin-top:6px"><span class="badge bg-red">高风险 ' + hiRisk + '</span><span class="badge bg-amber">中风险 ' + mdRisk + '</span><span class="badge bg-green">低风险 ' + loRisk + '</span></div><div class="s-sub">共 ' + riskProducts.length + ' 个退化产品</div></div>' +
    '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>退化产品</th><th style="text-align:center;width:80px">同比跌幅</th><th style="text-align:center;width:80px">风险等级</th><th>主要影响团队</th><th>建议措施</th></tr></thead><tbody>' +
    (riskRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px">✅ 当前无同比下降产品</td></tr>') +
    '</tbody></table></div>';
};
// ===== 潜力产品覆盖排名（部门/组/个人维度 + 分页） =====
App._sellerDim = 'person';
App._sellerPage = 1;
App._sellerPageSize = 20;

App.setSellerDim = function(dim) {
  var available = App.getAvailableTeamDims();
  if (available.indexOf(dim) === -1) return;
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

  dim = App.ensureValidTeamDim(dim);
  App._sellerDim = dim;
  ['#p-seller-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });
  App.setText('p-seller-scope-tag', '按' + (dim==='dept'?'部门':dim==='group'?'小组':'个人'));

  var showDept = (group === 'all' && person === 'all');
  var showGrp  = (dim === 'group' || dim === 'person');
  var totalProds = App.ALL_POT_PRODUCTS.length;

  // ── 从导入数据聚合（优先真实数据）──
  var agg3 = App.aggregateTeamSales();
  var allProdList = agg3._allProds.length > 0 ? agg3._allProds : App.ALL_POT_PRODUCTS;
  var totalProds = allProdList.length;

  var rows = [];
  if (dim === 'dept') {
    App.BUSINESS_DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var rd = agg3.dept[d.n] || { sales: 0, prev: 0, prods: {} };
      var covered = Object.keys(rd.prods).length;
      rows.push({ dept: d.n, grp: '', name: '', cw: Object.keys(rd.prods).length, sales: rd.sales, prev: rd.prev,
        yoy: rd.prev > 0 ? ((rd.sales - rd.prev) / rd.prev * 100) : (rd.sales > 0 ? 100 : 0),
        covered: covered, prodsInfo: rd.prods });
    });
  } else if (dim === 'group') {
    App.getEffectiveGroups(team).forEach(function(g) {
      if (team !== 'all' && g.dept !== team && g.n !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var rg = agg3.group[g.n] || { sales: 0, prev: 0, prods: {}, dept: g.dept };
      var covered = Object.keys(rg.prods).length;
      rows.push({ dept: g.dept, grp: g.n, name: '', cw: Object.keys(rg.prods).length, sales: rg.sales, prev: rg.prev,
        yoy: rg.prev > 0 ? ((rg.sales - rg.prev) / rg.prev * 100) : (rg.sales > 0 ? 100 : 0),
        covered: covered, prodsInfo: rg.prods });
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var rp = agg3.person[p.n] || { sales: 0, prev: 0, prods: {}, dept: p.dept, grp: p.grp };
      var covered = Object.keys(rp.prods).length;
      rows.push({ dept: p.dept || '-', grp: p.grp || '-', name: p.n, cw: Object.keys(rp.prods).length, sales: rp.sales, prev: rp.prev,
        yoy: rp.prev > 0 ? ((rp.sales - rp.prev) / rp.prev * 100) : (rp.sales > 0 ? 100 : 0),
        covered: covered, prodsInfo: rp.prods });
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
    var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : 'App.showPersonDrillModal');
    var clickHandler = 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"';
    var cells = '';
    if (showDept) cells += '<td style="color:#1a56db;font-weight:600">' + r.dept + '</td>';
    if (showGrp) cells += '<td style="font-weight:600;color:#1a56db">' + r.grp + '</td>';
    if (dim === 'person') cells += '<td>' + r.name + '</td>';

    // 覆盖/未覆盖产品标签（基于真实导入数据）
    var allProdsForChips = allProdList.length > 0 ? allProdList : App.ALL_POT_PRODUCTS;
    var coveredProds = [], uncoveredProds = [];
    var prodsInfo = r.prodsInfo || {};
    allProdsForChips.forEach(function(p) {
      if (prodsInfo[p] && prodsInfo[p] > 0) coveredProds.push(p);
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



// ===== 后端 API 通信层 — 数据导入到后端数据库 =====
App.API = App.API || {};
App.API.BASE = '/api/import';

// 产品宽度数据 → 后端
App.API.sendWidth = async function(rows, type) {
  var resp = await fetch(App.API.BASE + '/width-records', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({rows: rows, type: type})
  });
  if (!resp.ok) {
    var text = await resp.text();
    try { var e = JSON.parse(text); throw new Error(e.detail || '导入失败'); } catch(ex) { throw new Error(text.slice(0, 200) || '导入失败 (' + resp.status + ')'); }
  }
  return resp.json();
};

// 潜力产品-客户 → 后端
App.API.sendPotCust = async function(rows) {
  var resp = await fetch(App.API.BASE + '/potential-cust', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({rows: rows})
  });
  if (!resp.ok) {
    var text = await resp.text();
    try { var e = JSON.parse(text); throw new Error(e.detail || '导入失败'); } catch(ex) { throw new Error(text.slice(0, 200) || '导入失败 (' + resp.status + ')'); }
  }
  return resp.json();
};

// 潜力产品-用户 → 后端
App.API.sendPotUser = async function(rows) {
  var resp = await fetch(App.API.BASE + '/potential-user', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({rows: rows})
  });
  if (!resp.ok) {
    var text = await resp.text();
    try { var e = JSON.parse(text); throw new Error(e.detail || '导入失败'); } catch(ex) { throw new Error(text.slice(0, 200) || '导入失败 (' + resp.status + ')'); }
  }
  return resp.json();
};

// ===== 潜力产品 — 数据导入与管理 =====
App.ImportPotential = App.ImportPotential || {};

App.ImportPotential.persist = function() {
  // localStorage 持久化（后端不可用时的兜底方案）
  try {
    localStorage.setItem('pa_potential_cust', JSON.stringify(App.ImportPotential.CustRAW || []));
    localStorage.setItem('pa_potential_user', JSON.stringify(App.ImportPotential.UserRAW || []));
  } catch(e) {}
};

App.ImportPotential.init = function() {
  // 月份选择器上限设为当前月
  var snapInput = document.getElementById('pSnapshotPeriod');
  if (snapInput) {
    var now = new Date();
    snapInput.max = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    if (!snapInput.value) snapInput.value = snapInput.max;
  }
  // 先从 localStorage 恢复历史元数据（不含数据快照）
  try {
    var sh = localStorage.getItem('pa_p_history');
    if (sh) App.ImportPotential.history = JSON.parse(sh);
  } catch(e) { App.ImportPotential.history = []; }

  // 优先从 localStorage 恢复数据（后端不可用时的兜底）
  try {
    var savedCust = localStorage.getItem('pa_potential_cust');
    if (savedCust) App.ImportPotential.CustRAW = JSON.parse(savedCust);
    var savedUser = localStorage.getItem('pa_potential_user');
    if (savedUser) App.ImportPotential.UserRAW = JSON.parse(savedUser);
  } catch(e) {}

  // 从后端 API 拉取已导入数据（会覆盖 localStorage 的数据）
  fetch('/api/import/potential-cust').then(function(r){return r.json();}).then(function(d){
    if (d.rows && d.rows.length > 0) { App.ImportPotential.CustRAW = d.rows; App.ImportPotential.persist(); }
  }).catch(function(){}).finally(function(){
    return fetch('/api/import/potential-user').then(function(r){return r.json();}).then(function(d){
      if (d.rows && d.rows.length > 0) { App.ImportPotential.UserRAW = d.rows; App.ImportPotential.persist(); }
    }).catch(function(){});
  }).finally(function(){
    var deptSel = document.getElementById('pImportDeptFilter');
    if (deptSel) {
      var depts = App.ImportPotential.getDepts();
      deptSel.innerHTML = '<option value=\"\">全部部门</option>' + depts.map(function(d) { return '<option value=\"' + d + '\">' + d + '</option>'; }).join('');
    }
    var prodSel = document.getElementById('pImportProdFilter');
    if (prodSel) {
      var prods = App.ImportPotential.getProducts();
      prodSel.innerHTML = '<option value=\"\">全部产品</option>' + prods.map(function(p) { return '<option value=\"' + p + '\">' + p + '</option>'; }).join('');
    }
    App.ImportPotential.render();
    App.ImportPotential.renderHistory();
    try { App.Data.rebuildDerived(); } catch(e) {}
  });
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

// 通用：按表头名称建立列索引映射（支持全角/半角括号）
App.ImportPotential._buildColMap = function(headers, mapping) {
  var norm = function(s) { return s.replace(/（/g,'(').replace(/）/g,')').replace(/：/g,':').replace(/，/g,',').replace(/\s+/g,'').trim(); };
  var cm = {};
  headers.forEach(function(h, i) {
    var raw = String(h||'').trim();
    var key = mapping[raw] || mapping[norm(raw)];
    if (key) cm[key] = i;
  });
  return cm;
};

// 客户sheet表头映射
App.ImportPotential.CUST_MAP = {
  '二级部门':'dept2','业务中心':'dept2',
  '三级部门':'dept3','大部门':'dept3',
  '四级部门':'dept4','团队小组':'dept4',
  '五级部门':'dept5',
  '销售雇员':'sales','负责销售':'sales','销售人员':'sales',
  '对接人':'contact',
  '潜力产品':'product',
  '售达方名称':'custName','售达方':'custName','售达方描述':'custName',
  '最终用户':'userName','最终用户名称':'userName',
  '销售额(万)':'amount','销售额（万）':'amount',
  '同期销售额(万)':'amountPrev','同期销售额（万）':'amountPrev',
  '同比':'yoy',
  '销售数量':'qty','同期销售数量':'qtyPrev','销售数量同比':'qtyYoy',
  '交易商机数':'opps','交易商机数同期':'oppsPrev','交易商机数同比':'oppsYoy',
  '交易用户数':'users','交易用户数-同期':'usersPrev','用户数同比':'usersYoy'
};

// 用户sheet表头映射
App.ImportPotential.USER_MAP = {
  '业务中心':'center',
  '部门':'dept3','大部门':'dept3',
  '团队小组':'dept4',
  '负责销售':'sales','销售雇员':'sales',
  '对接人':'contact',
  '最终用户名称':'userName','最终用户描述':'userName','最终用户':'userName',
  '行业':'industry',
  '潜力产品':'product',
  '产品出库额':'outAmt','产品出库额同期':'outAmtPrev','产品出库额同比':'outYoy',
  '出库数量':'outQty','出库数量同期':'outQtyPrev','出库数量同比':'outQtyYoy',
  '销售数量':'outQty','销售数量同期':'outQtyPrev','销售数量同比':'outQtyYoy',
  '交易商机数':'opps','交易商机数同期':'oppsPrev','交易商机数同比':'oppsYoy',
  '交易用户数':'users','交易用户数同期':'usersPrev','交易用户数同比':'usersYoy',
  '交易客户数':'custs','交易客户数同期':'custsPrev','交易客户数同比':'custsYoy'
};

// 文件上传处理（按表头名称匹配，兼容任意列顺序）
App.ImportPotential.handleUpload = function(input) {
  var file = input.files[0];
  if (!file) return;
  // 确保月份已设置，弹窗确认
  var snapInput = document.getElementById('pSnapshotPeriod');
  if (snapInput && !snapInput.value) {
    var now = new Date();
    snapInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  var snapVal = snapInput ? snapInput.value : '';
  // 重置 input 以便同一文件可再次触发 onchange
  input.value = '';
  if (!confirm('数据月份：' + (snapVal || '未设置') + '\n\n确定导入「' + file.name + '」吗？\n\n如需修改月份，请点击"取消"后在页面上修改。')) return;
  console.log('[潜力导入] 开始解析:', file.name);
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      console.log('[潜力导入] Sheets:', wb.SheetNames.join(', '));
      var custSheet = wb.SheetNames.find(function(n) { return n.indexOf('客户') >= 0; });
      var userSheet = wb.SheetNames.find(function(n) { return n.indexOf('用户') >= 0; });
      console.log('[潜力导入] 客户sheet:', custSheet || '未找到', '用户sheet:', userSheet || '未找到');

      if (custSheet) {
        var custData = XLSX.utils.sheet_to_json(wb.Sheets[custSheet], { header: 1, defval: null });
        console.log('[潜力导入] 客户sheet行数:', custData.length, '表头:', custData[0]);
        var newCustRows = [];
        if (custData.length > 1) {
          var cm = App.ImportPotential._buildColMap(custData[0], App.ImportPotential.CUST_MAP);
          console.log('[潜力导入] 客户列映射:', JSON.stringify(cm));
          newCustRows = custData.slice(1).filter(function(r) { return r && r.length > 3; }).map(function(r) {
            var p = String(r[cm.product]||'').trim();
            var d3 = String(r[cm.dept3]||''), d4 = String(r[cm.dept4]||''), d5 = String(r[cm.dept5]||'');
            // 自动向上填充：五级为空/未匹配→取四级，四级为空/未匹配→取三级，三级为空/未匹配→取二级
            var isEmpty = function(v) { return !v || v === '未分配' || v === '未匹配'; };
            if (isEmpty(d3)) d3 = String(r[cm.dept2]||'');
            if (isEmpty(d4)) d4 = d3;
            if (isEmpty(d5)) d5 = d4;
            // 特殊销售人员五级部门映射
            var salesName = String(r[cm.sales]||'').trim();
            var SPECIAL_DEPT5 = {
              '高巍10': '客户销售三组',
              '吴正豪': '客户销售六组',
              '房伟建': '公安交警行业组',
              '段金君': '小微客户',
              '陈志杰8': '综合销售'
            };
            if (SPECIAL_DEPT5[salesName]) d5 = SPECIAL_DEPT5[salesName];
            return {
              dept2: String(r[cm.dept2]||''), dept3: d3, dept4: d4, dept5: d5,
              sales: String(r[cm.sales]||''), contact: String(r[cm.contact]||''), product: p, custName: String(r[cm.custName]||''), userName: String(r[cm.userName]||''),
              amount: parseFloat(r[cm.amount])||0, amountPrev: parseFloat(r[cm.amountPrev])||0, yoy: r[cm.yoy]||'',
              qty: parseInt(r[cm.qty])||0, qtyPrev: parseInt(r[cm.qtyPrev])||0, qtyYoy: r[cm.qtyYoy]||'',
              opps: parseInt(r[cm.opps])||0, oppsPrev: parseInt(r[cm.oppsPrev])||0, oppsYoy: r[cm.oppsYoy]||'',
              users: parseInt(r[cm.users])||0, usersPrev: parseInt(r[cm.usersPrev])||0, usersYoy: r[cm.usersYoy]||'',
              snapshotPeriod: (document.getElementById('pSnapshotPeriod') || {}).value || ''
            };
          }).filter(function(r) { return r.product; });
        }
      }
      var newUserRows = [];
      if (userSheet) {
        var userData = XLSX.utils.sheet_to_json(wb.Sheets[userSheet], { header: 1, defval: null });
        console.log('[潜力导入] 用户sheet行数:', userData.length, '表头:', userData[0]);
        if (userData.length > 1) {
          var um = App.ImportPotential._buildColMap(userData[0], App.ImportPotential.USER_MAP);
          console.log('[潜力导入] 用户列映射:', JSON.stringify(um));
          newUserRows = userData.slice(1).filter(function(r) { return r && r.length > 3; }).map(function(r) {
            var p = String(r[um.product]||'').trim();
            var d3 = String(r[um.dept3]||''), d4 = String(r[um.dept4]||'');
            // 自动向上填充：四级为空/未匹配→取三级，三级为空/未匹配→取业务中心
            var isEmpty = function(v) { return !v || v === '未分配' || v === '未匹配'; };
            if (isEmpty(d3)) d3 = String(r[um.center]||'');
            if (isEmpty(d4)) d4 = d3;
            // 特殊销售人员团队小组映射
            var userSalesName = String(r[um.sales]||'').trim();
            var SPECIAL_USER_DEPT4 = { '林若驹': '水利水务' };
            if (SPECIAL_USER_DEPT4[userSalesName]) d4 = SPECIAL_USER_DEPT4[userSalesName];
            return {
              center: String(r[um.center]||''), dept3: d3, dept4: d4, sales: String(r[um.sales]||''),
              contact: String(r[um.contact]||''), userName: String(r[um.userName]||''), industry: String(r[um.industry]||''), product: p,
              outAmt: parseFloat(r[um.outAmt])||0, outAmtPrev: parseFloat(r[um.outAmtPrev])||0, outYoy: r[um.outYoy]||'',
              outQty: parseInt(r[um.outQty])||0, outQtyPrev: parseInt(r[um.outQtyPrev])||0, outQtyYoy: r[um.outQtyYoy]||'',
              opps: parseInt(r[um.opps])||0, oppsPrev: parseInt(r[um.oppsPrev])||0, oppsYoy: r[um.oppsYoy]||'',
              users: parseInt(r[um.users])||0, usersPrev: parseInt(r[um.usersPrev])||0, usersYoy: r[um.usersYoy]||'',
              custs: parseInt(r[um.custs])||0, custsPrev: parseInt(r[um.custsPrev])||0, custsYoy: r[um.custsYoy]||'',
              snapshotPeriod: (document.getElementById('pSnapshotPeriod') || {}).value || ''
            };
          }).filter(function(r) { return r.product; });
        }
      }
      console.log('[潜力导入] 解析完成: 客户', newCustRows.length, '条, 用户', newUserRows.length, '条');

      // ── 合并去重：按 客户名+产品+月份 / 用户名+产品+月份 去重 ──
      var snap = (document.getElementById('pSnapshotPeriod') || {}).value || '';
      var custIdx = {}, custN = 0, custU = 0;
      var prevCust = (App.ImportPotential.CustRAW || []).slice();
      // 旧记录补上缺失的月份
      prevCust.forEach(function(r) { if (!r.snapshotPeriod) r.snapshotPeriod = snap; });
      prevCust.forEach(function(r, i) { custIdx[(r.custName||'') + '|' + (r.product||'') + '|' + (r.snapshotPeriod||'')] = i; });
      var mergedCust = prevCust.slice();
      newCustRows.forEach(function(r) {
        var key = (r.custName||'') + '|' + (r.product||'') + '|' + (r.snapshotPeriod||'');
        if (custIdx[key] !== undefined) { mergedCust[custIdx[key]] = r; custU++; }
        else { mergedCust.push(r); custN++; custIdx[key] = mergedCust.length - 1; }
      });
      App.ImportPotential.CustRAW = mergedCust;

      var userIdx = {}, userN = 0, userU = 0;
      var prevUser = (App.ImportPotential.UserRAW || []).slice();
      prevUser.forEach(function(r) { if (!r.snapshotPeriod) r.snapshotPeriod = snap; });
      prevUser.forEach(function(r, i) { userIdx[(r.userName||'') + '|' + (r.product||'') + '|' + (r.snapshotPeriod||'')] = i; });
      var mergedUser = prevUser.slice();
      newUserRows.forEach(function(r) {
        var key = (r.userName||'') + '|' + (r.product||'') + '|' + (r.snapshotPeriod||'');
        if (userIdx[key] !== undefined) { mergedUser[userIdx[key]] = r; userU++; }
        else { mergedUser.push(r); userN++; userIdx[key] = mergedUser.length - 1; }
      });
      App.ImportPotential.UserRAW = mergedUser;

      // 发送到后端数据库
      Promise.all([
        newCustRows.length > 0 ? App.API.sendPotCust(newCustRows) : Promise.resolve(null),
        newUserRows.length > 0 ? App.API.sendPotUser(newUserRows) : Promise.resolve(null)
      ]).then(function() {
        console.log('[潜力导入] 后端保存成功');
        App.ImportPotential.render();
        App.ImportPotential.saveToHistory(file.name, custN, custU, userN, userU);
        App.ImportPotential.persist();  // localStorage 兜底
        try { App.Data.rebuildDerived(); } catch(e) { console.warn(e); }
        App.addLog('数据导入', file.name, '导入客户' + mergedCust.length + '条 / 用户' + mergedUser.length + '条');
        var msg = '导入完成! 文件: ' + file.name;
        msg += '\n\n潜力产品-客户: 新增' + custN + ' / 更新' + custU + '（共' + mergedCust.length + '）';
        if (!custSheet) msg += '\n  ⚠ 未找到客户sheet';
        msg += '\n潜力产品-用户: 新增' + userN + ' / 更新' + userU + '（共' + mergedUser.length + '）';
        if (!userSheet) msg += '\n  ⚠ 未找到用户sheet';
        msg += '\n\n识别sheets: ' + wb.SheetNames.join(', ');
        msg += '\n\n✅ 已同步后端数据库';
        alert(msg);
      }).catch(function(err) {
        console.error('[潜力导入] 后端保存失败:', err);
        App.ImportPotential.render();
        App.ImportPotential.persist();  // localStorage 兜底
        App.addLog('数据导入', file.name, '导入客户' + mergedCust.length + '条 / 用户' + mergedUser.length + '条（后端保存失败）');
        var msg = '导入完成! 文件: ' + file.name;
        msg += '\n\n潜力产品-客户: 新增' + custN + ' / 更新' + custU + '（共' + mergedCust.length + '）';
        if (!custSheet) msg += '\n  ⚠ 未找到客户sheet';
        msg += '\n潜力产品-用户: 新增' + userN + ' / 更新' + userU + '（共' + mergedUser.length + '）';
        if (!userSheet) msg += '\n  ⚠ 未找到用户sheet';
        msg += '\n\n识别sheets: ' + wb.SheetNames.join(', ');
        msg += '\n\n⚠️ 后端保存失败：' + err.message + '\n数据仅在前端内存中，刷新后消失。';
        alert(msg);
      });
    } catch(err) {
      console.error('[潜力导入] 解析失败:', err);
      alert('❌ 文件解析失败：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
};

// ===== 导入历史管理 =====
App.ImportPotential.history = [];
App.ImportPotential.saveToHistory = function(fileName, custN, custU, userN, userU) {
  var now = new Date();
  var ds = now.getFullYear() + '-' + ('0'+(now.getMonth()+1)).slice(-2) + '-' + ('0'+now.getDate()).slice(-2) + ' ' + ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2);
  var snapInput = document.getElementById('pSnapshotPeriod');
  var entry = {
    id: Date.now(), file: fileName || '手动快照', time: ds,
    custNew: custN||0, custUpd: custU||0, userNew: userN||0, userUpd: userU||0,
    custCount: (App.ImportPotential.CustRAW || []).length,
    userCount: (App.ImportPotential.UserRAW || []).length,
    total: (custN||0) + (custU||0) + (userN||0) + (userU||0),
    person: (App.loggedInUser && App.loggedInUser.name) || '当前用户',
    snapshotPeriod: snapInput ? snapInput.value : '',
    custSnap: JSON.parse(JSON.stringify(App.ImportPotential.CustRAW || [])),
    userSnap: JSON.parse(JSON.stringify(App.ImportPotential.UserRAW || []))
  };
  App.ImportPotential.history.unshift(entry);
  if (App.ImportPotential.history.length > 20) App.ImportPotential.history = App.ImportPotential.history.slice(0, 20);
  App.ImportPotential.renderHistory();
  try {
    var meta = App.ImportPotential.history.map(function(h) {
      return {id:h.id, file:h.file, time:h.time, custNew:h.custNew||0, custUpd:h.custUpd||0, userNew:h.userNew||0, userUpd:h.userUpd||0, custCount:h.custCount, userCount:h.userCount, total:h.total, person:h.person, snapshotPeriod:h.snapshotPeriod||''};
    });
    localStorage.setItem('pa_p_history', JSON.stringify(meta));
  } catch(e) {}
};
App.ImportPotential.renderHistory = function() {
  var tbody = document.getElementById('pImportHistoryTable');
  if (!tbody) return;
  if (App.ImportPotential.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8">暂无历史记录，上传文件后自动保存</td></tr>';
    return;
  }
  var html = '';
  App.ImportPotential.history.forEach(function(h, i) {
    html += '<tr>';
    html += '<td><span class="rn rn0">' + (i + 1) + '</span></td>';
    html += '<td><strong>' + h.file + '</strong></td>';
    html += '<td style="text-align:center;font-size:11px">' + h.time + '</td>';
    html += '<td style="text-align:center;font-weight:600">' + (h.snapshotPeriod || '-') + '</td>';
    html += '<td style="text-align:center;font-weight:600;color:#1e40af">' + (h.userNew||0) + '<span style="color:#94a3b8">/' + (h.userUpd||0) + '</span></td>';
    html += '<td style="text-align:center;font-weight:600;color:#166534">' + (h.custNew||0) + '<span style="color:#94a3b8">/' + (h.custUpd||0) + '</span></td>';
    html += '<td style="text-align:center">' + h.total + '</td>';
    html += '<td style="font-size:11px">' + h.person + '</td>';
    html += '<td style="text-align:center"><button class="btn-ghost" style="padding:2px 6px;font-size:10px;color:#dc2626" onclick="App.ImportPotential.deleteHistory(' + i + ')" title="删除此记录">✕</button></td></tr>';
  });
  tbody.innerHTML = html;
};
App.ImportPotential.deleteHistory = function(idx) {
  var h = App.ImportPotential.history[idx];
  if (!h) return;
  if (!confirm('确定删除「' + h.file + '」(' + (h.snapshotPeriod || h.time) + ') 的记录并回退数据吗？')) return;
  App.ImportPotential.history.splice(idx, 1);
  var prev = App.ImportPotential.history[idx] || App.ImportPotential.history[0];
  if (prev && prev.custSnap && prev.userSnap) {
    App.ImportPotential.CustRAW = JSON.parse(JSON.stringify(prev.custSnap));
    App.ImportPotential.UserRAW = JSON.parse(JSON.stringify(prev.userSnap));
  } else {
    App.ImportPotential.CustRAW = [];
    App.ImportPotential.UserRAW = [];
  }

  // 同步后端：删除旧数据后重新上传回退后的数据
  try {
    fetch('/api/import/potential-cust', { method: 'DELETE' }).then(function() {
      if (App.ImportPotential.CustRAW.length > 0) {
        fetch('/api/import/potential-cust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: App.ImportPotential.CustRAW })
        }).catch(function() {});
      }
    }).catch(function() {});
    fetch('/api/import/potential-user', { method: 'DELETE' }).then(function() {
      if (App.ImportPotential.UserRAW.length > 0) {
        fetch('/api/import/potential-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: App.ImportPotential.UserRAW })
        }).catch(function() {});
      }
    }).catch(function() {});
  } catch(e) {}

  App.addLog('删除数据', '潜力产品', '回退导入: ' + h.file + ', 客户' + App.ImportPotential.CustRAW.length + '条 / 用户' + App.ImportPotential.UserRAW.length + '条');

  App.ImportPotential.render();
  App.ImportPotential.renderHistory();
  try {
    var meta = App.ImportPotential.history.map(function(h) {
      return {id:h.id, file:h.file, time:h.time, custNew:h.custNew||0, custUpd:h.custUpd||0, userNew:h.userNew||0, userUpd:h.userUpd||0, custCount:h.custCount, userCount:h.userCount, total:h.total, person:h.person, snapshotPeriod:h.snapshotPeriod||''};
    });
    localStorage.setItem('pa_p_history', JSON.stringify(meta));
  } catch(e) {}
};

// 下载当前潜力产品数据为 Excel
App.ImportPotential.exportCurrent = function() {
  var custAll = App.ImportPotential.CustRAW || [];
  var userAll = App.ImportPotential.UserRAW || [];

  // 读取当前选择的月份
  var periodEl = document.getElementById('pSnapshotPeriod');
  var selectedPeriod = periodEl ? periodEl.value : '';
  var periodLabel = selectedPeriod || '全部月份';

  // 按月份过滤数据
  var cust = custAll;
  var user = userAll;
  if (selectedPeriod) {
    cust = custAll.filter(function(r) { return (r.snapshotPeriod || r.period || '') === selectedPeriod; });
    user = userAll.filter(function(r) { return (r.snapshotPeriod || r.period || '') === selectedPeriod; });
  }

  if (cust.length === 0 && user.length === 0) { alert('暂无数据可下载（当前选择月份: ' + periodLabel + '）'); return; }
  var wb = XLSX.utils.book_new();
  if (cust.length > 0) {
    var custSheet = XLSX.utils.json_to_sheet(cust);
    XLSX.utils.book_append_sheet(wb, custSheet, '潜力产品-客户');
  }
  if (user.length > 0) {
    var userSheet = XLSX.utils.json_to_sheet(user);
    XLSX.utils.book_append_sheet(wb, userSheet, '潜力产品-用户');
  }

  App.addLog('数据导出', '潜力产品', '下载潜力产品数据(' + periodLabel + '): 客户' + cust.length + '条 / 用户' + user.length + '条');

  XLSX.writeFile(wb, '潜力产品数据_' + periodLabel.replace(/[^0-9a-zA-Z一-鿿]/g, '-') + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
};

// 清空潜力产品历史记录及数据
App.ImportPotential.clearAll = function() {
  if (!confirm('确定清空所有潜力产品历史记录及后端数据吗？此操作不可撤销。')) return;
  // 清后端
  try { fetch('/api/import/potential-cust', { method: 'DELETE' }); } catch(e) {}
  try { fetch('/api/import/potential-user', { method: 'DELETE' }); } catch(e) {}
  // 清内存
  App.ImportPotential.history = [];
  App.ImportPotential.CustRAW = [];
  App.ImportPotential.UserRAW = [];
  App.ImportPotential.render();
  App.ImportPotential.renderHistory();
  App.ImportPotential.persist();  // localStorage 同步清空
  try { localStorage.removeItem('pa_p_history'); } catch(e) {}
};

// ===== 小组列表（从当前数据源提取 dept5 字段） =====
App.ImportPotential.getGroups = function() {
  // 从静态 GROUPS 读取全部小组
  return (App.GROUPS || []).map(function(g) { return g.n; });
};

// ===== 部门变更 → 级联刷新小组下拉 + 重渲 + 双向联动顶部 FilterBar =====
App.ImportPotential.onDeptChange = function(deptVal) {
  var grpSel = document.getElementById('pImportGroupFilter');
  if (!grpSel) return;
  var allGrps = (App.GROUPS || []);
  var grps = deptVal === 'all' ? allGrps : allGrps.filter(function(g) { return g.dept === deptVal; });
  grpSel.innerHTML = '<option value="all">全部小组</option>' +
    grps.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
  grpSel.value = 'all';
  // 双向联动：同步顶部 FilterBar
  try {
    var topSel = document.querySelector('#page-potential .filter-dept');
    if (topSel && topSel.value !== deptVal) topSel.value = deptVal;
    App.onDeptChange('page-potential');
  } catch(e) {}
  App.ImportPotential.render();
};

App.ImportPotential.render = function() {
  var isCust = App.ImportPotential.currentDS === 'cust';
  var data = (isCust ? (App.ImportPotential.CustRAW || []) : (App.ImportPotential.UserRAW || [])).slice();

  // 每次渲染都刷新下拉（保证数据变化后选项同步）
  var deptSel = document.getElementById('pImportDeptFilter');
  if (deptSel) {
    var curD = deptSel.value;
    deptSel.innerHTML = '<option value="all">全部部门</option>' +
      App.ImportPotential.getDepts().map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
    if (App.ImportPotential.getDepts().some(function(d) { return d === curD; })) deptSel.value = curD;
  }
  var grpSel = document.getElementById('pImportGroupFilter');
  if (grpSel) {
    var curG = grpSel.value;
    grpSel.innerHTML = '<option value="all">全部小组</option>' +
      App.ImportPotential.getGroups().map(function(g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');
    if (App.ImportPotential.getGroups().some(function(g) { return g === curG; })) grpSel.value = curG;
    else grpSel.value = 'all';
  }
  var prodSel = document.getElementById('pImportProdFilter');
  if (prodSel) {
    var curP = prodSel.value;
    prodSel.innerHTML = '<option value="all">全部产品</option>' +
      App.ImportPotential.getProducts().map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
    if (App.ImportPotential.getProducts().some(function(p) { return p === curP; })) prodSel.value = curP;
    else prodSel.value = 'all';
  }
  // 月份筛选（复制产品宽度表设计）
  var periodSel = document.getElementById('pImportPeriodFilter');
  if (periodSel) {
    var periods = {};
    (App.ImportPotential.CustRAW || []).concat(App.ImportPotential.UserRAW || []).forEach(function(r) {
      var p = r.snapshotPeriod || '';
      if (p) periods[p] = true;
    });
    var curPeriod = periodSel.value;
    var monthList = Object.keys(periods).sort();
    if (monthList.length === 0) {
      periodSel.innerHTML = '<option value="">无数据</option>';
    } else {
      var latest = monthList[monthList.length - 1];
      periodSel.innerHTML = monthList.map(function(p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
      periodSel.value = periods[curPeriod] ? curPeriod : latest;
    }
  }

  // 首次渲染时同步顶部筛选状态
  if (deptSel && deptSel.value === 'all') {
    var topState = (typeof App.getFilterState === 'function') ? App.getFilterState('page-potential') : { team: 'all', group: 'all' };
    if (topState.team !== 'all' && deptSel.querySelector('option[value="' + topState.team + '"]')) {
      deptSel.value = topState.team;
      App.ImportPotential.onDeptChange(topState.team);
    }
  }

  var deptFilter = (deptSel || {}).value || 'all';
  var grpFilter = (grpSel || {}).value || 'all';
  var prodFilter = (prodSel || {}).value || 'all';
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  var search = ((document.getElementById('pImportSearch') || {}).value || '').trim().toLowerCase();
  var sort = ((document.getElementById('pImportSort') || {}).value || 'sales_desc');

  // 应用筛选
  if (periodFilter && periodFilter !== 'all') {
    var pFiltered = data.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    if (pFiltered.length > 0) data = pFiltered;
  }
  // 清洗未匹配字段：向上级联填充
  data.forEach(function(r) {
    var empty = function(v) { return !v || v === '未分配' || v === '未匹配'; };
    if (empty(r.dept4)) r.dept4 = r.dept3 || '-';
    if (empty(r.dept5)) r.dept5 = r.dept4 || '-';
    if (empty(r.dept3)) r.dept3 = '-';
  });
  if (deptFilter !== 'all') data = data.filter(function(r) { return r.dept3 === deptFilter || r.dept4 === deptFilter; });
  if (grpFilter !== 'all') data = data.filter(function(r) { return r.dept5 === grpFilter; });
  if (prodFilter !== 'all') data = data.filter(function(r) { return r.product === prodFilter; });
  if (search) data = data.filter(function(r) {
    return (r.custName || r.userName || r.product || '').toLowerCase().indexOf(search) >= 0 ||
           (r.sales || '').toLowerCase().indexOf(search) >= 0;
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
        '<th style="width:80px;' + freezeTh(3) + '">三级部门</th>' +
        '<th style="width:80px;' + freezeTh(4) + '">四级部门</th>' +
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
        '<th style="width:80px;' + freezeTh(3) + '">三级部门</th>' +
        '<th style="width:80px;' + freezeTh(4) + '">四级部门</th>' +
        '<th style="width:80px;' + freezeTh(5) + '">负责销售</th>' +
        '<th>对接人</th><th>最终用户名称</th><th>行业</th><th>潜力产品</th>' +
        '<th style="text-align:right">出库额(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th>' +
        '<th style="text-align:center">数量</th><th style="text-align:center">同期数量</th><th style="text-align:center">数量同比</th>' +
        '<th style="text-align:center">商机数</th><th style="text-align:center">商机同期</th><th style="text-align:center">商机同比</th>' +
        '<th style="text-align:center">用户数</th><th style="text-align:center">用户同期</th><th style="text-align:center">用户同比</th>' +
        '<th style="text-align:center">客户数</th><th style="text-align:center">客户同期</th><th style="text-align:center">客户同比</th></tr>';
    }
  }

  // 排序
  var sortField = isCust ? 'amount' : 'outAmt';
  if (sort === 'sales_desc') data.sort(function(a,b) { return (b[sortField]||0) - (a[sortField]||0); });
  else if (sort === 'sales_asc') data.sort(function(a,b) { return (a[sortField]||0) - (b[sortField]||0); });
  else if (sort === 'name') data.sort(function(a,b) { return (a.custName||a.userName||'').localeCompare(b.custName||b.userName||''); });

  // 分页
  var pSizeVal = (document.getElementById('pImportPageSize')||{}).value;
  var pSize = pSizeVal === '0' ? data.length : (parseInt(pSizeVal) || 20);
  var pTotal = data.length;
  var pPages = Math.ceil(pTotal / pSize);
  if (!App._pImportPage || App._pImportPage > pPages) App._pImportPage = pPages || 1;
  var pStart = (App._pImportPage - 1) * pSize;
  var pData = data.slice(pStart, pStart + pSize);

  // 更新客户/用户标签内的计数（跟随月份+部门+小组筛选）
  var custCountEl = document.getElementById('p-import-cust-count');
  var userCountEl = document.getElementById('p-import-user-count');
  var filteredCust = (App.ImportPotential.CustRAW || []).slice();
  var filteredUser = (App.ImportPotential.UserRAW || []).slice();
  // 月份筛选
  if (periodFilter && periodFilter !== 'all') {
    filteredCust = filteredCust.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    filteredUser = filteredUser.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  // 部门筛选
  if (deptFilter !== 'all') {
    filteredCust = filteredCust.filter(function(r) { return r.dept3 === deptFilter || r.dept4 === deptFilter; });
    filteredUser = filteredUser.filter(function(r) { return r.dept3 === deptFilter || r.dept4 === deptFilter; });
  }
  // 小组筛选
  if (grpFilter !== 'all') {
    filteredCust = filteredCust.filter(function(r) { return r.dept5 === grpFilter; });
    filteredUser = filteredUser.filter(function(r) { return r.dept4 === grpFilter; });
  }
  if (custCountEl) custCountEl.textContent = filteredCust.length;
  if (userCountEl) userCountEl.textContent = filteredUser.length;

  // 表体（使用分页数据 pData）
  // 同比格式化：带颜色（红涨绿跌）
  function fmtYoy(v) {
    if (v == null || v === '' || v === '-') return '<span style="color:#94a3b8">-</span>';
    var s = String(v);
    if (s === '新增') return '<span class="badge b-new">新增</span>';
    if (s.indexOf('%') >= 0) {
      if (s.indexOf('+') === 0) return '<span style="color:#dc2626;font-weight:600">' + s + '</span>';
      if (s.indexOf('-') === 0) return '<span style="color:#16a34a;font-weight:600">' + s + '</span>';
      return s;
    }
    var n = parseFloat(s);
    if (!isNaN(n)) {
      if (n > 0) return '<span style="color:#dc2626;font-weight:600">+' + n.toFixed(1) + '%</span>';
      if (n < 0) return '<span style="color:#16a34a;font-weight:600">' + n.toFixed(1) + '%</span>';
      return '<span style="color:#94a3b8">0.0%</span>';
    }
    return s;
  }

  var html = '';
  pData.forEach(function(r, ri) {
    var yoyBadge = fmtYoy(r.yoy || r.outYoy);

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
      html += '<td style="text-align:right;font-weight:700">' + (r.amount || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;color:#6b7280">' + (r.amountPrev || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:center">' + yoyBadge + '</td>';
      html += '<td style="text-align:center">' + (r.qty || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.qtyPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.qtyYoy) + '</td>';
      html += '<td style="text-align:center">' + (r.opps || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.oppsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.oppsYoy) + '</td>';
      html += '<td style="text-align:center">' + (r.users || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.usersPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.usersYoy) + '</td>';
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
      html += '<td style="text-align:right;font-weight:700">' + (r.outAmt || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;color:#6b7280">' + (r.outAmtPrev || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:center">' + yoyBadge + '</td>';
      html += '<td style="text-align:center">' + (r.outQty || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.outQtyPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.outQtyYoy) + '</td>';
      html += '<td style="text-align:center">' + (r.opps || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.oppsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.oppsYoy) + '</td>';
      html += '<td style="text-align:center">' + (r.users || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.usersPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.usersYoy) + '</td>';
      html += '<td style="text-align:center">' + (r.custs || 0) + '</td>';
      html += '<td style="text-align:center;color:#6b7280">' + (r.custsPrev || 0) + '</td>';
      html += '<td style="text-align:center">' + fmtYoy(r.custsYoy) + '</td>';
    }
    html += '</tr>';
  });

  if (data.length === 0) {
    var totalCols = isCust ? 24 : 24;
    html = '<tr><td colspan="' + totalCols + '" style="text-align:center;padding:24px;color:#94a3b8">无匹配数据</td></tr>';
  }

  var tbody = document.getElementById('pImportDataTbody');
  if (tbody) tbody.innerHTML = html;

  // 分页信息（匹配产品宽度样式）
  var page = App._pImportPage || 1;
  var pageInfo = document.getElementById('pImportPageInfo');
  if (pageInfo) pageInfo.textContent = (pTotal > 0 ? ((page-1)*pSize+1 + '–' + Math.min(page*pSize, pTotal) + ' / ' + pTotal + ' 条') : '0 条');
  var pageBtns = document.getElementById('pImportPageBtns');
  if (pageBtns && pPages > 1) {
    var ph = '';
    if (page > 1) ph += '<button class="page-btn" onclick="App._pImportPage=' + (page-1) + ';App.ImportPotential.render()">←</button>';
    for (var i = 1; i <= pPages && i <= 8; i++) ph += '<button class="page-btn' + (i === page ? ' active' : '') + '" onclick="App._pImportPage=' + i + ';App.ImportPotential.render()">' + i + '</button>';
    if (page < pPages) ph += '<button class="page-btn" onclick="App._pImportPage=' + (page+1) + ';App.ImportPotential.render()">→</button>';
    pageBtns.innerHTML = ph;
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

  // 同步后端：删除该类型的全部记录后重新上传剩余数据
  var type = isCust ? 'cust' : 'user';
  var endpoint = isCust ? '/api/import/potential-cust' : '/api/import/potential-user';
  var remaining = data;
  try {
    fetch(endpoint, { method: 'DELETE' }).then(function() {
      if (remaining.length > 0) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: remaining })
        }).catch(function() {});
      }
    }).catch(function() {});
  } catch(e) {}

  try { App.addLog('删除数据', '潜力产品', '批量删除 ' + indices.length + ' 条' + (isCust ? '客户' : '用户') + '记录'); } catch(e) {}
  App.ImportPotential.persist();  // localStorage 同步
  App.ImportPotential.render();
};

// ===== 账号管理-用户管理Tab渲染 =====
App.renderAdminUsers = function() {
  var users = App.MOCK_USERS.slice();
  var roles = App.USER_ROLES;
  // 按部门顺序排列
  var deptOrder = App.DEPT_LIST || [];
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
  App.showModal(title, h, '');  // 自带取消/保存按钮，不要默认关闭
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
  App.addLog(isEdit ? '编辑用户' : '新增用户', name, (isEdit ? '编辑' : '新增') + '用户 ' + name + '（' + username + '），角色 ' + role);
};

// 变更用户角色
App.changeUserRole = function(id, newRole) {
  var u = App.MOCK_USERS.find(function(x) { return x.id === id; });
  if (u) {
    var oldRole = u.role;
    u.role = newRole;
    App.addLog('编辑用户', u.name, '角色变更: ' + oldRole + ' → ' + newRole);
  }
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
  App.showPermModal();
  App.addLog('删除用户', u.name, '删除用户 ' + u.name + '（' + u.username + '）');
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
  App.showModal('🔑 修改密码', h, '');  // 传空字符串去掉默认关闭按钮，表单自带取消/确认
};

App.changePwd = function() {
  var oldPwd = (document.getElementById('cpOldPwd') || {}).value || '';
  var newPwd = (document.getElementById('cpNewPwd') || {}).value || '';
  var confirmPwd = (document.getElementById('cpConfirmPwd') || {}).value || '';
  if (!oldPwd) { alert('请输入当前密码'); return; }
  if (newPwd.length < 6) { alert('新密码至少 6 位'); return; }
  if (newPwd !== confirmPwd) { alert('两次新密码不一致'); return; }

  // 调后端验证
  fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.ok) {
      // 同时更新本地 sessionStorage 中缓存的密码（用于本地 Mock 回退）
      try {
        var login = JSON.parse(sessionStorage.getItem('pa_login') || '{}');
        login._pwd = newPwd;
        sessionStorage.setItem('pa_login', JSON.stringify(login));
      } catch(e) {}
      App.addLog('修改密码', App.loggedInUser.name, '修改了登录密码');
      alert('✅ 密码修改成功，下次登录请使用新密码');
      App.closeModal();
    } else {
      alert('❌ ' + (d.message || '密码修改失败'));
    }
  })
  .catch(function(e) {
    // 后端不可用时尝试本地修改（仅适用于 Mock 模式）
    if (oldPwd !== 'admin123') { alert('当前密码错误'); return; }
    try {
      var login = JSON.parse(sessionStorage.getItem('pa_login') || '{}');
      login._pwd = newPwd;
      sessionStorage.setItem('pa_login', JSON.stringify(login));
    } catch(e) {}
    alert('✅ 密码已在本地修改（后端不可用，重启后需重新设置）');
    App.closeModal();
  });
};

// ===== 潜力产品 — 客户维度：客户交易的用户分析（从导入数据聚合） =====
App.renderCustUserLink = function(state) {
  var tbody = document.getElementById('pCustUserBody');
  if (!tbody) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  var search = ((document.getElementById('pCustUserSearch') || {}).value || '').trim().toLowerCase();

  // ── 客户维度仅使用客户sheet数据 ──
  var raw = App.getFilteredPotData('cust');
  var custMap = {};
  raw.forEach(function(r) {
    var cust = r.custName || '未知';
    var user = r.userName || '-';
    if (!custMap[cust]) custMap[cust] = { dept: r.dept4 || r.dept3 || '', grp: r.dept5 || r.dept4 || '', users: {} };
    if (!custMap[cust].users[user]) custMap[cust].users[user] = { name: user, amt: 0, prods: {} };
    custMap[cust].users[user].amt += r.amount || 0;
    if (r.product) custMap[cust].users[user].prods[r.product] = true;
  });

  var custList = Object.keys(custMap).map(function(cn) {
    var c = custMap[cn];
    var userArr = Object.keys(c.users).map(function(un) {
      return { name: un, amt: c.users[un].amt, prods: Object.keys(c.users[un].prods) };
    });
    var totalAmt = userArr.reduce(function(s, u) { return s + u.amt; }, 0);
    var allProds = new Set();
    userArr.forEach(function(u) { u.prods.forEach(function(p) { allProds.add(p); }); });
    return { cust: cn, dept: c.dept, grp: c.grp, users: userArr, userCount: userArr.length, prodCount: allProds.size, totalAmt: totalAmt, tag: '' };
  }).filter(function(c) {
    if (search && c.cust.toLowerCase().indexOf(search) < 0) return false;
    return true;
  }).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  // 缓存
  custList.forEach(function(c) { App._custUserCache[c.cust] = c; });

  // 分页
  var cuPageSize = App._cuPageSize || parseInt((document.getElementById('p-custuser-page-size')||{}).value) || 10;
  var cuTotal = custList.length;
  var cuPages = Math.ceil(cuTotal / cuPageSize);
  if (!App._custUserPage || App._custUserPage > cuPages) App._custUserPage = cuPages || 1;
  var cuStart = (App._custUserPage - 1) * cuPageSize;
  var cuRows = custList.slice(cuStart, cuStart + cuPageSize);

  var totalProds = App.ALL_POT_PRODUCTS.length || 27;
  var countEl = document.getElementById('p-cust-user-count');
  if (countEl) countEl.textContent = custList.length + ' 个客户 · ' + custList.reduce(function(s, c) { return s + c.userCount; }, 0) + ' 个用户';

  // 表头（9列）
  var headEl = document.getElementById('pCustUserHead');
  if (headEl) {
    headEl.innerHTML = '<tr>' +
      '<th class="cu-c">#</th>' +
      '<th>客户名称</th>' +
      '<th class="cu-c">关联用户</th>' +
      '<th class="cu-c">覆盖产品</th>' +
      '<th class="cu-c">销售额(万)</th>' +
      '<th>用户</th>' +
      '<th class="cu-c">用户贡献</th>' +
      '<th class="cu-c">产品数</th></tr>';
  }

  var globalIdx = cuStart;
  var html = '';
  if (cuRows.length === 0) {
    html = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#9ca3af">无匹配数据</td></tr>';
  } else {
    cuRows.forEach(function(c) {
      var i = globalIdx++;
      var rankCls = i < 3 ? ['gold','silver','bronze'][i] : '';
      var sub = (c.dept || '深圳') + (c.grp ? ' · ' + c.grp : '');
      var custEsc = c.cust.replace(/'/g, "\\'");
      c.users.forEach(function(u, ui) {
        if (ui === 0) {
          // 主行
          html += '<tr>' +
            '<td rowspan="' + c.users.length + '"><span class="rn ' + rankCls + '">' + (i + 1) + '</span></td>' +
            '<td rowspan="' + c.users.length + '">' +
              '<div class="cust-name">' + App.escapeHtml(c.cust) + '</div>' +
              '<div class="cust-sub">' + App.escapeHtml(sub) + '</div></td>' +
            '<td rowspan="' + c.users.length + '" class="cu-c" style="cursor:pointer" onclick="App.showUserDetailModal(\'' + custEsc + '\',\'users\')" title="点击查看交易用户明细"><span class="chip chip-blue">' + c.userCount + ' 人</span></td>' +
            '<td rowspan="' + c.users.length + '" class="cu-c" style="cursor:pointer" onclick="App.showUserDetailModal(\'' + custEsc + '\',\'prods\')" title="点击查看潜力产品明细"><span class="chip chip-green">' + c.prodCount + ' / ' + totalProds + '</span></td>' +
            '<td rowspan="' + c.users.length + '" class="cu-c"><span class="amt">¥' + c.totalAmt.toFixed(2) + '万</span></td>' +
            '<td><span style="font-size:12px;font-weight:600">' + (u.name === '-' ? '<span class="dash">-</span>' : App.escapeHtml(u.name)) + '</span></td>' +
            '<td class="cu-c"><span class="amt">¥' + u.amt.toFixed(2) + '万</span></td>' +
            '<td class="cu-c"><span style="font-weight:600;color:#2563eb">' + u.prods.length + '</span></td></tr>';
        } else {
          // 子行
          html += '<tr>' +
            '<td class="left-dim"></td><td class="left-dim"></td><td class="left-dim cu-c"></td><td class="left-dim cu-c"></td><td class="left-dim cu-c"></td>' +
            '<td><span style="font-size:12px">' + (u.name === '-' ? '<span class="dash">-</span>' : App.escapeHtml(u.name)) + '</span></td>' +
            '<td class="cu-c">' + (u.amt > 0 ? '<span class="amt">¥' + u.amt.toFixed(2) + '万</span>' : '<span class="dash">-</span>') + '</td>' +
            '<td class="cu-c">' + (u.prods.length > 0 ? '<span style="font-weight:600;color:#2563eb">' + u.prods.length + '</span>' : '<span class="dash">-</span>') + '</td></tr>';
        }
      });
    });
  }
  tbody.innerHTML = html;

  // 分页
  var cuPager = document.getElementById('p-custuser-pager');
  if (cuPager) {
    var startDisp = cuTotal > 0 ? cuStart + 1 : 0;
    var endDisp = Math.min(cuStart + cuPageSize, cuTotal);
    var leftHtml = '每页 <select onchange="App._cuPageSize=parseInt(this.value);App._custUserPage=1;App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))"><option value="10" ' + (cuPageSize === 10 ? 'selected' : '') + '>10</option><option value="20" ' + (cuPageSize === 20 ? 'selected' : '') + '>20</option><option value="50" ' + (cuPageSize === 50 ? 'selected' : '') + '>50</option></select> 条 · 显示 ' + startDisp + '-' + endDisp + ' / ' + cuTotal;

    var rightHtml = '';
    if (cuPages > 1) {
      rightHtml += '<button class="cu-pgbtn nav" onclick="App._custUserPage=' + Math.max(1, App._custUserPage - 1) + ';App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))" ' + (App._custUserPage <= 1 ? 'disabled' : '') + '>‹</button>';
      var maxBtns = 5, curPage = App._custUserPage;
      var startPg = Math.max(1, curPage - Math.floor(maxBtns / 2));
      var endPg = Math.min(cuPages, startPg + maxBtns - 1);
      if (endPg - startPg < maxBtns - 1) startPg = Math.max(1, endPg - maxBtns + 1);
      if (startPg > 1) { rightHtml += '<button class="cu-pgbtn" onclick="App._custUserPage=1;App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))">1</button>'; if (startPg > 2) rightHtml += '<span class="cu-pgdot">…</span>'; }
      for (var pg = startPg; pg <= endPg; pg++) {
        rightHtml += '<button class="cu-pgbtn' + (pg === curPage ? ' active' : '') + '" onclick="App._custUserPage=' + pg + ';App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))">' + pg + '</button>';
      }
      if (endPg < cuPages) { if (endPg < cuPages - 1) rightHtml += '<span class="cu-pgdot">…</span>'; rightHtml += '<button class="cu-pgbtn" onclick="App._custUserPage=' + cuPages + ';App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))">' + cuPages + '</button>'; }
      rightHtml += '<button class="cu-pgbtn nav" onclick="App._custUserPage=' + Math.min(cuPages, App._custUserPage + 1) + ';App.renderCustUserLink(App.getFilterState(&apos;page-potential&apos;))" ' + (App._custUserPage >= cuPages ? 'disabled' : '') + '>›</button>';
    }
    cuPager.innerHTML = '<span>' + leftHtml + '</span><div class="cu-pager">' + rightHtml + '</div>';
  }
};

// 客户交易用户分析下钻
App._custUserCache = {};
App.showUserDetailModal = function(custName, type) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // ── 从筛选后数据取真实明细（严格遵循顶部筛选边界）──
  var fCust = App.getFilteredPotData('cust');
  var custRecords = fCust.filter(function(r) { return r.custName === custName; });

  if (custRecords.length === 0) {
    App.showModal(custName + ' · 明细', '<p style="text-align:center;padding:24px;color:#9ca3af">暂无数据</p>');
    return;
  }

  if (type === 'users') {
    // 按用户聚合
    var userAgg = {};
    custRecords.forEach(function(r) {
      var un = r.userName || '-';
      if (!userAgg[un]) userAgg[un] = { name: un, totalAmt: 0, prods: {} };
      userAgg[un].totalAmt += r.amount || 0;
      if (r.product) userAgg[un].prods[r.product] = (userAgg[un].prods[r.product] || 0) + (r.amount || 0);
    });
    var users = Object.values(userAgg).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

    var h = '<h3 style="margin:0 0 8px">' + App.escapeHtml(custName) + ' · 交易用户明细 <span style="font-size:13px;color:#6b7280">' + users.length + '个用户</span></h3>';
    h += '<table class="table tight-table"><thead><tr><th>用户</th><th style="text-align:right">总贡献额(万)</th><th style="text-align:center">产品数</th><th>各产品销售额</th></tr></thead><tbody>';
    users.forEach(function(u) {
      var prodDetails = Object.keys(u.prods).sort(function(a, b) { return u.prods[b] - u.prods[a]; }).map(function(p) {
        return '<span style="display:inline-block;margin:1px 2px;padding:1px 6px;background:#dbeafe;border-radius:3px;font-size:10px">' + p + ' <b>¥' + (u.prods[p] || 0).toFixed(2) + '万</b></span>';
      }).join('');
      h += '<tr><td style="font-weight:600;white-space:nowrap">' + App.escapeHtml(u.name) + '</td><td style="text-align:right;font-weight:700;white-space:nowrap">¥' + u.totalAmt.toFixed(2) + '万</td><td style="text-align:center">' + Object.keys(u.prods).length + '</td><td>' + prodDetails + '</td></tr>';
    });
    h += '</tbody></table>';
    App.showModal(custName + ' · 用户明细', h);
  } else {
    // 产品维度：按产品聚合
    var prodAgg = {};
    custRecords.forEach(function(r) {
      if (!r.product) return;
      if (!prodAgg[r.product]) prodAgg[r.product] = { name: r.product, totalAmt: 0 };
      prodAgg[r.product].totalAmt += r.amount || 0;
    });
    var sorted = Object.values(prodAgg).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

    var h = '<h3 style="margin:0 0 8px">' + App.escapeHtml(custName) + ' · 潜力产品明细 <span style="font-size:13px;color:#6b7280">' + sorted.length + '个产品</span></h3>';
    h += '<table class="table tight-table"><thead><tr><th>产品</th><th style="text-align:right">贡献额(万)</th></tr></thead><tbody>';
    sorted.forEach(function(p) {
      h += '<tr><td style="font-weight:600">' + p.name + '</td><td style="text-align:right;font-weight:700">¥' + p.totalAmt.toFixed(2) + '万</td></tr>';
    });
    h += '</tbody></table>';
    App.showModal(custName + ' · 产品明细', h);
  }
};

App.showUserProdDetail = function(custName, userName) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // ── 从筛选后数据取真实明细 ──
  var fCust = App.getFilteredPotData('cust');
  var records = fCust.filter(function(r) { return r.custName === custName && (r.userName === userName || (r.userName || '-') === userName); });

  if (records.length === 0) {
    App.showModal(userName + ' · 潜力产品明细', '<p style="text-align:center;padding:24px;color:#9ca3af">暂无数据</p>');
    return;
  }

  // 按产品聚合
  var prodAgg = {};
  records.forEach(function(r) {
    if (!r.product) return;
    if (!prodAgg[r.product]) prodAgg[r.product] = { name: r.product, amt: 0 };
    prodAgg[r.product].amt += r.amount || 0;
  });
  var sorted = Object.values(prodAgg).sort(function(a, b) { return b.amt - a.amt; });
  var totalAmt = sorted.reduce(function(s, p) { return s + p.amt; }, 0);

  var h = '<h3 style="margin:0 0 8px">' + App.escapeHtml(userName) + ' · 潜力产品明细 <span style="font-size:13px;color:#6b7280">¥' + totalAmt.toFixed(2) + '万 · ' + sorted.length + '个产品</span></h3>';
  h += '<table class="table tight-table"><thead><tr><th>产品</th><th style="text-align:right">贡献额(万)</th></tr></thead><tbody>';
  sorted.forEach(function(p) {
    h += '<tr><td style="font-weight:600">' + p.name + '</td><td style="text-align:right;font-weight:700">¥' + p.amt.toFixed(2) + '万</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(userName + ' · 潜力产品明细', h);
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

  // ── 用户维度仅使用用户sheet数据 ──
  var fUser = App.getFilteredPotData('user');
  var userAgg = {};
  fUser.forEach(function(r) {
    if (!r.userName) return;
    if (!userAgg[r.userName]) userAgg[r.userName] = { name: r.userName, sales: 0, prev: 0, prods: {}, custs: {} };
    userAgg[r.userName].sales += (r.outAmt || 0);
    userAgg[r.userName].prev += (r.outAmtPrev || 0);
    if (r.product) userAgg[r.userName].prods[r.product] = true;
    if (r.custName) userAgg[r.userName].custs[r.custName] = (userAgg[r.userName].custs[r.custName] || 0) + (r.outAmt || 0);
  });
  var data = Object.values(userAgg).sort(function(a, b) { return b.sales - a.sales; });

  // 用户分层卡片
  var segs = { star:[], cash:[], potential:[], sleep:[] };
  data.forEach(function(u) {
    var cov = Object.keys(u.prods).length;
    if (u.sales >= 200 && cov >= 5) segs.star.push(u);
    else if (u.sales >= 200 && cov < 5) segs.cash.push(u);
    else if (u.sales < 200 && cov >= 5) segs.potential.push(u);
    else segs.sleep.push(u);
  });
  Object.keys(segs).forEach(function(k) {
    App.setText('useg-' + k + '-count', segs[k].length);
    App.setText('useg-' + k + '-list', segs[k].map(function(u) { return u.name; }).join('、'));
  });

  // 生命周期（根据同比判断）
  var lifes = { new:[], active:[], decline:[], lost:[] };
  data.forEach(function(u) {
    var yoy = u.prev > 0 ? ((u.sales - u.prev) / u.prev * 100) : (u.sales > 0 ? 100 : 0);
    if (u.prev === 0 && u.sales > 0) u.life = 'new';
    else if (yoy > 10) u.life = 'active';
    else if (yoy > -10) u.life = 'decline';
    else u.life = 'lost';
    lifes[u.life].push(u);
  });
  ['new','active','decline','lost'].forEach(function(k) { App.setText('p-ulife-' + k, lifes[k].length); });
  App.setText('p-ulife-scope', scopeLabel);
  var ulfTbody = document.getElementById('p-ulife-body');
  if (ulfTbody) {
    if (data.length === 0) {
      ulfTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">暂无用户数据</td></tr>';
    } else {
      var licon = { new:'🆕', active:'🟢', decline:'🟡', lost:'🔴' };
      var llabel = { new:'新增用户', active:'存量活跃', decline:'萎缩用户', lost:'流失用户' };
      var lcls = { new:'b-new', active:'b-up', decline:'b-warn', lost:'b-down' };
      ulfTbody.innerHTML = data.map(function(u) {
        var yoy = u.prev > 0 ? ((u.sales - u.prev) / u.prev * 100) : (u.sales > 0 ? 100 : 0);
        var yoyDisp = u.prev > 0 ? ((yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%') : (u.sales > 0 ? '新增' : '-');
        var yoyCls = u.prev === 0 ? 'b-new' : (yoy >= 0 ? 'b-up' : 'b-down');
        var cov = Object.keys(u.prods).length;
        return '<tr><td style="font-weight:600">' + App.escapeHtml(u.name) + '</td><td style="text-align:center"><span class="badge ' + lcls[u.life] + '">' + (licon[u.life]||'') + ' ' + (llabel[u.life]||'') + '</span></td><td style="text-align:right">¥' + u.sales.toFixed(2) + '万</td><td style="text-align:right;color:#6b7280">¥' + u.prev.toFixed(2) + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td><td style="text-align:center">' + cov + '/' + App.ALL_POT_PRODUCTS.length + '</td></tr>';
      }).join('');
    }
  }

  // 用户关联客户明细表（从真实数据构建）
  var userCustMap = {};
  data.slice(0, 15).forEach(function(u) {
    userCustMap[u.name] = Object.keys(u.custs).sort(function(a, b) { return u.custs[b] - u.custs[a]; }).map(function(c) {
      return { cust: c, amt: u.custs[c] };
    });
  });
  var ulinkBody = document.getElementById('pUserLinkBody');
  if (ulinkBody) {
    if (data.length === 0) {
      ulinkBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#9ca3af">暂无用户数据</td></tr>';
    } else {
      var html = '';
      data.slice(0, 10).forEach(function(u, i) {
        var custs = userCustMap[u.name] || [];
        if (custs.length === 0) custs = [{ cust: '-', amt: 0 }];
        var totalCustAmt = custs.reduce(function(s, c) { return s + c.amt; }, 0);
        custs.forEach(function(c, ci) {
          var rn = ci === 0 ? (i < 3 ? 'rn'+(i+1) : 'rn0') : '';
          if (ci === 0) {
            html += '<tr><td rowspan="' + custs.length + '" style="vertical-align:middle"><span class="' + rn + '">' + (i+1) + '</span></td>' +
              '<td rowspan="' + custs.length + '" style="vertical-align:middle;text-align:left;font-weight:600">' + App.escapeHtml(u.name) + '</td>' +
              '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700;color:#1a56db">' + custs.length + '</td>' +
              '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700">' + Object.keys(u.prods).length + '</td>' +
              '<td rowspan="' + custs.length + '" style="text-align:center;vertical-align:middle;font-weight:700;color:#2563eb">¥' + totalCustAmt.toFixed(2) + '万</td>';
          } else {
            html += '<tr>';
          }
          html += '<td style="text-align:left;font-size:11px">' + App.escapeHtml(c.cust) + '</td><td style="text-align:right;font-size:11px">¥' + c.amt.toFixed(2) + '万</td><td style="text-align:center;font-size:11px">' + Object.keys(u.prods).length + '</td></tr>';
        });
      });
      ulinkBody.innerHTML = html;
    }
  }

};

// 用户×客户产品明细下钻
App.showUserProdDetailModal = function(userName, custName) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }
  var fUser = App.getFilteredPotData('user');
  var records = fUser.filter(function(r) { return r.userName === userName && r.custName === custName; });
  var prodAgg = {};
  records.forEach(function(r) {
    if (!r.product) return;
    prodAgg[r.product] = (prodAgg[r.product] || 0) + (r.outAmt || 0);
  });
  var prods = Object.keys(prodAgg).sort(function(a, b) { return prodAgg[b] - prodAgg[a]; });
  var total = prods.reduce(function(s, p) { return s + prodAgg[p]; }, 0);
  var h = '<h3 style="margin:0 0 8px">' + App.escapeHtml(userName) + ' × ' + App.escapeHtml(custName) + ' <span style="font-size:13px;color:#6b7280">¥' + total.toFixed(2) + '万 · ' + prods.length + '个产品</span></h3>';
  if (prods.length === 0) {
    h += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无产品数据</p>';
  } else {
    h += '<table class="cu-table"><thead><tr><th>产品</th><th class="cu-c">贡献额(万)</th></tr></thead><tbody>';
    prods.forEach(function(p) {
      h += '<tr><td style="font-weight:600">' + p + '</td><td class="cu-c"><span class="amt">¥' + prodAgg[p].toFixed(2) + '万</span></td></tr>';
    });
    h += '</tbody></table>';
  }
  App.showModal(userName + ' × ' + custName + ' 产品明细', h);
};

App.showUserCustDrill = function(userName) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }
  var fUser = App.getFilteredPotData('user');
  var custAgg = {};
  fUser.forEach(function(r) {
    if (r.userName !== userName || !r.custName) return;
    custAgg[r.custName] = (custAgg[r.custName] || 0) + (r.outAmt || 0);
  });
  var custs = Object.keys(custAgg).sort(function(a, b) { return custAgg[b] - custAgg[a]; }).map(function(c) { return { cust: c, amt: custAgg[c] }; });
  var h = '<h3 style="margin:0 0 8px">' + App.escapeHtml(userName) + ' · 关联客户明细 <span style="font-size:13px;color:#6b7280">' + custs.length + '个</span></h3>';
  if (custs.length === 0) {
    h += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无关联客户</p>';
  } else {
    h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">贡献额(万)</th></tr></thead><tbody>';
    custs.forEach(function(c) { h += '<tr><td style="font-weight:600">' + App.escapeHtml(c.cust) + '</td><td style="text-align:right;font-weight:700">¥' + c.amt.toFixed(2) + '万</td></tr>'; });
    h += '</tbody></table>';
  }
  App.showModal(userName + ' · 关联客户', h);
};



// ===== 潜力产品 — 用户维度：用户背后的客户关系 =====
App.renderUserCustLink = function(state) {
  var tbody = document.getElementById('pUserCustBody');
  if (!tbody) return;
  state = state || { team: 'all', group: 'all', person: 'all' };
  // ── 用户维度仅使用用户sheet数据（严格遵循顶部筛选边界）──
  var raw = App.getFilteredPotData('user');
  var search = ((document.getElementById('pUserCustSearch') || {}).value || '').trim().toLowerCase();

  // 按最终用户聚合: userName → { custs: { custName → { prods: Set, totalAmt } } }
  var userMap = {};
  raw.forEach(function(r) {
    var user = r.userName || '-';
    if (!userMap[user]) userMap[user] = { custs: {}, dept: r.dept4 || r.dept3 || '' };
    // 仅当有关联客户时才计入
    if (r.custName) {
      var cust = r.custName;
      if (!userMap[user].custs[cust]) userMap[user].custs[cust] = { prods: {}, totalAmt: 0 };
      var amt = r.outAmt || 0;
      userMap[user].custs[cust].prods[r.product] = (userMap[user].custs[cust].prods[r.product] || 0) + amt;
      userMap[user].custs[cust].totalAmt += amt;
    }
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

  // 分页
  var cuPageSize = App._userCuPageSize || 10;
  var cuTotal = userList.length;
  var cuPages = Math.ceil(cuTotal / cuPageSize);
  if (!App._userCuPage || App._userCuPage > cuPages) App._userCuPage = cuPages || 1;
  var cuStart = (App._userCuPage - 1) * cuPageSize;
  var cuRows = userList.slice(cuStart, cuStart + cuPageSize);

  var countEl = document.getElementById('p-user-cust-count');
  if (countEl) countEl.textContent = userList.length + ' 个用户 · ' + userList.reduce(function(s, u) { return s + u.custCount; }, 0) + ' 个客户';

  // 表头（6列）
  var headEl = document.getElementById('pUserCustHead');
  if (headEl) {
    headEl.innerHTML = '<tr><th class="cu-c">#</th><th>用户名称</th><th class="cu-c">关联客户</th><th class="cu-c">覆盖产品</th><th class="cu-c">销售额(万)</th><th>关联客户明细</th></tr>';
  }

  var html = '';
  if (cuRows.length === 0) {
    html = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">无匹配数据</td></tr>';
  } else {
    cuRows.forEach(function(u, i) {
      var globalIdx = cuStart + i;
      var rankCls = globalIdx < 3 ? ['gold','silver','bronze'][globalIdx] : '';
      var userEsc = u.user.replace(/'/g, "\\'");
      var custTags = u.custs.map(function(c) {
        var custEsc = c.name.replace(/'/g, "\\'");
        var prodChips = c.prods.map(function(p) { return '<span class="chip chip-green" style="font-size:9px;padding:1px 5px;margin:1px">' + App.escapeHtml(p) + '</span>'; }).join('');
        return '<div style="padding:3px 6px;margin:2px 0;background:#f8fafc;border-radius:4px;font-size:11px;cursor:pointer" onclick="App.showUserProdDetailModal(\'' + userEsc + '\',\'' + custEsc + '\')" title="点击查看客户产品明细">' +
          '<strong>' + App.escapeHtml(c.name) + '</strong> · <span class="amt" style="font-size:11px">¥' + c.amt.toFixed(2) + '万</span> ' + prodChips + '</div>';
      }).join('');
      html += '<tr>' +
        '<td class="cu-c"><span class="rn ' + rankCls + '">' + (globalIdx + 1) + '</span></td>' +
        '<td><div class="cust-name">' + App.escapeHtml(u.user) + '</div><div class="cust-sub">' + App.escapeHtml(u.dept || '-') + '</div></td>' +
        '<td class="cu-c">' + (u.custCount > 0 ? '<span class="chip chip-blue" style="cursor:pointer" onclick="App.showUserCustDrill(\'' + userEsc + '\')" title="点击查看关联客户明细">' + u.custCount + ' 个</span>' : '<span class="dash">-</span>') + '</td>' +
        '<td class="cu-c"><span class="chip chip-green">' + u.prodCount + ' / ' + App.ALL_POT_PRODUCTS.length + '</span></td>' +
        '<td class="cu-c"><span class="amt">¥' + u.totalAmt.toFixed(2) + '万</span></td>' +
        '<td style="max-width:480px">' + (custTags || '<span class="dash">-</span>') + '</td></tr>';
    });
  }
  tbody.innerHTML = html;

  // 分页控件
  var cuPager = document.getElementById('p-usercust-pager');
  if (!cuPager) {
    // 动态创建分页容器
    var wrap = tbody.closest('.table-wrap');
    if (wrap && !wrap.nextElementSibling || (wrap && wrap.nextElementSibling && wrap.nextElementSibling.id !== 'p-usercust-pager')) {
      cuPager = document.createElement('div');
      cuPager.id = 'p-usercust-pager';
      cuPager.className = 'cu-bottom';
      wrap.parentNode.insertBefore(cuPager, wrap.nextSibling);
    }
  }
  if (cuPager) {
    var startDisp = cuTotal > 0 ? cuStart + 1 : 0;
    var endDisp = Math.min(cuStart + cuPageSize, cuTotal);
    var leftHtml = '每页 <select onchange="App._userCuPageSize=parseInt(this.value);App._userCuPage=1;App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))"><option value="10" ' + (cuPageSize === 10 ? 'selected' : '') + '>10</option><option value="20" ' + (cuPageSize === 20 ? 'selected' : '') + '>20</option><option value="50" ' + (cuPageSize === 50 ? 'selected' : '') + '>50</option></select> 条 · 显示 ' + startDisp + '-' + endDisp + ' / ' + cuTotal;

    var rightHtml = '';
    if (cuPages > 1) {
      rightHtml += '<button class="cu-pgbtn nav" onclick="App._userCuPage=' + Math.max(1, App._userCuPage - 1) + ';App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))" ' + (App._userCuPage <= 1 ? 'disabled' : '') + '>‹</button>';
      var maxBtns = 5, curPage = App._userCuPage;
      var startPg = Math.max(1, curPage - Math.floor(maxBtns / 2));
      var endPg = Math.min(cuPages, startPg + maxBtns - 1);
      if (endPg - startPg < maxBtns - 1) startPg = Math.max(1, endPg - maxBtns + 1);
      if (startPg > 1) { rightHtml += '<button class="cu-pgbtn" onclick="App._userCuPage=1;App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))">1</button>'; if (startPg > 2) rightHtml += '<span class="cu-pgdot">…</span>'; }
      for (var pg = startPg; pg <= endPg; pg++) {
        rightHtml += '<button class="cu-pgbtn' + (pg === curPage ? ' active' : '') + '" onclick="App._userCuPage=' + pg + ';App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))">' + pg + '</button>';
      }
      if (endPg < cuPages) { if (endPg < cuPages - 1) rightHtml += '<span class="cu-pgdot">…</span>'; rightHtml += '<button class="cu-pgbtn" onclick="App._userCuPage=' + cuPages + ';App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))">' + cuPages + '</button>'; }
      rightHtml += '<button class="cu-pgbtn nav" onclick="App._userCuPage=' + Math.min(cuPages, App._userCuPage + 1) + ';App.renderUserCustLink(App.getFilterState(&apos;page-potential&apos;))" ' + (App._userCuPage >= cuPages ? 'disabled' : '') + '>›</button>';
    }
    cuPager.innerHTML = '<span>' + leftHtml + '</span><div class="cu-pager">' + rightHtml + '</div>';
  }
};

// ===== 角色权限渲染 =====
App.renderRoles = function() {
  var thead = document.getElementById('aRolesHead');
  var tbody = document.getElementById('aRolesBody');
  if (!tbody || !App.ROLE_PERMISSIONS) return;

  var modKeys = ['overview','width','potential','users','roles','audit','backup','export','import'];
  var modLabels = { overview:'数据总览', width:'产品宽度', potential:'潜力产品', users:'用户管理', roles:'角色权限', audit:'审计日志', backup:'数据备份', export:'数据导出', import:'数据导入' };
  var scopeMap = { admin:'全部数据', gm:'全部数据', operation:'全部数据', director:'本部门', manager:'本小组', interface:'本部门', sales:'本人' };

  if (!App._roleEditBuffer) {
    App._roleEditBuffer = JSON.parse(JSON.stringify(App.ROLE_PERMISSIONS));
  }

  // 表头
  if (thead) {
    var th = '<tr><th>角色</th><th>名称</th>';
    modKeys.forEach(function(k) { th += '<th class="cu-c" title="' + modLabels[k] + '">' + (modLabels[k]||k) + '</th>'; });
    th += '<th>数据范围</th></tr>';
    thead.innerHTML = th;
  }

  // 表体
  tbody.innerHTML = App._roleEditBuffer.map(function(r, ri) {
    var cells = modKeys.map(function(k) {
      var checked = r.modules[k] === 1 ? ' checked' : '';
      return '<td class="cu-c"><input type="checkbox" ' + checked + ' onchange="App._roleEditBuffer[' + ri + '].modules.' + k + '=this.checked?1:0"></td>';
    }).join('');
    return '<tr>' +
      '<td><span class="role-badge">' + r.role + '</span></td>' +
      '<td class="role-name-cell"><span class="role-name">' + r.name + '</span><span class="role-desc">' + r.desc + '</span></td>' +
      cells +
      '<td class="role-scope">' + (scopeMap[r.role]||'-') + '</td></tr>';
  }).join('');
};

App.saveRolePerms = function() {
  if (!App._roleEditBuffer) return;
  App.ROLE_PERMISSIONS = JSON.parse(JSON.stringify(App._roleEditBuffer));
  App._roleEditBuffer = null;

  // 持久化到 localStorage（刷新不丢失）
  try {
    localStorage.setItem('pa_role_perms', JSON.stringify(App.ROLE_PERMISSIONS));
  } catch(e) {}

  // 同时尝试保存到后端
  try {
    fetch('/api/admin/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: App.ROLE_PERMISSIONS })
    }).catch(function() {});
  } catch(e) {}

  App.renderRoles();
  App.addLog('角色保存', '角色权限矩阵', '更新了角色权限配置');

  var toast = document.createElement('div');
  toast.textContent = '✅ 权限已保存';
  toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#059669;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;z-index:99999;font-weight:600';
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 1200);
};

App.cancelRoleEdit = function() {
  App._roleEditBuffer = null;
  App.renderRoles();
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
  App.addLog('修改参数', '业务参数', '修改了 ' + saved + ' 项业务参数');
  App.renderBusinessParams();
};

// ===== 审计日志 =====
App._auditPage = 1;
App._auditPageSize = 20;
App._auditTotal = 0;

App.fetchAuditLogs = function() {
  var action = (document.getElementById('aAuditActionSel') || {}).value || '';
  var keyword = ((document.getElementById('aAuditSearch') || {}).value || '').trim();
  var params = 'page=' + App._auditPage + '&size=' + App._auditPageSize;
  if (action) params += '&action=' + encodeURIComponent(action);
  if (keyword) params += '&keyword=' + encodeURIComponent(keyword);

  fetch('/api/audit/logs?' + params)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.data) {
        App._auditData = data.data;
        App._auditTotal = data.total || 0;
      } else {
        App._auditData = [];
        App._auditTotal = 0;
      }
      App.renderAuditLog();
    }).catch(function() {
      // 后端不可用，仅使用本地日志
      App._auditData = [];
      App._auditTotal = 0;
      App.renderAuditLog();
    });
};

App.renderAuditLog = function() {
  var tbody = document.getElementById('aAuditTableBody');
  if (!tbody) return;

  // 始终合并实时本地日志（避免 fetchAuditLogs 的缓存副本漏掉新增日志）
  var liveLogs = App.operationLogs || [];
  var backendData = App._auditData || [];
  var seen = {};
  backendData.forEach(function(l) { seen[l.time + l.user + l.action] = true; });
  var merged = backendData.slice();
  liveLogs.forEach(function(l) {
    if (!seen[l.time + l.user + l.action]) {
      merged.unshift(l);
      seen[l.time + l.user + l.action] = true;
    }
  });
  // 按时间倒序
  merged.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });

  // 客户端筛选（始终生效：后端返回的数据已筛选，这里再筛本地合并的日志 + 兜底）
  var selAction = (document.getElementById('aAuditActionSel') || {}).value || '';
  var selKeyword = ((document.getElementById('aAuditSearch') || {}).value || '').trim().toLowerCase();

  if (selAction) {
    merged = merged.filter(function(l) { return l.action === selAction; });
  }
  if (selKeyword) {
    merged = merged.filter(function(l) {
      return (l.user || '').toLowerCase().indexOf(selKeyword) >= 0 ||
             (l.name || '').toLowerCase().indexOf(selKeyword) >= 0 ||
             (l.target || '').toLowerCase().indexOf(selKeyword) >= 0 ||
             (l.detail || '').toLowerCase().indexOf(selKeyword) >= 0;
    });
  }

  var data = merged;
  var total = data.length;
  var countEl = document.getElementById('aAuditCount');
  if (countEl) countEl.textContent = total + ' 条记录';

  // 分页
  var page = App._auditPage;
  var size = App._auditPageSize;
  var totalPages = Math.ceil(total / size) || 1;
  var start = (page - 1) * size;
  var pageData = data.slice(start, start + size);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">📋 暂无审计日志</td></tr>';
  } else {
    tbody.innerHTML = pageData.map(function(l) {
      return '<tr>' +
        '<td class="cu-c" style="font-size:11px;white-space:nowrap">' + (l.time || '') + '</td>' +
        '<td><strong>' + (l.name || '系统') + '</strong><div style="font-size:10px;color:#94a3b8">' + (l.user || '-') + '</div></td>' +
        '<td class="cu-c">' + App._auditActionBadge(l.action) + '</td>' +
        '<td>' + (l.target || '-') + '</td>' +
        '<td style="font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (l.detail || '') + '">' + (l.detail || '-') + '</td>' +
        '<td class="cu-c" style="font-size:10px;color:#94a3b8">' + (l.ip || '127.0.0.1') + '</td>' +
        '</tr>';
    }).join('');
  }

  // 渲染分页器
  App._renderAuditPager(total, page, size, totalPages);
};

App._auditActionBadge = function(action) {
  var map = {
    '用户登录':  { bg:'#dbeafe', color:'#1e40af', icon:'🔑' },
    '用户登出':  { bg:'#f1f5f9', color:'#64748b', icon:'🚪' },
    '页面切换':  { bg:'#f1f5f9', color:'#475569', icon:'👁' },
    '数据导入':  { bg:'#fef3c7', color:'#92400e', icon:'📥' },
    '数据导出':  { bg:'#dcfce7', color:'#166534', icon:'📤' },
    '新增用户':  { bg:'#dcfce7', color:'#166534', icon:'➕' },
    '编辑用户':  { bg:'#fef3c7', color:'#92400e', icon:'✏️' },
    '删除用户':  { bg:'#fee2e2', color:'#991b1b', icon:'🗑' },
    '修改密码':  { bg:'#fee2e2', color:'#991b1b', icon:'🔒' },
    '角色保存':  { bg:'#dbeafe', color:'#1e40af', icon:'🔐' },
    '创建备份':  { bg:'#dbeafe', color:'#1e40af', icon:'💾' },
    '恢复备份':  { bg:'#fef3c7', color:'#92400e', icon:'⏪' },
    '删除备份':  { bg:'#fee2e2', color:'#991b1b', icon:'🗑' },
    '筛选查询':  { bg:'#f0f4ff', color:'#3730a3', icon:'🔍' },
    '删除数据':  { bg:'#fee2e2', color:'#991b1b', icon:'🗑' },
    '修改参数':  { bg:'#fef3c7', color:'#92400e', icon:'⚙' },
    '系统启动':  { bg:'#f1f5f9', color:'#475569', icon:'⚡' },
  };
  var s = map[action] || { bg:'#f1f5f9', color:'#475569', icon:'📌' };
  return '<span style="display:inline-flex;align-items:center;gap:4px;background:' + s.bg + ';color:' + s.color + ';padding:2px 10px;border-radius:12px;font-size:11px;font-weight:500;white-space:nowrap">' + s.icon + ' ' + action + '</span>';
};

App._renderAuditPager = function(total, page, size, totalPages) {
  var pager = document.getElementById('aAuditPager');
  if (!pager) return;
  var html = '<span style="font-size:11px;color:#94a3b8">共 ' + total + ' 条</span>';
  html += '<select onchange="App._auditPageSize=parseInt(this.value);App._auditPage=1;App.fetchAuditLogs()" style="border:1px solid #e2e8f0;border-radius:4px;padding:2px 6px;font-size:11px;margin:0 8px">';
  [10,20,50,100].forEach(function(s) {
    html += '<option value="' + s + '"' + (size === s ? ' selected' : '') + '>' + s + ' 条/页</option>';
  });
  html += '</select>';

  html += '<div style="display:flex;gap:4px;align-items:center">';
  html += '<button class="cu-pgbtn nav" onclick="App._auditPage=1;App.fetchAuditLogs()"' + (page <= 1 ? ' disabled' : '') + '>«</button>';
  html += '<button class="cu-pgbtn nav" onclick="App._auditPage=Math.max(1,App._auditPage-1);App.fetchAuditLogs()"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';

  var pStart = Math.max(1, page - 2);
  var pEnd = Math.min(totalPages, page + 2);
  if (pStart > 1) html += '<button class="cu-pgbtn" onclick="App._auditPage=1;App.fetchAuditLogs()">1</button>';
  if (pStart > 2) html += '<span class="cu-pgdot">…</span>';

  for (var i = pStart; i <= pEnd; i++) {
    html += '<button class="cu-pgbtn' + (i === page ? ' active' : '') + '" onclick="App._auditPage=' + i + ';App.fetchAuditLogs()">' + i + '</button>';
  }

  if (pEnd < totalPages - 1) html += '<span class="cu-pgdot">…</span>';
  if (pEnd < totalPages) html += '<button class="cu-pgbtn" onclick="App._auditPage=' + totalPages + ';App.fetchAuditLogs()">' + totalPages + '</button>';

  html += '<button class="cu-pgbtn nav" onclick="App._auditPage=Math.min(' + totalPages + ',App._auditPage+1);App.fetchAuditLogs()"' + (page >= totalPages ? ' disabled' : '') + '>›</button>';
  html += '<button class="cu-pgbtn nav" onclick="App._auditPage=' + totalPages + ';App.fetchAuditLogs()"' + (page >= totalPages ? ' disabled' : '') + '>»</button>';
  html += '</div>';

  pager.innerHTML = html;
};

App.exportAuditLog = function() {
  // 导出时拉取全部数据
  fetch('/api/audit/logs?page=1&size=10000')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var logs = (data && data.data) ? data.data : App._auditData || [];
      var csv = '﻿"时间","操作用户","操作类型","操作对象","详情","IP"\n' +
        logs.map(function(l) { return '"' + [l.time, (l.name||'')+'('+(l.user||'')+')', l.action, l.target, l.detail, l.ip].join('","') + '"'; }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '审计日志_' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      App.addLog('数据导出', '审计日志', '导出 ' + logs.length + ' 条审计日志');
    }).catch(function() {
      alert('导出失败，请检查后端服务是否运行');
    });
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
  App.renderAdminUsers();
  App.fetchAuditLogs();  // 每次打开 Admin 面板时重新拉取 + 合并本地日志
};
App.operationLogs = [];

App.addLog = function(action, target, detail) {
  var now = new Date();
  var t = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  var entry = {
    time: t,
    user: (App.loggedInUser || {}).username || '-',
    name: (App.loggedInUser || {}).name || '系统',
    action: action,
    target: target || '',
    detail: detail || '',
    ip: '127.0.0.1'
  };

  // 写入本地内存缓存
  App.operationLogs.unshift(entry);
  if (App.operationLogs.length > 500) App.operationLogs.length = 500;

  // 持久化到 localStorage（刷新不丢失）
  try {
    var stored = JSON.parse(localStorage.getItem('pa_audit_logs') || '[]');
    stored.unshift(entry);
    if (stored.length > 500) stored = stored.slice(0, 500);
    localStorage.setItem('pa_audit_logs', JSON.stringify(stored));
  } catch(e) {}

  // 持久化到后端（带认证 token）
  var headers = { 'Content-Type': 'application/json' };
  try {
    var token = sessionStorage.getItem('pa_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  } catch(e) {}
  fetch('/api/audit/logs', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ action: action, target: target || '', detail: detail || '', time: t })
  }).catch(function() {});

  // 如果审计日志页面当前可见，实时刷新
  if (document.getElementById('aAuditTableBody')) {
    App.renderAuditLog();
  }
};

// 自动记录关键操作
(function() {
  var origDoLogout = App.doLogout;
  App.doLogout = function() {
    if (App.loggedInUser) {
      App.addLog('用户登出', '系统', App.loggedInUser.name + ' 退出系统');
    }
    origDoLogout.apply(this, arguments);
  };
})();

// ===== 数据备份与导出辅助函数 =====
App.createBackup = function(btype) {
  btype = btype || 'full';
  var labels = { accounts: '账号备份', data: '数据备份', full: '全量备份' };
  App.API.createBackup(btype).then(function(r) {
    alert('✅ ' + labels[btype] + ' 创建成功!\n\n文件: ' + r.filename + '\n大小: ' + (r.size_bytes / 1024).toFixed(1) + ' KB\n类型: ' + (r.type || btype));
    App.addLog('创建备份', r.filename, '创建' + labels[btype] + '，大小 ' + (r.size_bytes / 1024).toFixed(1) + ' KB');
    App.showBackupModal();
  }).catch(function(err) {
    alert('❌ 备份失败: ' + (err.message || '未知错误') + '\n\n请检查:\n1. 后端服务是否已启动 (python start.py)\n2. 当前账号是否有管理员权限\n3. backups 目录是否存在');
  });
};

// 备份管理弹窗
App.showBackupModal = function() {
  var h = '<div style="margin-bottom:12px;font-size:13px;color:#64748b">选择备份范围，创建后将保存到服务器并可下载到本地</div>';
  h += '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">';

  // 三种备份按钮
  h += '<button onclick="App.createBackup(\'accounts\')" style="padding:10px 16px;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500" title="部门、小组、用户账号">👤 账号备份</button>';
  h += '<button onclick="App.createBackup(\'data\')" style="padding:10px 16px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500" title="产品字典、销售数据、导入记录">📊 数据备份</button>';
  h += '<button onclick="App.createBackup(\'full\')" style="padding:10px 16px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500" title="账号+数据+审计日志">📦 全量备份</button>';

  // 导入
  h += '<label style="padding:10px 16px;background:#eff6ff;color:#2563eb;border:1px solid #dbeafe;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;display:inline-flex;align-items:center">📥 导入恢复<input type="file" accept=".json" onchange="App.importBackupFile(this)" style="display:none"></label>';

  h += '</div>';

  // 备份列表
  h += '<div id="backupModalList" style="max-height:300px;overflow-y:auto;font-size:13px">加载中...</div>';

  App.showModal('💾 数据备份与恢复', h, '');
  App.loadBackupModalList();
};

// 加载备份列表到弹窗
App.loadBackupModalList = function() {
  var area = document.getElementById('backupModalList');
  if (!area) return;
  App.API.listBackups().then(function(list) {
    if (!Array.isArray(list) || list.length === 0) {
      area.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8">暂无备份记录</div>';
      return;
    }
    var typeBadge = function(t, label) {
      var map = { accounts: { bg:'#dbeafe',c:'#1e40af',l:'👤 账号' }, data: { bg:'#fef3c7',c:'#92400e',l:'📊 数据' }, full: { bg:'#dcfce7',c:'#16a34a',l:'📦 全量' } };
      var s = map[t] || { bg:'#f1f5f9',c:'#64748b',l: label || t || '未知' };
      return '<span style="display:inline-block;padding:2px 8px;background:'+s.bg+';color:'+s.c+';border-radius:4px;font-size:10px;font-weight:600">'+s.l+'</span>';
    };
    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:2px solid #e5e7eb">';
    html += '<th style="padding:8px;text-align:left">类型</th><th style="padding:8px;text-align:left">文件名</th><th style="padding:8px;text-align:left;width:80px">大小</th><th style="padding:8px;text-align:right;width:180px">操作</th></tr></thead><tbody>';
    list.forEach(function(b) {
      html += '<tr style="border-bottom:1px solid #f1f5f9">';
      html += '<td style="padding:8px">' + typeBadge(b.type || 'full', b.type_label) + '</td>';
      html += '<td style="padding:8px;font-size:11px">' + b.filename + '</td>';
      html += '<td style="padding:8px">' + (b.size_bytes / 1024).toFixed(1) + ' KB</td>';
      html += '<td style="padding:8px;text-align:right">';
      html += '<a style="color:#2563eb;cursor:pointer;margin-right:8px;font-size:11px" onclick="App.downloadBackup(\'' + b.filename + '\')">📥 下载</a>';
      html += '<a style="color:#16a34a;cursor:pointer;margin-right:8px;font-size:11px" onclick="App.restoreBackupModal(\'' + b.filename + '\')">🔄 恢复</a>';
      html += '<a style="color:#dc2626;cursor:pointer;font-size:11px" onclick="App.removeBackupModal(\'' + b.filename + '\')">🗑 删除</a>';
      html += '</td></tr>';
    });
    html += '</tbody></table>';
    area.innerHTML = html;
  }).catch(function() {
    area.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8">⚠️ 无法连接后端，无法获取备份列表</div>';
  });
};

// 下载备份文件（用 fetch + blob 方式，可带 auth header）
App.downloadBackup = function(filename) {
  var token = null;
  try { token = sessionStorage.getItem('pa_token'); } catch(e) {}
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  fetch('/api/backup/download/' + encodeURIComponent(filename), { headers: headers })
    .then(function(r) {
      if (!r.ok) throw new Error('下载失败 (' + r.status + ')');
      return r.blob();
    })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.addLog('数据导出', filename, '下载备份文件');
    })
    .catch(function(err) {
      alert('❌ 下载失败: ' + err.message + '\n\n请确保后端服务已启动且你有管理员权限');
    });
};

// 恢复备份（从弹窗）
App.restoreBackupModal = function(filename) {
  if (!confirm('确定从备份 ' + filename + ' 恢复数据？当前数据将被覆盖！')) return;
  App.API.restoreBackup(filename).then(function() {
    App.addLog('恢复备份', filename, '从备份文件恢复数据');
    alert('✅ 数据恢复成功！页面将刷新。');
    location.reload();
  }).catch(function(err) {
    alert('恢复失败: ' + err.message);
  });
};

// 删除备份（从弹窗）
App.removeBackupModal = function(filename) {
  if (!confirm('确定删除备份 ' + filename + '？')) return;
  App.API.deleteBackup(filename).then(function() {
    App.addLog('删除备份', filename, '删除备份文件');
    App.loadBackupModalList();
  }).catch(function(err) {
    alert('删除失败: ' + err.message);
  });
};

// 导入备份文件
App.importBackupFile = function(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (!confirm('确定从文件 ' + file.name + ' 恢复数据？当前数据将被覆盖！')) { input.value = ''; return; }
  App.API.uploadBackup(file).then(function(r) {
    App.addLog('恢复备份', file.name, '从上传文件恢复数据');
    alert('✅ 数据恢复成功！页面将刷新。');
    location.reload();
  }).catch(function(err) {
    alert('❌ 导入失败: ' + err.message);
  });
  input.value = '';
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
    App.addLog('恢复备份', filename, '从备份文件恢复数据');
    alert('数据恢复成功！请刷新页面查看。');
    location.reload();
  }).catch(function(err) {
    alert('恢复失败: ' + err.message);
  });
};

App.removeBackup = function(filename) {
  if (!confirm('确定删除备份 ' + filename + '？')) return;
  App.API.deleteBackup(filename).then(function() {
    App.addLog('删除备份', filename, '删除备份文件');
    App.loadBackupList();
  }).catch(function(err) {
    alert('删除失败: ' + err.message);
  });
};

// （已移除废弃的 _ovDimData / onOvDimChange / _ovBarDim / setOvBarDim — 图表维度由级联筛选自动判定）

// 从导入数据按部门聚合平均产品宽度
App._computeAvgWidthByDept = function() {
  var map = {};
  (App.ImportData.UserGS || []).forEach(function(r) {
    var d = r.dept || r.group || '未分组';
    if (!map[d]) map[d] = { total: 0, count: 0 };
    map[d].total += (r.width || 0);
    map[d].count++;
  });
  return map;
};
// 从导入数据按组聚合平均产品宽度
App._computeAvgWidthByGroup = function() {
  var map = {};
  (App.ImportData.UserGS || []).forEach(function(r) {
    var g = r.group || r.dept || '未分组';
    if (!map[g]) map[g] = { total: 0, count: 0 };
    map[g].total += (r.width || 0);
    map[g].count++;
  });
  return map;
};

// 通用：根据筛选器级联状态更新柱状图（全部 → 部门 → 小组 → 个人），供总览页和产品宽度页复用
App._updateDimBarChart = function(pageId, chartKey) {
  var state = App.getFilterState(pageId);
  var team = state.team, group = state.group, person = state.person;
  var labels, widthData;

  if (person !== 'all') {
    // 按该销售负责的客户/用户聚合平均宽度
    labels = [person];
    var personTotal = 0, personCount = 0;
    (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
      if (r.sales === person) { personTotal += (r.width || 0); personCount++; }
    });
    widthData = personCount > 0 ? [parseFloat((personTotal / personCount).toFixed(2))] : [0];
  } else if (group !== 'all') {
    // 按销售聚合该组下各销售的平均宽度
    var byGroup = {};
    (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
      if (r.group === group || r.dept === group) {
        var key = r.sales || r.user || r.name || '未知';
        if (!byGroup[key]) byGroup[key] = { total: 0, count: 0 };
        byGroup[key].total += (r.width || 0);
        byGroup[key].count++;
      }
    });
    labels = Object.keys(byGroup);
    widthData = labels.map(function(n) {
      var m = byGroup[n];
      return m.count > 0 ? parseFloat((m.total / m.count).toFixed(2)) : 0;
    });
    if (labels.length === 0) { labels = [group]; widthData = [0]; }
  } else if (team !== 'all') {
    // 选部门时：根据维度按钮切换「部门汇总」或「组展开」
    var ovWantGroup = (pageId === 'page-overview' && App._ovWidthDim === 'group') ||
                      (pageId === 'page-width' && App._wWidthDim === 'group');
    if (ovWantGroup) {
      // 按小组聚合该部门下各组的平均宽度
      var grps2 = App.GROUPS.filter(function(g) { return g.dept === team; });
      if (grps2.length) {
        var byDept = {};
        (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
          if (r.dept === team) {
            var key = r.group || r.dept;
            if (!byDept[key]) byDept[key] = { total: 0, count: 0 };
            byDept[key].total += (r.width || 0);
            byDept[key].count++;
          }
        });
        labels = grps2.map(function(g) { return g.n; });
        widthData = grps2.map(function(g) {
          var m = byDept[g.n];
          return m && m.count > 0 ? parseFloat((m.total / m.count).toFixed(2)) : 0;
        });
      } else {
        labels = [team];
        var m2 = App._computeAvgWidthByDept()[team];
        widthData = m2 && m2.count > 0 ? [parseFloat((m2.total / m2.count).toFixed(2))] : [0];
      }
    } else {
      // 部门汇总：只显示该部门一根柱子
      var deptTotal = 0, deptCount = 0;
      (App.ImportData.UserGS || []).concat(App.ImportData.CustGS || []).forEach(function(r) {
        if (r.dept === team) { deptTotal += (r.width || 0); deptCount++; }
      });
      labels = [team];
      widthData = deptCount > 0 ? [parseFloat((deptTotal / deptCount).toFixed(2))] : [0];
    }
  } else {
    // 全部状态（无筛选）：按部门或组维度展示
    var showGroups = (pageId === 'page-overview' && App._ovWidthDim === 'group') ||
                     (pageId === 'page-width' && App._wWidthDim === 'group');
    if (showGroups) {
      var bg = App._computeAvgWidthByGroup();
      labels = App.GROUPS.map(function(g) { return g.n; });
      widthData = App.GROUPS.map(function(g) {
        var m = bg[g.n];
        return m && m.count > 0 ? parseFloat((m.total / m.count).toFixed(2)) : 0;
      });
    } else {
      var bd = App._computeAvgWidthByDept();
      labels = App.BUSINESS_DEPTS.map(function(d) { return d.n; });
      widthData = App.BUSINESS_DEPTS.map(function(d) {
        var m = bd[d.n];
        return m && m.count > 0 ? parseFloat((m.total / m.count).toFixed(2)) : 0;
      });
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
    // 用数据总览自己的筛选器（不依赖 page-potential 的 getFilteredPotData）
    var ovPotCust = (App.ImportPotential.CustRAW || []).slice();
    if (person !== 'all') ovPotCust = ovPotCust.filter(function(r) { return r.sales === person; });
    else if (group !== 'all') ovPotCust = ovPotCust.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
    else if (team !== 'all') ovPotCust = ovPotCust.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
    var pAgg = {};
    ovPotCust.forEach(function(r) {
      if (!r.product) return;
      pAgg[r.product] = (pAgg[r.product] || 0) + (r.amount || 0);
    });
    var prodLabels = Object.keys(pAgg).sort(function(a, b) { return pAgg[b] - pAgg[a]; });
    if (prodLabels.length === 0) prodLabels = App.ALL_POT_PRODUCTS.slice(0, 11);
    var prodSales = prodLabels.map(function(p) { return Math.round(pAgg[p] || 0); });
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
  // 从导入数据计算覆盖率排名（跟随筛选联动）
  var allProds = App.ImportData.PRODS || [];
  var fCust2 = (App.ImportData.CustGS || []).slice();
  var fUser2 = (App.ImportData.UserGS || []).slice();
  // 级联筛选
  var periodSel = document.getElementById('wImportPeriodFilter');
  var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' ? periodSel.value : '') : '';
  if (periodFilter) {
    fCust2 = fCust2.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
    fUser2 = fUser2.filter(function(r) { return (r.snapshotPeriod || '') === periodFilter; });
  }
  if (person !== 'all') {
    fCust2 = fCust2.filter(function(r) { return r.sales === person; });
    fUser2 = fUser2.filter(function(r) { return r.sales === person; });
  } else if (group !== 'all') {
    fCust2 = fCust2.filter(function(r) { return r.group === group; });
    fUser2 = fUser2.filter(function(r) { return r.group === group; });
  } else if (team !== 'all') {
    fCust2 = fCust2.filter(function(r) { return r.dept === team; });
    fUser2 = fUser2.filter(function(r) { return r.dept === team; });
  }
  var custTotal = fCust2.length, userTotal = fUser2.length;
  App.setText('w-cust-scale-count', custTotal);
  App.setText('w-user-scale-count', userTotal);
  // 计算上月（环比）和去年同月（同比）
  var prevPeriod = '', yoyPeriod = '';
  if (periodFilter && periodFilter.indexOf('-') > 0) {
    var parts = periodFilter.split('-');
    var y = parseInt(parts[0]), m = parseInt(parts[1]);
    // 上月
    var py = y, pm = m;
    if (pm === 1) { py--; pm = 12; } else { pm--; }
    prevPeriod = py + '-' + String(pm).padStart(2, '0');
    // 去年同月
    yoyPeriod = (y - 1) + '-' + String(m).padStart(2, '0');
  }
  var fCustPrev = prevPeriod ? (App.ImportData.CustGS || []).filter(function(r) { return (r.snapshotPeriod || '') === prevPeriod; }) : [];
  var fUserPrev = prevPeriod ? (App.ImportData.UserGS || []).filter(function(r) { return (r.snapshotPeriod || '') === prevPeriod; }) : [];
  var fCustYoy = yoyPeriod ? (App.ImportData.CustGS || []).filter(function(r) { return (r.snapshotPeriod || '') === yoyPeriod; }) : [];
  var fUserYoy = yoyPeriod ? (App.ImportData.UserGS || []).filter(function(r) { return (r.snapshotPeriod || '') === yoyPeriod; }) : [];
  // 应用同样的部门/组/人员筛选
  var applyFilter = function(arr) {
    if (person !== 'all') return arr.filter(function(r) { return r.sales === person; });
    if (group !== 'all') return arr.filter(function(r) { return r.group === group; });
    if (team !== 'all') return arr.filter(function(r) { return r.dept === team; });
    return arr;
  };
  fCustPrev = applyFilter(fCustPrev); fUserPrev = applyFilter(fUserPrev);
  fCustYoy = applyFilter(fCustYoy); fUserYoy = applyFilter(fUserYoy);
  var custPrevTotal = fCustPrev.length, userPrevTotal = fUserPrev.length;
  var custYoyTotal = fCustYoy.length, userYoyTotal = fUserYoy.length;
  var custHasPrevData = prevPeriod && custPrevTotal > 0;
  var custHasYoyData = yoyPeriod && custYoyTotal > 0;
  var userHasPrevData = prevPeriod && userPrevTotal > 0;
  var userHasYoyData = yoyPeriod && userYoyTotal > 0;
  // 计算每个产品的品类覆盖率 + 环比 + 同比
  var custRank = allProds.map(function(p) {
    var cnt = fCust2.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var rate = custTotal > 0 ? parseFloat((cnt / custTotal * 100).toFixed(1)) : 0;
    var cntPrev = fCustPrev.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var ratePrev = custPrevTotal > 0 ? parseFloat((cntPrev / custPrevTotal * 100).toFixed(1)) : 0;
    var cntYoy = fCustYoy.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var rateYoy = custYoyTotal > 0 ? parseFloat((cntYoy / custYoyTotal * 100).toFixed(1)) : 0;
    return { name: p, count: cnt, rate: rate, diff: custHasPrevData ? parseFloat((rate - ratePrev).toFixed(1)) : null, yoy: custHasYoyData ? parseFloat((rate - rateYoy).toFixed(1)) : null } }).sort(function(a, b) { return b.rate - a.rate; });
  var userRank = allProds.map(function(p) {
    var cnt = fUser2.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var rate = userTotal > 0 ? parseFloat((cnt / userTotal * 100).toFixed(1)) : 0;
    var cntPrev = fUserPrev.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var ratePrev = userPrevTotal > 0 ? parseFloat((cntPrev / userPrevTotal * 100).toFixed(1)) : 0;
    var cntYoy = fUserYoy.filter(function(r) { return r.prods && r.prods[p]; }).length;
    var rateYoy = userYoyTotal > 0 ? parseFloat((cntYoy / userYoyTotal * 100).toFixed(1)) : 0;
    return { name: p, count: cnt, rate: rate, diff: userHasPrevData ? parseFloat((rate - ratePrev).toFixed(1)) : null, yoy: userHasYoyData ? parseFloat((rate - rateYoy).toFixed(1)) : null } }).sort(function(a, b) { return b.rate - a.rate; });

  var tbody1 = document.getElementById('wProdCovCustBody');
  if (tbody1) {
    tbody1.innerHTML = custRank.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      var diffHtml = p.diff !== null ? (p.diff > 0 ? '<span style="color:#dc2626">+' + p.diff + '%</span>' : p.diff < 0 ? '<span style="color:#16a34a">' + p.diff + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
      var yoyHtml = p.yoy !== null ? (p.yoy > 0 ? '<span style="color:#dc2626">+' + p.yoy + '%</span>' : p.yoy < 0 ? '<span style="color:#16a34a">' + p.yoy + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
      return '<tr style="cursor:pointer" onclick="App.showProdCovDrill(\'' + p.name + '\',\'cust\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + p.count + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + (p.rate >= 50 ? '#059669' : p.rate >= 20 ? '#d97706' : '#dc2626') + '">' + p.rate.toFixed(1) + '%</td>' +
        '<td style="text-align:center;font-size:12px">' + diffHtml + '</td>' +
        '<td style="text-align:center;font-size:12px">' + yoyHtml + '</td></tr>';
    }).join('');
  }

  var tbody2 = document.getElementById('wProdCovUserBody');
  if (tbody2) {
    tbody2.innerHTML = userRank.map(function(p, i) {
      var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
      var diffHtml = p.diff !== null ? (p.diff > 0 ? '<span style="color:#dc2626">+' + p.diff + '%</span>' : p.diff < 0 ? '<span style="color:#16a34a">' + p.diff + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
      var yoyHtml = p.yoy !== null ? (p.yoy > 0 ? '<span style="color:#dc2626">+' + p.yoy + '%</span>' : p.yoy < 0 ? '<span style="color:#16a34a">' + p.yoy + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
      return '<tr style="cursor:pointer" onclick="App.showProdCovDrill(\'' + p.name + '\',\'user\')">' +
        '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
        '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
        '<td style="text-align:center">' + p.count + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + (p.rate >= 50 ? '#059669' : p.rate >= 20 ? '#d97706' : '#dc2626') + '">' + p.rate.toFixed(1) + '%</td>' +
        '<td style="text-align:center;font-size:12px">' + diffHtml + '</td>' +
        '<td style="text-align:center;font-size:12px">' + yoyHtml + '</td></tr>';
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
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '1000px'; modalBox.style.width = '92%'; }
  // 从导入数据直接取覆盖该产品的记录，应用当前筛选
  var state = App.getFilterState('page-width');
  var raw = (type === 'cust') ? (App.ImportData.CustGS || []).slice() : (App.ImportData.UserGS || []).slice();
  var periodSel2 = document.getElementById('wImportPeriodFilter');
  var pf = periodSel2 ? (periodSel2.value !== 'all' ? periodSel2.value : '') : '';
  if (pf) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === pf; });
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.sales === state.person; });
  else if (state.group !== 'all') raw = raw.filter(function(r) { return r.group === state.group; });
  else if (state.team !== 'all') raw = raw.filter(function(r) { return r.dept === state.team; });
  var covered = raw.filter(function(r) { return r.prods && r.prods[prodName]; });
  var label = type === 'cust' ? '客户' : '用户';
  var rate = raw.length > 0 ? (covered.length / raw.length * 100).toFixed(1) : '0';

  // 计算环比和同比
  var diffHtml = '', yoyHtml = '';
  if (pf && pf.indexOf('-') > 0) {
    var parts = pf.split('-'), y2 = parseInt(parts[0]), m2 = parseInt(parts[1]);
    var prevP = y2 + '-' + String(m2 === 1 ? 12 : m2 - 1).padStart(2, '0');
    var yoyP = (y2 - 1) + '-' + String(m2).padStart(2, '0');
    var rawPrev = (type === 'cust' ? App.ImportData.CustGS : App.ImportData.UserGS).filter(function(r) { return (r.snapshotPeriod||'') === prevP; });
    var rawYoy = (type === 'cust' ? App.ImportData.CustGS : App.ImportData.UserGS).filter(function(r) { return (r.snapshotPeriod||'') === yoyP; });
    if (state.person !== 'all') { rawPrev = rawPrev.filter(function(r) { return r.sales === state.person; }); rawYoy = rawYoy.filter(function(r) { return r.sales === state.person; }); }
    else if (state.group !== 'all') { rawPrev = rawPrev.filter(function(r) { return r.group === state.group; }); rawYoy = rawYoy.filter(function(r) { return r.group === state.group; }); }
    else if (state.team !== 'all') { rawPrev = rawPrev.filter(function(r) { return r.dept === state.team; }); rawYoy = rawYoy.filter(function(r) { return r.dept === state.team; }); }
    if (rawPrev.length > 0) {
      var cntPrev = rawPrev.filter(function(r) { return r.prods && r.prods[prodName]; }).length;
      var ratePrev = (cntPrev / rawPrev.length * 100).toFixed(1);
      var d = (parseFloat(rate) - parseFloat(ratePrev)).toFixed(1);
      diffHtml = ' | 环比：' + (d > 0 ? '<span style="color:#dc2626">+' + d + '%</span>' : d < 0 ? '<span style="color:#16a34a">' + d + '%</span>' : '<span style="color:#9ca3af">0</span>');
    } else if (rawPrev.length === 0 && prevPeriod) {
      diffHtml = ' | 环比：<span style="color:#9ca3af">/</span>';
    }
    if (rawYoy.length > 0) {
      var cntYoy2 = rawYoy.filter(function(r) { return r.prods && r.prods[prodName]; }).length;
      var rateYoy2 = (cntYoy2 / rawYoy.length * 100).toFixed(1);
      var y = (parseFloat(rate) - parseFloat(rateYoy2)).toFixed(1);
      yoyHtml = ' | 同比：' + (y > 0 ? '<span style="color:#dc2626">+' + y + '%</span>' : y < 0 ? '<span style="color:#16a34a">' + y + '%</span>' : '<span style="color:#9ca3af">0</span>');
    } else {
      yoyHtml = ' | 同比：<span style="color:#9ca3af">/</span>';
    }
  }

  var html = '<p style="margin:0 0 4px;color:#6b7280">筛选范围内共 <strong>' + raw.length + '</strong> 个' + label + '，其中 <strong>' + covered.length + '</strong> 个覆盖了「' + prodName + '」</p>' +
    '<p style="margin:0 0 12px;color:#6b7280;font-size:12px">品类覆盖率：<strong style="color:#1a56db">' + rate + '%</strong>' + diffHtml + yoyHtml + '</p>';
  if (covered.length === 0) {
    html += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无覆盖记录</p>';
  } else {
    html += '<table style="width:100%;table-layout:fixed;font-size:13px;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb">' +
      '<th style="text-align:left;padding:8px 10px">' + label + '名称</th>' +
      '<th style="text-align:left;padding:8px 10px">销售</th>' +
      '<th style="text-align:left;padding:8px 10px">部门</th>' +
      '<th style="text-align:left;padding:8px 10px">小组</th>' +
      '<th style="text-align:center;padding:8px 10px">产品宽度</th></tr></thead><tbody>';
    covered.forEach(function(r) {
      html += '<tr style="border-bottom:1px solid #f3f4f6">' +
        '<td style="padding:6px 10px;font-weight:600;word-break:break-all">' + (r.user || r.name || '-') + '</td>' +
        '<td style="padding:6px 10px;word-break:break-all">' + (r.sales || '-') + '</td>' +
        '<td style="padding:6px 10px;color:#6b7280;word-break:break-all">' + (r.dept || '-') + '</td>' +
        '<td style="padding:6px 10px;color:#6b7280;word-break:break-all">' + (r.group || '-') + '</td>' +
        '<td style="padding:6px 10px;text-align:center;font-weight:700;color:#1a56db">' + (r.width || 0) + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  App.showModal(prodName + ' — ' + label + '覆盖明细', html);
};

// ===== 潜力产品 · 产品维度 — 产品点击下钻（客户+用户明细，跟随筛选） =====
App.showPotentialProductDrill = function(prodName, type) {
  type = type || 'cust';
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // 统一数据过滤
  var raw = App.getFilteredPotData(type);
  var records, label, totalSet = {}, totalCount, covSet = {}, covCount, amt, rate;
  if (type === 'cust') {
    records = raw.filter(function(r) { return r.product === prodName; });
    label = '客户';
    raw.forEach(function(r) { if (r.custName) totalSet[r.custName] = true; });
    totalCount = Object.keys(totalSet).length;
    records.forEach(function(r) { if (r.custName) covSet[r.custName] = true; });
    covCount = Object.keys(covSet).length;
    amt = records.reduce(function(s, r) { return s + (r.amount || 0); }, 0);
    rate = totalCount > 0 ? (covCount / totalCount * 100).toFixed(1) : '0';
  } else {
    records = raw.filter(function(r) { return r.product === prodName; });
    label = '用户';
    raw.forEach(function(r) { if (r.userName) totalSet[r.userName] = true; });
    totalCount = Object.keys(totalSet).length;
    records.forEach(function(r) { if (r.userName) covSet[r.userName] = true; });
    covCount = Object.keys(covSet).length;
    amt = records.reduce(function(s, r) { return s + (r.outAmt || 0); }, 0);
    rate = totalCount > 0 ? (covCount / totalCount * 100).toFixed(1) : '0';
  }

  var bodyHtml = '<div style="display:flex;gap:24px;margin-bottom:16px;padding:12px 16px;background:#f8fafc;border-radius:8px;font-size:13px;flex-wrap:wrap">' +
    '<div><div style="color:#6b7280;font-size:11px">覆盖' + label + '</div><div style="font-size:18px;font-weight:700;color:#1a56db">' + covCount + ' / ' + totalCount + '</div><div style="font-size:11px;color:#6b7280">覆盖率 ' + rate + '%</div></div>' +
    '<div><div style="color:#6b7280;font-size:11px">' + (type === 'cust' ? '销售额' : '出库额') + '</div><div style="font-size:18px;font-weight:700;color:#7c3aed">¥' + amt.toFixed(0) + '万</div></div>' +
    '</div>';

  if (records.length === 0) {
    bodyHtml += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无覆盖记录</p>';
  } else if (type === 'cust') {
    bodyHtml += '<h4 style="margin:0 0 8px;font-size:14px;color:#374151">👥 客户明细（' + records.length + ' 条）</h4>';
    bodyHtml += '<div style="overflow-x:auto"><table class="modal-table" style="table-layout:auto;font-size:12px"><thead><tr style="background:#f9fafb">' +
      '<th style="white-space:nowrap">客户名称</th><th style="white-space:nowrap">三级部门</th><th style="white-space:nowrap">四级部门</th><th style="white-space:nowrap">销售</th><th style="text-align:right">销售额(万)</th><th style="text-align:right">同期(万)</th></tr></thead><tbody>';
    records.slice(0, 300).forEach(function(r) {
      bodyHtml += '<tr>' +
        '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.custName || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.dept3 || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.dept4 || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.sales || '-') + '</td>' +
        '<td style="text-align:right;font-weight:700;color:#1a56db">' + (r.amount || 0).toFixed(2) + '</td>' +
        '<td style="text-align:right;color:#6b7280">' + (r.amountPrev || 0).toFixed(2) + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';
  } else {
    bodyHtml += '<h4 style="margin:0 0 8px;font-size:14px;color:#374151">🏢 用户明细（' + records.length + ' 条）</h4>';
    bodyHtml += '<div style="overflow-x:auto"><table class="modal-table" style="table-layout:auto;font-size:12px"><thead><tr style="background:#f9fafb">' +
      '<th style="white-space:nowrap">用户名称</th><th style="white-space:nowrap">部门</th><th style="white-space:nowrap">团队</th><th style="white-space:nowrap">销售</th><th style="text-align:right">出库额(万)</th><th style="text-align:right">同期(万)</th></tr></thead><tbody>';
    records.slice(0, 300).forEach(function(r) {
      bodyHtml += '<tr>' +
        '<td style="white-space:nowrap;font-weight:600">' + App.escapeHtml(r.userName || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.dept3 || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.dept4 || '-') + '</td>' +
        '<td style="white-space:nowrap">' + App.escapeHtml(r.sales || '-') + '</td>' +
        '<td style="text-align:right;font-weight:700;color:#059669">' + (r.outAmt || 0).toFixed(2) + '</td>' +
        '<td style="text-align:right;color:#6b7280">' + (r.outAmtPrev || 0).toFixed(2) + '</td></tr>';
    });
    bodyHtml += '</tbody></table></div>';
  }

  App.showModal(prodName + ' — ' + label + '覆盖明细', bodyHtml);
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
  dim = App.ensureValidTeamDim(dim);
  App._scorecardDim = dim;
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

  // ── 从导入数据聚合（优先真实数据）──
  var agg2 = App.aggregateTeamSales();

  if (dim === 'dept') {
    App.BUSINESS_DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var rd = agg2.dept[d.n] || { sales: 0, prev: 0, custSet: {} };
      var yoy = rd.prev > 0 ? ((rd.sales - rd.prev) / rd.prev * 100) : (rd.sales > 0 ? 100 : 0);
      var gt = growthType(yoy);
      rows.push({ dept: d.n, grp: '', name: '', label: d.n, cw: Object.keys(rd.custSet).length, yoy: yoy, gt: gt });
    });
  } else if (dim === 'group') {
    App.getEffectiveGroups(team).forEach(function(g) {
      if (team !== 'all' && g.dept !== team && g.n !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var rg = agg2.group[g.n] || { sales: 0, prev: 0, custSet: {} };
      var yoy = rg.prev > 0 ? ((rg.sales - rg.prev) / rg.prev * 100) : (rg.sales > 0 ? 100 : 0);
      var gt = growthType(yoy);
      rows.push({ dept: g.dept, grp: g.n, name: '', label: g.n, cw: Object.keys(rg.custSet).length, yoy: yoy, gt: gt });
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var rp = agg2.person[p.n] || { sales: 0, prev: 0, custSet: {} };
      var yoy = rp.prev > 0 ? ((rp.sales - rp.prev) / rp.prev * 100) : (rp.sales > 0 ? 100 : 0);
      var gt = growthType(yoy);
      rows.push({ dept: p.dept || '-', grp: p.grp || '-', name: p.n, label: p.n, cw: Object.keys(rp.custSet).length, yoy: yoy, gt: gt });
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
      // ── 从真实数据按客户聚合计算增长分类 ──
      var fCustGrowth = App.getFilteredPotData('cust');
      var custGrowthAgg = {};
      fCustGrowth.forEach(function(rr) {
        var match = false;
        if (dim === 'dept') match = (rr.dept3 === r.dept || rr.dept4 === r.dept);
        else if (dim === 'group') match = (rr.dept5 === r.grp || rr.dept4 === r.grp);
        else match = (rr.sales === r.name);
        if (!match || !rr.custName) return;
        if (!custGrowthAgg[rr.custName]) custGrowthAgg[rr.custName] = { amt: 0, prev: 0 };
        custGrowthAgg[rr.custName].amt += (rr.amount || 0);
        custGrowthAgg[rr.custName].prev += (rr.amountPrev || 0);
      });
      var newCust = 0, deepCust = 0, lostCust = 0;
      Object.values(custGrowthAgg).forEach(function(c) {
        var cy = c.prev > 0 ? ((c.amt - c.prev) / c.prev * 100) : (c.amt > 0 ? 100 : 0);
        if (c.prev === 0 && c.amt > 0) newCust++;
        else if (cy > 0) deepCust++;
        else if (cy > -10) deepCust++;
        else lostCust++;
      });
      var clickTarget = dim === 'dept' ? r.dept : (dim === 'group' ? r.grp : r.name);
      var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : 'App.showPersonDrillModal');
      var clickHandler = 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"';

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
  var available = App.getAvailableTeamDims();
  if (available.indexOf(dim) === -1) return;
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
  dim = App.ensureValidTeamDim(dim);
  App._scorecardDim = dim;
  // 同步两个卡片的按钮active
  ['#p-scorecard-dim-btns','#p-growth-dim-btns'].forEach(function(sel) {
    var btns = document.querySelectorAll(sel + ' .dim-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-dim') === dim); });
  });

  // ── 从导入数据聚合（优先真实数据）──
  var agg = App.aggregateTeamSales();
  var rows = [];

  if (dim === 'dept') {
    App.BUSINESS_DEPTS.forEach(function(d) {
      if (team !== 'all' && d.n !== team) return;
      var rd = agg.dept[d.n] || { sales: 0, prev: 0, prods: {}, custSet: {} };
      var sales = rd.sales;
      var prev = rd.prev;
      var custCnt = Object.keys(rd.custSet).length;
      var yoy = prev > 0 ? ((sales - prev) / prev * 100) : (sales > 0 ? 100 : 0);
      rows.push({ dept: d.n, grp: '', name: '', sales: sales, prev: prev, yoy: yoy, cw: custCnt,
        newProdSales: 0, coverage: 0, newCust: 0 });
    });
  } else if (dim === 'group') {
    App.getEffectiveGroups(team).forEach(function(g) {
      if (team !== 'all' && g.dept !== team && g.n !== team) return;
      if (group !== 'all' && g.n !== group) return;
      var rg = agg.group[g.n] || { sales: 0, prev: 0, prods: {}, custSet: {}, dept: g.dept };
      var sales = rg.sales;
      var prev = rg.prev;
      var custCnt = Object.keys(rg.custSet).length;
      var yoy = prev > 0 ? ((sales - prev) / prev * 100) : (sales > 0 ? 100 : 0);
      rows.push({ dept: g.dept, grp: g.n, name: '', sales: sales, prev: prev, yoy: yoy, cw: custCnt,
        newProdSales: 0, coverage: 0, newCust: 0 });
    });
  } else if (dim === 'person') {
    App.PERSONS.forEach(function(p) {
      if (team !== 'all' && p.dept !== team) return;
      if (group !== 'all' && p.grp !== group) return;
      if (person !== 'all' && p.n !== person) return;
      var rp = agg.person[p.n] || { sales: 0, prev: 0, prods: {}, custSet: {}, dept: p.dept, grp: p.grp };
      var sales = rp.sales;
      var prev = rp.prev;
      var custCnt = Object.keys(rp.custSet).length;
      var yoy = prev > 0 ? ((sales - prev) / prev * 100) : (sales > 0 ? 100 : 0);
      rows.push({ dept: p.dept || '-', grp: p.grp || '-', name: p.n, sales: sales, prev: prev, yoy: yoy, cw: custCnt,
        newProdSales: 0, coverage: 0, newCust: 0 });
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
      var clickFn = dim === 'dept' ? 'App.showDeptDrillModal' : (dim === 'group' ? 'App.showGroupDrillModal' : 'App.showPersonDrillModal');
      var clickHandler = 'onclick="' + clickFn + '(&apos;' + clickTarget + '&apos;)"';
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
    var yoyCls = d.yoy === '新增' ? 'b-new' : (String(d.yoy).indexOf('-') >= 0 ? 'b-down' : 'b-up');
    h += '<tr><td>' + d.cust + '</td><td>' + d.product + '</td><td style="text-align:right">¥' + d.amt + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + d.yoy + '</span></td><td>' + d.note + '</td></tr>';
  });
  h += '</tbody></table>';
  App.showModal(groupName + ' · ' + typeLabel + ' 明细', h);
};

// 部门下钻 → 展示该部门下所有小组
App.showDeptDrillModal = function(deptName) {
  var d = App.BUSINESS_DEPTS.find(function(x) { return x.n === deptName; });
  if (!d) return;
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // ── 从真实数据聚合 ──
  var teamAgg = App.aggregateTeamSales();
  var groups = App.getEffectiveGroups(deptName).filter(function(g) { return g.dept === deptName || g.n === deptName; });
  var state = App.getFilterState('page-potential');
  var totalDeptSales = (teamAgg.dept[deptName] || {}).sales || 0;

  var h = '<h3 style="margin:0 0 8px">🏢 ' + deptName + ' <span style="font-size:13px;color:#6b7280">主管: ' + (d.ld || '-') + ' · ¥' + totalDeptSales.toLocaleString() + '万</span></h3>';
  h += '<table class="table tight-table"><thead><tr><th>小组</th><th style="text-align:center">客户数</th><th style="text-align:right">销售额(万)</th><th style="text-align:center">同比</th><th>主管</th></tr></thead><tbody>';
  groups.forEach(function(g) {
    var rg = teamAgg.group[g.n] || { sales: 0, prev: 0, custSet: {} };
    var custCnt = Object.keys(rg.custSet).length;
    var yoy = rg.prev > 0 ? ((rg.sales - rg.prev) / rg.prev * 100) : (rg.sales > 0 ? 100 : 0);
    var yoyCls = yoy > 10 ? 'b-up' : (yoy < -5 ? 'b-down' : 'b-warn');
    var yoyDisp = (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%';
    h += '<tr style="cursor:pointer" onclick="App.closeModal();App.showGroupDrillModal(\'' + g.n + '\')" title="点击查看' + g.n + '详情">' +
      '<td style="text-decoration:underline;color:#1a56db;font-weight:600">' + g.n + '</td>' +
      '<td style="text-align:center">' + custCnt + '</td>' +
      '<td style="text-align:right;font-weight:700">¥' + rg.sales.toLocaleString() + '万</td>' +
      '<td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td>' +
      '<td>' + (g.ld || '-') + '</td></tr>';
  });
  if (groups.length === 0) {
    h += '<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af">暂无下属小组</td></tr>';
  }
  h += '</tbody></table>';
  App.showModal(deptName + ' 部门详情', h);
};

App.showGroupDrillModal = function(groupName) {
  var g = App.GROUPS.find(function(x) { return x.n === groupName; });
  // 兼容：无小组的部门作为虚拟小组
  if (!g) {
    var vd = App.BUSINESS_DEPTS.find(function(x) { return x.n === groupName; });
    if (vd) g = { n: vd.n, dept: vd.n, ld: vd.ld, cw: vd.cw, cov: vd.cov, yoy: vd.yoy, _virtual: true };
  }
  if (!g) return;
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // ── 从真实数据聚合 ──
  var teamAgg = App.aggregateTeamSales();
  var rg = teamAgg.group[groupName] || { sales: 0, prev: 0, custSet: {}, prods: {} };
  var allProds = teamAgg._allProds.length > 0 ? teamAgg._allProds : App.ALL_POT_PRODUCTS;

  // 该小组成员业绩（从真实数据）
  var members = App.PERSONS.filter(function(p) { return p.grp === groupName; });
  // 虚拟小组：也包含属于该部门但无组的成员
  if (g._virtual) {
    var deptMembers = App.PERSONS.filter(function(p) { return p.dept === groupName && (p.grp === '-' || !p.grp); });
    deptMembers.forEach(function(m) { if (!members.find(function(x) { return x.n === m.n; })) members.push(m); });
  }
  // 补全：成员也包含在数据中出现的无组人员
  Object.keys(teamAgg.person).forEach(function(pName) {
    var rp = teamAgg.person[pName];
    var matchGrp = rp.grp === groupName || (g._virtual && rp.dept === groupName && (!rp.grp || rp.grp === '-'));
    if (matchGrp && !members.find(function(m) { return m.n === pName; })) {
      members.push({ n: pName, dept: rp.dept, grp: rp.grp });
    }
  });

  // 产品明细
  var prodTotal = 0;
  Object.keys(rg.prods).forEach(function(p) { prodTotal += rg.prods[p] || 0; });

  // 客户清单
  var custs = [];
  var fCust = App.getFilteredPotData('cust');
  fCust.forEach(function(r) {
    if ((r.dept5 === groupName || r.dept4 === groupName) && r.custName) {
      var existing = custs.find(function(c) { return c.name === r.custName; });
      if (existing) { existing.amt += (r.amount || 0); existing.prev += (r.amountPrev || 0); }
      else custs.push({ name: r.custName, amt: r.amount || 0, prev: r.amountPrev || 0 });
    }
  });
  custs.sort(function(a, b) { return b.amt - a.amt; });

  var h = '<div style="max-height:70vh;overflow-y:auto">';
  h += '<h3 style="margin:0 0 8px">📋 ' + groupName + ' <span style="font-size:13px;color:#6b7280">' + g.dept + ' · ¥' + rg.sales.toLocaleString() + '万</span></h3>';

  // 1. 产品明细
  h += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">📈 产品销售额明细（共 ¥' + prodTotal.toLocaleString() + '万）</div>';
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
  var prodEntries = Object.keys(rg.prods).sort(function(a, b) { return (rg.prods[b]||0) - (rg.prods[a]||0); });
  if (prodEntries.length === 0) {
    h += '<div style="width:100%;text-align:center;padding:16px;color:#9ca3af">暂无产品数据</div>';
  } else {
    prodEntries.forEach(function(p) {
      var v = rg.prods[p] || 0;
      h += '<div style="width:calc(25% - 3px);background:#f8fafc;border-radius:6px;padding:6px 8px;font-size:11px;cursor:pointer" onclick="App.closeModal();App.showGroupProductDrillModal(\'' + groupName + '\',\'' + p + '\')">';
      h += '<div style="font-weight:600;color:#1a56db">' + p + '</div>';
      h += '<div style="font-weight:700">¥' + v.toLocaleString() + '万</div>';
      h += '</div>';
    });
  }
  h += '</div></div>';

  // 2. 成员业绩
  h += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">👤 业务员业绩明细（' + members.length + '人）</div>';
  h += '<table class="table tight-table"><thead><tr><th>姓名</th><th style="text-align:center">客户数</th><th style="text-align:right">销售额(万)</th><th style="text-align:center">同比</th></tr></thead><tbody>';
  if (members.length === 0) {
    h += '<tr><td colspan="4" style="text-align:center;padding:16px;color:#9ca3af">暂无成员数据</td></tr>';
  } else {
    members.forEach(function(m) {
      var rp = teamAgg.person[m.n] || { sales: 0, prev: 0, custSet: {} };
      var custCnt = Object.keys(rp.custSet).length;
      var yoy = rp.prev > 0 ? ((rp.sales - rp.prev) / rp.prev * 100) : (rp.sales > 0 ? 100 : 0);
      var yoyCls = yoy > 0 ? 'b-up' : (yoy < -5 ? 'b-down' : 'b-flat');
      h += '<tr><td>' + m.n + '</td><td style="text-align:center">' + custCnt + '</td><td style="text-align:right;font-weight:700;color:#1a56db">¥' + rp.sales.toLocaleString() + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%</span></td></tr>';
    });
  }
  h += '</tbody></table></div>';

  // 3. 客户清单
  h += '<div><div style="font-weight:700;margin-bottom:6px">🏢 客户清单（' + custs.length + '个）</div>';
  h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">销售额(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th></tr></thead><tbody>';
  if (custs.length === 0) {
    h += '<tr><td colspan="4" style="text-align:center;padding:16px;color:#9ca3af">暂无客户数据</td></tr>';
  } else {
    custs.slice(0, 100).forEach(function(c) {
      var yoy = c.prev > 0 ? ((c.amt - c.prev) / c.prev * 100) : (c.amt > 0 ? 100 : 0);
      var yoyCls = yoy > 0 ? 'b-up' : (yoy < -10 ? 'b-down' : 'b-warn');
      var yoyDisp = c.prev > 0 ? ((yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%') : (c.amt > 0 ? '新增' : '-');
      h += '<tr><td>' + App.escapeHtml(c.name) + '</td><td style="text-align:right;font-weight:700">¥' + c.amt.toLocaleString() + '万</td><td style="text-align:right;color:#6b7280">¥' + c.prev.toLocaleString() + '万</td><td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td></tr>';
    });
  }
  h += '</tbody></table></div>';

  h += '</div>';
  App.showModal(groupName + ' 详情', h);
};

App.showGroupProductDrillModal = function(groupName, productName) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  // ── 从真实数据取数（严格按筛选范围）──
  var fCust = App.getFilteredPotData('cust');
  var custs = [];
  fCust.forEach(function(r) {
    if (r.product !== productName) return;
    if (r.dept5 !== groupName && r.dept4 !== groupName) return;
    if (!r.custName) return;
    var existing = custs.find(function(c) { return c.name === r.custName; });
    if (existing) { existing.amt += (r.amount || 0); existing.prev += (r.amountPrev || 0); }
    else custs.push({ name: r.custName, amt: r.amount || 0, prev: r.amountPrev || 0 });
  });
  custs.sort(function(a, b) { return b.amt - a.amt; });

  var totalAmt = custs.reduce(function(s, c) { return s + c.amt; }, 0);
  var h = '<h3 style="margin:0 0 8px">📦 ' + groupName + ' · ' + productName + ' 客户明细 <span style="font-size:13px;color:#6b7280">共' + custs.length + '客户 · ¥' + totalAmt.toLocaleString() + '万</span></h3>';

  if (custs.length === 0) {
    h += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无覆盖客户</p>';
  } else {
    h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">本期(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th><tr></thead><tbody>';
    custs.slice(0, 200).forEach(function(c) {
      var yoy = c.prev > 0 ? ((c.amt - c.prev) / c.prev * 100) : (c.amt > 0 ? 100 : 0);
      var yoyCls = yoy > 0 ? 'b-up' : (yoy < -10 ? 'b-down' : 'b-warn');
      var yoyDisp = c.prev > 0 ? ((yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%') : (c.amt > 0 ? '新增' : '-');
      h += '<tr><td>' + App.escapeHtml(c.name) + '</td>' +
        '<td style="text-align:right;font-weight:700">¥' + c.amt.toLocaleString() + '万</td>' +
        '<td style="text-align:right;color:#6b7280">¥' + c.prev.toLocaleString() + '万</td>' +
        '<td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td></tr>';
    });
    h += '</tbody></table>';
  }
  App.showModal(groupName + ' · ' + productName + ' 客户明细', h);
};

// ===== 个人维度下钻弹窗（差距看板/增长结构中点击个人） =====
App.showPersonDrillModal = function(personName) {
  var p = App.PERSONS.find(function(x) { return x.n === personName; });
  if (!p) return;
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  var teamAgg = App.aggregateTeamSales();
  var rp = teamAgg.person[personName] || { sales: 0, prev: 0, custSet: {}, prods: {}, dept: p.dept, grp: p.grp };
  var custCnt = Object.keys(rp.custSet).length;
  var yoy = rp.prev > 0 ? ((rp.sales - rp.prev) / rp.prev * 100) : (rp.sales > 0 ? 100 : 0);

  var h = '<div style="max-height:70vh;overflow-y:auto">';
  h += '<h3 style="margin:0 0 12px">👤 ' + personName + ' <span style="font-size:13px;color:#6b7280">' + (rp.dept || p.dept || '-') + ' · ' + (rp.grp || p.grp || '-') + '</span></h3>';

  // KPI 摘要
  h += '<div style="display:flex;gap:16px;margin-bottom:16px;padding:12px 16px;background:#f8fafc;border-radius:8px;flex-wrap:wrap">';
  h += '<div><div style="color:#6b7280;font-size:11px">销售额</div><div style="font-size:18px;font-weight:700;color:#1a56db">¥' + rp.sales.toLocaleString() + '万</div></div>';
  h += '<div><div style="color:#6b7280;font-size:11px">同期</div><div style="font-size:18px;font-weight:700;color:#6b7280">¥' + rp.prev.toLocaleString() + '万</div></div>';
  h += '<div><div style="color:#6b7280;font-size:11px">同比</div><div style="font-size:18px;font-weight:700;color:' + (yoy >= 0 ? '#059669' : '#dc2626') + '">' + (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%</div></div>';
  h += '<div><div style="color:#6b7280;font-size:11px">客户数</div><div style="font-size:18px;font-weight:700;color:#7c3aed">' + custCnt + '</div></div>';
  h += '</div>';

  // 产品覆盖明细
  var prodEntries = Object.keys(rp.prods).sort(function(a, b) { return (rp.prods[b]||0) - (rp.prods[a]||0); });
  h += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">📦 产品覆盖（' + prodEntries.length + '个）</div>';
  if (prodEntries.length === 0) {
    h += '<p style="color:#9ca3af;padding:12px">暂无产品数据</p>';
  } else {
    h += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
    prodEntries.forEach(function(pn) {
      h += '<div style="width:calc(25% - 3px);background:#f8fafc;border-radius:6px;padding:6px 8px;font-size:11px">';
      h += '<div style="font-weight:600">' + pn + '</div>';
      h += '<div style="font-weight:700;color:#1a56db">¥' + (rp.prods[pn] || 0).toLocaleString() + '万</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';

  // 客户清单
  var fCust = App.getFilteredPotData('cust');
  var custs = [];
  fCust.forEach(function(r) {
    if (r.sales !== personName || !r.custName) return;
    var existing = custs.find(function(c) { return c.name === r.custName; });
    if (existing) { existing.amt += (r.amount || 0); existing.prev += (r.amountPrev || 0); }
    else custs.push({ name: r.custName, amt: r.amount || 0, prev: r.amountPrev || 0 });
  });
  custs.sort(function(a, b) { return b.amt - a.amt; });

  h += '<div><div style="font-weight:700;margin-bottom:6px">🏢 客户清单（' + custs.length + '个）</div>';
  if (custs.length === 0) {
    h += '<p style="color:#9ca3af;padding:12px">暂无客户数据</p>';
  } else {
    h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">本期(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th></tr></thead><tbody>';
    custs.slice(0, 100).forEach(function(c) {
      var cyoy = c.prev > 0 ? ((c.amt - c.prev) / c.prev * 100) : (c.amt > 0 ? 100 : 0);
      var cyCls = cyoy > 0 ? 'b-up' : (cyoy < -10 ? 'b-down' : 'b-warn');
      var cyDisp = c.prev > 0 ? ((cyoy >= 0 ? '+' : '') + cyoy.toFixed(1) + '%') : (c.amt > 0 ? '新增' : '-');
      h += '<tr><td>' + App.escapeHtml(c.name) + '</td>' +
        '<td style="text-align:right;font-weight:700">¥' + c.amt.toLocaleString() + '万</td>' +
        '<td style="text-align:right;color:#6b7280">¥' + c.prev.toLocaleString() + '万</td>' +
        '<td style="text-align:center"><span class="badge ' + cyCls + '">' + cyDisp + '</span></td></tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div></div>';
  App.showModal(personName + ' 业绩详情', h);
};

// ===== 增长结构下钻弹窗（新增客户 / 存量深耕 / 流失预警明细） =====
App.showGrowthDetailModal = function(entityName, typeLabel, count) {
  var modalBox = document.getElementById('appModalBox');
  if (modalBox) { modalBox.style.maxWidth = '95vw'; modalBox.style.width = '96%'; }

  var state = App.getFilterState('page-potential');
  var dim = App._scorecardDim || 'group';
  var fCust = App.getFilteredPotData('cust');

  // 按人员/小组/部门过滤到当前实体
  var filtered = [];
  fCust.forEach(function(r) {
    var match = false;
    if (dim === 'dept') match = (r.dept3 === entityName || r.dept4 === entityName);
    else if (dim === 'group') match = (r.dept5 === entityName || r.dept4 === entityName);
    else match = (r.sales === entityName);
    if (match) filtered.push(r);
  });

  // 按客户聚合，计算同比
  var custAgg = {};
  filtered.forEach(function(r) {
    if (!r.custName) return;
    if (!custAgg[r.custName]) custAgg[r.custName] = { name: r.custName, amt: 0, prev: 0, products: {} };
    custAgg[r.custName].amt += (r.amount || 0);
    custAgg[r.custName].prev += (r.amountPrev || 0);
    if (r.product) custAgg[r.custName].products[r.product] = true;
  });

  var custs = Object.values(custAgg).map(function(c) {
    var yoy = c.prev > 0 ? ((c.amt - c.prev) / c.prev * 100) : (c.amt > 0 ? 100 : 0);
    var growthLabel;
    if (c.prev === 0 && c.amt > 0) growthLabel = '新增客户';
    else if (yoy > 15) growthLabel = '拓客型增长';
    else if (yoy > 0) growthLabel = '存量深耕';
    else if (yoy > -10) growthLabel = '存量深耕';
    else growthLabel = '流失预警';
    return { name: c.name, amt: c.amt, prev: c.prev, yoy: yoy, growth: growthLabel, prodCnt: Object.keys(c.products).length };
  });

  // 按类型筛选
  if (typeLabel === 'new') custs = custs.filter(function(c) { return c.growth === '新增客户'; });
  else if (typeLabel === 'deep') custs = custs.filter(function(c) { return c.growth === '存量深耕' || c.growth === '拓客型增长'; });
  else if (typeLabel === 'lost') custs = custs.filter(function(c) { return c.growth === '流失预警'; });
  custs.sort(function(a, b) { return b.amt - a.amt; });

  var typeName = typeLabel === 'new' ? '新增客户' : (typeLabel === 'deep' ? '存量深耕/拓客增长' : '流失预警');
  var h = '<h3 style="margin:0 0 8px">📊 ' + entityName + ' · ' + typeName + ' <span style="font-size:13px;color:#6b7280">' + custs.length + '个客户</span></h3>';

  if (custs.length === 0) {
    h += '<p style="text-align:center;padding:24px;color:#9ca3af">暂无数据</p>';
  } else {
    h += '<table class="table tight-table"><thead><tr><th>客户</th><th style="text-align:right">本期(万)</th><th style="text-align:right">同期(万)</th><th style="text-align:center">同比</th><th style="text-align:center">覆盖品类</th><th>增长类型</th></tr></thead><tbody>';
    custs.slice(0, 200).forEach(function(c) {
      var yoyCls = c.yoy > 0 ? 'b-up' : (c.yoy < -10 ? 'b-down' : 'b-warn');
      var yoyDisp = c.prev > 0 ? ((c.yoy >= 0 ? '+' : '') + c.yoy.toFixed(1) + '%') : (c.amt > 0 ? '新增' : '-');
      var gCls = c.growth === '新增客户' ? 'b-new' : (c.growth === '流失预警' ? 'b-down' : 'b-up');
      h += '<tr><td>' + App.escapeHtml(c.name) + '</td>' +
        '<td style="text-align:right;font-weight:700">¥' + c.amt.toLocaleString() + '万</td>' +
        '<td style="text-align:right;color:#6b7280">¥' + c.prev.toLocaleString() + '万</td>' +
        '<td style="text-align:center"><span class="badge ' + yoyCls + '">' + yoyDisp + '</span></td>' +
        '<td style="text-align:center">' + c.prodCnt + '</td>' +
        '<td style="text-align:center"><span class="badge ' + gCls + '">' + c.growth + '</span></td></tr>';
    });
    h += '</tbody></table>';
  }
  App.showModal(entityName + ' · ' + typeName, h);
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
    App.BUSINESS_DEPTS.forEach(function(d) { if (team === 'all' || d.n === team) entities.push({ name: d.n, sales: Math.round(d.cw * 42), count: d.cw }); });
  } else if (dim === 'group') {
    App.getEffectiveGroups(team).forEach(function(g) {
      if (team !== 'all' && g.dept !== team && g.n !== team) return;
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
        var yoyCls = c.yoy === '新增' ? 'b-new' : (String(c.yoy).indexOf('-') >= 0 ? 'b-down' : 'b-up');
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
  App.renderCustUserLink(state);
  var team = state.team, group = state.group, person = state.person;
  var dim = App.ensureValidTeamDim(App._custDim || 'person');
  App._custDim = dim;

  // 客户分层卡片渲染
  try { App.renderCustTopBottom(); } catch(e) {}
  if (App.charts.custSegment) {
    setTimeout(function() { App.charts.custSegment.resize(); }, 100);
  }

  // ── 从筛选后数据聚合客户维度 ──
  var fCust = App.getFilteredPotData('cust');
  var prods = App.ALL_POT_PRODUCTS;

  // 按客户聚合
  var custAgg = {};
  fCust.forEach(function(r) {
    if (!r.custName) return;
    if (!custAgg[r.custName]) custAgg[r.custName] = { name: r.custName, totalAmt: 0, prods: {} };
    custAgg[r.custName].totalAmt += r.amount || 0;
    if (r.product) custAgg[r.custName].prods[r.product] = (custAgg[r.custName].prods[r.product] || 0) + (r.amount || 0);
  });

  var custList = Object.values(custAgg).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  // 📊 客户 × 潜力产品交叉矩阵
  var theadM = document.getElementById('pCustMatrixHead');
  var tbody1 = document.getElementById('pCustMatrixBody');

  // 表头：固定首列 "客户" + 动态产品列
  if (theadM) {
    var thM = '<tr><th class="freeze">客户</th>';
    prods.forEach(function(p) {
      thM += '<th class="cu-c" title="' + p + '" style="font-size:10px;white-space:nowrap">' + (p.length > 6 ? p.substring(0,5) + '…' : p) + '</th>';
    });
    thM += '</tr>';
    theadM.innerHTML = thM;
  }

  if (tbody1) {
    var topCusts = custList.slice(0, 15);
    if (topCusts.length === 0) {
      tbody1.innerHTML = '<tr><td colspan="' + (prods.length + 1) + '" style="text-align:center;padding:24px;color:#9ca3af">暂无数据</td></tr>';
    } else {
      var mHtml = '';
      topCusts.forEach(function(c, ci) {
        mHtml += '<tr>';
        // 首列：客户名（sticky 左固定）
        mHtml += '<td class="freeze" style="font-weight:600;font-size:12px;white-space:nowrap">' + App.escapeHtml(c.name) + '</td>';
        prods.forEach(function(p) {
          var v = c.prods[p] || 0;
          if (v > 0) {
            mHtml += '<td class="cu-c" style="font-size:11px;font-weight:600;color:#2563eb">¥' + v.toFixed(2) + '</td>';
          } else {
            mHtml += '<td class="cu-c" style="font-size:11px;color:#d1d5db">-</td>';
          }
        });
        mHtml += '</tr>';
        // hover 时首列背景色
        if (ci === 0) {
          // 首个客户行加 hover 效果（后续行的首列需要 CSS）
        }
      });
      tbody1.innerHTML = mHtml;
    }
  }

  // 🏆 高贡献客户 TOP 10
  var theadT10 = document.getElementById('pCustTop10Head');
  var tbody2 = document.getElementById('pCustTop10Body');

  if (theadT10) {
    theadT10.innerHTML = '<tr><th class="cu-c">#</th><th>客户名称</th><th>覆盖产品</th><th class="cu-r">销售额(万)</th><th class="cu-c">品类数</th></tr>';
  }

  if (tbody2) {
    var top10 = custList.slice(0, 10);
    if (top10.length === 0) {
      tbody2.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af">暂无数据</td></tr>';
    } else {
      tbody2.innerHTML = top10.map(function(c, i) {
        var rankCls = i < 3 ? ['gold','silver','bronze'][i] : '';
        var prodNames = Object.keys(c.prods).sort(function(a, b) { return (c.prods[b]||0) - (c.prods[a]||0); }).slice(0, 5).join('、');
        if (Object.keys(c.prods).length > 5) prodNames += ' 等' + Object.keys(c.prods).length + '个';
        return '<tr>' +
          '<td class="cu-c"><span class="rn ' + rankCls + '">' + (i + 1) + '</span></td>' +
          '<td style="font-weight:600;white-space:nowrap">' + App.escapeHtml(c.name) + '</td>' +
          '<td style="font-size:11px">' + (prodNames || '<span class="dash">-</span>') + '</td>' +
          '<td class="cu-r"><span class="amt">¥' + c.totalAmt.toFixed(2) + '万</span></td>' +
          '<td class="cu-c" style="font-weight:600;color:#2563eb">' + Object.keys(c.prods).length + '</td>' +
          '</tr>';
      }).join('');
    }
  }
};

// ===== 潜力产品 - 用户维度 Tab 动态渲染（跟随页级筛选） =====
App.renderPotentialUserTab = function() {
  var state = App.getFilterState('page-potential');
  App.renderUserCustLink(state);
  try { App.renderUserDimension(); } catch(e) {}

  // ── 从筛选后数据聚合用户维度 ──
  var fUser = App.getFilteredPotData('user');
  var allProds = App.ALL_POT_PRODUCTS;

  // 按用户聚合
  var userAgg = {};
  fUser.forEach(function(r) {
    if (!r.userName) return;
    if (!userAgg[r.userName]) userAgg[r.userName] = { name: r.userName, totalAmt: 0, custSet: {}, prods: {} };
    userAgg[r.userName].totalAmt += r.outAmt || 0;
    if (r.custName) userAgg[r.userName].custSet[r.custName] = true;
    if (r.product) userAgg[r.userName].prods[r.product] = (userAgg[r.userName].prods[r.product] || 0) + (r.outAmt || 0);
  });
  var userList = Object.values(userAgg).sort(function(a, b) { return b.totalAmt - a.totalAmt; });

  // 📊 用户 × 潜力产品交叉矩阵
  var theadUM = document.getElementById('pUserMatrixHead');
  var tbodyUM = document.getElementById('pUserMatrixBody');

  if (theadUM) {
    var thUM = '<tr><th class="freeze">用户</th>';
    allProds.forEach(function(p) {
      thUM += '<th class="cu-c" title="' + p + '" style="font-size:10px;white-space:nowrap">' + (p.length > 6 ? p.substring(0,5) + '…' : p) + '</th>';
    });
    thUM += '</tr>';
    theadUM.innerHTML = thUM;
  }

  if (tbodyUM) {
    var topUsers = userList.slice(0, 15);
    if (topUsers.length === 0) {
      tbodyUM.innerHTML = '<tr><td colspan="' + (allProds.length + 1) + '" style="text-align:center;padding:24px;color:#9ca3af">暂无数据</td></tr>';
    } else {
      var umHtml = '';
      topUsers.forEach(function(u) {
        umHtml += '<tr>';
        umHtml += '<td class="freeze" style="font-weight:600;font-size:12px;white-space:nowrap">' + App.escapeHtml(u.name) + '</td>';
        allProds.forEach(function(p) {
          var v = u.prods[p] || 0;
          if (v > 0) {
            umHtml += '<td class="cu-c" style="font-size:11px;font-weight:600;color:#2563eb">¥' + v.toFixed(2) + '</td>';
          } else {
            umHtml += '<td class="cu-c" style="font-size:11px;color:#d1d5db">-</td>';
          }
        });
        umHtml += '</tr>';
      });
      tbodyUM.innerHTML = umHtml;
    }
  }

  // 📈 最终用户潜力产品推广情况
  var theadP = document.getElementById('pUserPromoHead');
  var tbody1 = document.getElementById('pUserPromoBody');
  var allProds = App.ALL_POT_PRODUCTS;

  if (theadP) {
    theadP.innerHTML = '<tr><th>用户名称</th><th class="cu-c">关联客户</th><th class="cu-c">覆盖产品</th><th class="cu-c">销售额(万)</th><th>品类覆盖明细</th></tr>';
  }

  // 分页
  var promoPageSize = App._promoPageSize || 10;
  var promoTotal = userList.length;
  var promoPages = Math.ceil(promoTotal / promoPageSize);
  if (!App._promoPage || App._promoPage > promoPages) App._promoPage = promoPages || 1;
  var promoStart = (App._promoPage - 1) * promoPageSize;
  var promoRows = userList.slice(promoStart, promoStart + promoPageSize);

  if (tbody1) {
    if (promoRows.length === 0) {
      tbody1.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#9ca3af">暂无数据</td></tr>';
    } else {
      tbody1.innerHTML = promoRows.map(function(u) {
        var custCnt = Object.keys(u.custSet).length;
        var covCnt = Object.keys(u.prods).length;
        // 覆盖/未覆盖产品 chip
        var prodChips = allProds.map(function(p) {
          if (u.prods[p]) return '<span class="chip chip-green" style="font-size:10px;padding:1px 6px;margin:1px">' + p + '</span>';
          else return '<span class="chip" style="font-size:10px;padding:1px 6px;margin:1px;background:#f1f5f9;color:#94a3b8;border:1px solid #e5e7eb">' + p + '</span>';
        }).join('');
        return '<tr>' +
          '<td><div class="cust-name">' + App.escapeHtml(u.name) + '</div></td>' +
          '<td class="cu-c">' + (custCnt > 0 ? '<span class="chip chip-blue">' + custCnt + ' 个</span>' : '<span class="dash">-</span>') + '</td>' +
          '<td class="cu-c"><span class="chip chip-green">' + covCnt + ' / ' + allProds.length + '</span></td>' +
          '<td class="cu-c"><span class="amt">¥' + u.totalAmt.toFixed(2) + '万</span></td>' +
          '<td style="line-height:1.8">' + prodChips + '</td></tr>';
      }).join('');
    }
  }

  // 推广情况分页控件
  var promoPager = document.getElementById('p-promo-pager');
  if (!promoPager) {
    var wrap1 = tbody1 && tbody1.closest('.table-wrap');
    if (wrap1) {
      promoPager = document.createElement('div');
      promoPager.id = 'p-promo-pager';
      promoPager.className = 'cu-bottom';
      wrap1.parentNode.insertBefore(promoPager, wrap1.nextSibling);
    }
  }
  if (promoPager) {
    var ps = promoStart, pe = Math.min(promoStart + promoPageSize, promoTotal);
    var leftH = '每页 <select onchange="App._promoPageSize=parseInt(this.value);App._promoPage=1;App.renderPotentialUserTab()"><option value="10" ' + (promoPageSize === 10 ? 'selected' : '') + '>10</option><option value="20" ' + (promoPageSize === 20 ? 'selected' : '') + '>20</option><option value="50" ' + (promoPageSize === 50 ? 'selected' : '') + '>50</option></select> 条 · 显示 ' + (promoTotal > 0 ? ps + 1 : 0) + '-' + pe + ' / ' + promoTotal;
    var rightH = '';
    if (promoPages > 1) {
      rightH += '<button class="cu-pgbtn nav" onclick="App._promoPage=' + Math.max(1, App._promoPage - 1) + ';App.renderPotentialUserTab()" ' + (App._promoPage <= 1 ? 'disabled' : '') + '>‹</button>';
      var mB = 5, cp = App._promoPage, sp = Math.max(1, cp - Math.floor(mB / 2)), ep = Math.min(promoPages, sp + mB - 1);
      if (ep - sp < mB - 1) sp = Math.max(1, ep - mB + 1);
      if (sp > 1) { rightH += '<button class="cu-pgbtn" onclick="App._promoPage=1;App.renderPotentialUserTab()">1</button>'; if (sp > 2) rightH += '<span class="cu-pgdot">…</span>'; }
      for (var pg2 = sp; pg2 <= ep; pg2++) rightH += '<button class="cu-pgbtn' + (pg2 === cp ? ' active' : '') + '" onclick="App._promoPage=' + pg2 + ';App.renderPotentialUserTab()">' + pg2 + '</button>';
      if (ep < promoPages) { if (ep < promoPages - 1) rightH += '<span class="cu-pgdot">…</span>'; rightH += '<button class="cu-pgbtn" onclick="App._promoPage=' + promoPages + ';App.renderPotentialUserTab()">' + promoPages + '</button>'; }
      rightH += '<button class="cu-pgbtn nav" onclick="App._promoPage=' + Math.min(promoPages, App._promoPage + 1) + ';App.renderPotentialUserTab()" ' + (App._promoPage >= promoPages ? 'disabled' : '') + '>›</button>';
    }
    promoPager.innerHTML = '<span>' + leftH + '</span><div class="cu-pager">' + rightH + '</div>';
  }

};

// ===== 潜力产品 · 产品维度 — 覆盖率排名 =====
// ===== 潜力产品统一数据过滤（月份→人员→小组→部门） =====
App.getFilteredPotData = function(type) {
  var raw = (type === 'cust'
    ? (App.ImportPotential.CustRAW || []).slice()
    : (App.ImportPotential.UserRAW || []).slice());
  var state = App.getFilterState('page-potential');
  var periodSel = document.getElementById('pImportPeriodFilter');
  var pf = periodSel ? (periodSel.value && periodSel.value !== 'all' && periodSel.value !== '无数据' ? periodSel.value : '') : '';

  // ── Layer 1: 角色数据范围（强制，最高优先级）──
  var user = App.loggedInUser || {};
  var role = user.role || 'admin';
  if (role === 'director' || role === 'interface') {
    raw = raw.filter(function(r) { return r.dept3 === user.dept || r.dept4 === user.dept; });
  } else if (role === 'manager') {
    raw = raw.filter(function(r) { return r.dept5 === user.group || (r.dept4 === user.group && r.dept3 === user.dept); });
  } else if (role === 'sales') {
    raw = raw.filter(function(r) { return r.sales === user.username; });
  }
  // admin / gm / operation: 无限制

  // ── Layer 2: 月份筛选 ──
  if (pf) raw = raw.filter(function(r) { return (r.snapshotPeriod || '') === pf; });

  // ── Layer 3: 顶部筛选（在角色范围内进一步缩小）──
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.sales === state.person; });
  else if (state.group !== 'all') raw = raw.filter(function(r) { return r.dept5 === state.group || r.dept4 === state.group; });
  else if (state.team !== 'all') raw = raw.filter(function(r) { return r.dept3 === state.team || r.dept4 === state.team; });
  return raw;
};

// 同上但跳过月份筛选（用于需要跨月聚合的图表，如12月趋势图）
App.getFilteredPotDataAllPeriods = function(type) {
  var raw = (type === 'cust'
    ? (App.ImportPotential.CustRAW || []).slice()
    : (App.ImportPotential.UserRAW || []).slice());
  var state = App.getFilterState('page-potential');

  // ── Layer 1: 角色数据范围（强制，最高优先级）──
  var user = App.loggedInUser || {};
  var role = user.role || 'admin';
  if (role === 'director' || role === 'interface') {
    raw = raw.filter(function(r) { return r.dept3 === user.dept || r.dept4 === user.dept; });
  } else if (role === 'manager') {
    raw = raw.filter(function(r) { return r.dept5 === user.group || (r.dept4 === user.group && r.dept3 === user.dept); });
  } else if (role === 'sales') {
    raw = raw.filter(function(r) { return r.sales === user.username; });
  }

  // ── Layer 2: 顶部筛选（在角色范围内进一步缩小，不按月份）──
  if (state.person !== 'all') raw = raw.filter(function(r) { return r.sales === state.person; });
  else if (state.group !== 'all') raw = raw.filter(function(r) { return r.dept5 === state.group || r.dept4 === state.group; });
  else if (state.team !== 'all') raw = raw.filter(function(r) { return r.dept3 === state.team || r.dept4 === state.team; });
  return raw;
};

App.renderPotentialProductCoverage = function() {
    var state = App.getFilterState('page-potential');
    var team = state.team, group = state.group, person = state.person;

    // 获取产品列表和期间筛选
    var prods = (typeof App.ImportPotential.getProducts === 'function')
      ? App.ImportPotential.getProducts()
      : App.ALL_POT_PRODUCTS;
    var periodSel = document.getElementById('pImportPeriodFilter');
    var periodFilter = periodSel ? (periodSel.value && periodSel.value !== 'all' && periodSel.value !== '无数据' ? periodSel.value : '') : '';

    // 统一数据过滤（月份→人员→小组→部门）
    var fCust = App.getFilteredPotData('cust');
    var fUser = App.getFilteredPotData('user');
    // 读取当前月份（用于环比/同比计算）
    var periodSel2 = document.getElementById('pImportPeriodFilter');
    var periodFilter2 = periodSel2 ? (periodSel2.value && periodSel2.value !== 'all' && periodSel2.value !== '无数据' ? periodSel2.value : '') : '';

    // 计算每个产品的唯�?�客户/用户覆盖数
    // 客�?�数据：按 custName 去重（同一客户同�?�产品只算一�?�）
    var custUnique = {}; // { custName: { product: true } }
    fCust.forEach(function(r) {
      if (r.product && r.custName) {
        if (!custUnique[r.custName]) custUnique[r.custName] = {};
        custUnique[r.custName][r.product] = true;
      }
    });
    var custTotal = Object.keys(custUnique).length;

    // 用户数据：按 userName 去重
    var userUnique = {};
    fUser.forEach(function(r) {
      if (r.product && r.userName) {
        if (!userUnique[r.userName]) userUnique[r.userName] = {};
        userUnique[r.userName][r.product] = true;
      }
    });
    var userTotal = Object.keys(userUnique).length;

    // 计算上月（环比）和去�?�同月（同比）期间
    var prevPeriod = '', yoyPeriod = '';
    if (periodFilter2 && periodFilter2.indexOf('-') > 0) {
      var parts = periodFilter2.split('-');
      var y = parseInt(parts[0]), m = parseInt(parts[1]);
      var py = y, pm = m;
      if (pm === 1) { py--; pm = 12; } else { pm--; }
      prevPeriod = py + '-' + String(pm).padStart(2, '0');
      yoyPeriod = (y - 1) + '-' + String(m).padStart(2, '0');
    }

    // 获取上月/去年同期数据
    var fCustPrev = [], fUserPrev = [], fCustYoy = [], fUserYoy = [];
    if (prevPeriod) {
      // 上月数据：按期间过滤 + 部门级联筛选
      fCustPrev = (App.ImportPotential.CustRAW || []).filter(function(r) { return (r.snapshotPeriod || '') === prevPeriod; });
      fUserPrev = (App.ImportPotential.UserRAW || []).filter(function(r) { return (r.snapshotPeriod || '') === prevPeriod; });
      var cascadeFilter = function(arr) {
        if (person !== 'all') return arr.filter(function(r) { return r.sales === person; });
        if (group !== 'all') return arr.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
        if (team !== 'all') return arr.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
        return arr;
      };
      fCustPrev = cascadeFilter(fCustPrev); fUserPrev = cascadeFilter(fUserPrev);
    }
    if (yoyPeriod) {
      fCustYoy = (App.ImportPotential.CustRAW || []).filter(function(r) { return (r.snapshotPeriod || '') === yoyPeriod; });
      fUserYoy = (App.ImportPotential.UserRAW || []).filter(function(r) { return (r.snapshotPeriod || '') === yoyPeriod; });
      var cascadeFilter2 = function(arr) {
        if (person !== 'all') return arr.filter(function(r) { return r.sales === person; });
        if (group !== 'all') return arr.filter(function(r) { return r.dept5 === group || r.dept4 === group; });
        if (team !== 'all') return arr.filter(function(r) { return r.dept3 === team || r.dept4 === team; });
        return arr;
      };
      fCustYoy = cascadeFilter2(fCustYoy); fUserYoy = cascadeFilter2(fUserYoy);
    }

    // 辅助：计算唯�?�覆盖数
    var countUnique = function(arr, keyField) {
      var uniq = {};
      arr.forEach(function(r) {
        if (r.product && r[keyField]) {
          if (!uniq[r[keyField]]) uniq[r[keyField]] = {};
          uniq[r[keyField]][r.product] = true;
        }
      });
      return uniq;
    };

    var custPrevUnique = countUnique(fCustPrev, 'custName');
    var custPrevTotal = Object.keys(custPrevUnique).length;
    var custYoyUnique = countUnique(fCustYoy, 'custName');
    var custYoyTotal = Object.keys(custYoyUnique).length;
    var userPrevUnique = countUnique(fUserPrev, 'userName');
    var userPrevTotal = Object.keys(userPrevUnique).length;
    var userYoyUnique = countUnique(fUserYoy, 'userName');
    var userYoyTotal = Object.keys(userYoyUnique).length;

    var custHasPrevData = prevPeriod && custPrevTotal > 0;
    var custHasYoyData = yoyPeriod && custYoyTotal > 0;
    var userHasPrevData = prevPeriod && userPrevTotal > 0;
    var userHasYoyData = yoyPeriod && userYoyTotal > 0;

    // 辅助：产品覆盖数
    var prodCovered = function(uniqueMap, prod) {
      var cnt = 0;
      Object.keys(uniqueMap).forEach(function(key) {
        if (uniqueMap[key][prod]) cnt++;
      });
      return cnt;
    };

    // 构建客户覆盖率排名
    var custRank = prods.map(function(p) {
      var cnt = prodCovered(custUnique, p);
      var rate = custTotal > 0 ? parseFloat((cnt / custTotal * 100).toFixed(1)) : 0;
      var cntPrev = prodCovered(custPrevUnique, p);
      var ratePrev = custPrevTotal > 0 ? parseFloat((cntPrev / custPrevTotal * 100).toFixed(1)) : 0;
      var cntYoy = prodCovered(custYoyUnique, p);
      var rateYoy = custYoyTotal > 0 ? parseFloat((cntYoy / custYoyTotal * 100).toFixed(1)) : 0;
      return { name: p, count: cnt, rate: rate,
        diff: custHasPrevData ? parseFloat((rate - ratePrev).toFixed(1)) : null,
        yoy: custHasYoyData ? parseFloat((rate - rateYoy).toFixed(1)) : null };
    }).sort(function(a, b) { return b.rate - a.rate; });

    // 构建用户覆盖率排名
    var userRank = prods.map(function(p) {
      var cnt = prodCovered(userUnique, p);
      var rate = userTotal > 0 ? parseFloat((cnt / userTotal * 100).toFixed(1)) : 0;
      var cntPrev = prodCovered(userPrevUnique, p);
      var ratePrev = userPrevTotal > 0 ? parseFloat((cntPrev / userPrevTotal * 100).toFixed(1)) : 0;
      var cntYoy = prodCovered(userYoyUnique, p);
      var rateYoy = userYoyTotal > 0 ? parseFloat((cntYoy / userYoyTotal * 100).toFixed(1)) : 0;
      return { name: p, count: cnt, rate: rate,
        diff: userHasPrevData ? parseFloat((rate - ratePrev).toFixed(1)) : null,
        yoy: userHasYoyData ? parseFloat((rate - rateYoy).toFixed(1)) : null };
    }).sort(function(a, b) { return b.rate - a.rate; });

    // 渲染客户覆盖率表（6列：排名/产品品�?已覆盖客户/覆盖�?环比/同比变化）
    var tbody1 = document.getElementById('pProdCovCustBody');
    if (tbody1) {
      if (custRank.length === 0) {
        tbody1.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">暂无导入数据</td></tr>';
      } else {
        tbody1.innerHTML = custRank.map(function(p, i) {
          var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
          var diffHtml = p.diff !== null ? (p.diff > 0 ? '<span style="color:#dc2626">+' + p.diff + '%</span>' : p.diff < 0 ? '<span style="color:#16a34a">' + p.diff + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
          var yoyHtml = p.yoy !== null ? (p.yoy > 0 ? '<span style="color:#dc2626">+' + p.yoy + '%</span>' : p.yoy < 0 ? '<span style="color:#16a34a">' + p.yoy + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
          return '<tr style="cursor:pointer" onclick="App.showPotentialProductDrill(\'' + p.name + '\',\'cust\')">' +
            '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
            '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
            '<td style="text-align:center">' + p.count + '</td>' +
            '<td style="text-align:center;font-weight:700;color:' + (p.rate >= 50 ? '#059669' : p.rate >= 20 ? '#d97706' : '#dc2626') + '">' + p.rate.toFixed(1) + '%</td>' +
            '<td style="text-align:center;font-size:12px">' + diffHtml + '</td>' +
            '<td style="text-align:center;font-size:12px">' + yoyHtml + '</td></tr>';
        }).join('');
      }
    }

    // 渲染用户覆盖率表（6列）
    var tbody2 = document.getElementById('pProdCovUserBody');
    if (tbody2) {
      if (userRank.length === 0) {
        tbody2.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">暂无导入数据</td></tr>';
      } else {
        tbody2.innerHTML = userRank.map(function(p, i) {
          var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
          var diffHtml = p.diff !== null ? (p.diff > 0 ? '<span style="color:#dc2626">+' + p.diff + '%</span>' : p.diff < 0 ? '<span style="color:#16a34a">' + p.diff + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
          var yoyHtml = p.yoy !== null ? (p.yoy > 0 ? '<span style="color:#dc2626">+' + p.yoy + '%</span>' : p.yoy < 0 ? '<span style="color:#16a34a">' + p.yoy + '%</span>' : '<span style="color:#9ca3af">0</span>') : '<span style="color:#9ca3af">/</span>';
          return '<tr style="cursor:pointer" onclick="App.showPotentialProductDrill(\'' + p.name + '\',\'user\')">' +
            '<td><span class="' + rn + '">' + (i + 1) + '</span></td>' +
            '<td>' + (i < 2 ? '<strong style="color:#1a56db">' + p.name + '</strong>' : '<span style="color:#1a56db">' + p.name + '</span>') + '</td>' +
            '<td style="text-align:center">' + p.count + '</td>' +
            '<td style="text-align:center;font-weight:700;color:' + (p.rate >= 50 ? '#059669' : p.rate >= 20 ? '#d97706' : '#dc2626') + '">' + p.rate.toFixed(1) + '%</td>' +
            '<td style="text-align:center;font-size:12px">' + diffHtml + '</td>' +
            '<td style="text-align:center;font-size:12px">' + yoyHtml + '</td></tr>';
        }).join('');
      }
    }

    // 更新卡片标题中的范围客�?�/用户数
    App.setText('p-cust-scale-count', custTotal);
    App.setText('p-user-scale-count', userTotal);
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
  // 从 localStorage 恢复审计日志（必须在 addLog 之前，否则旧日志被覆盖）
  try {
    var savedLogs = JSON.parse(localStorage.getItem('pa_audit_logs') || '[]');
    if (savedLogs.length > 0) {
      // 合并：localStorage 日志 + 当前内存日志，按时间倒序去重
      var seen = {};
      App.operationLogs.forEach(function(l) { seen[l.time + l.user + l.action] = true; });
      savedLogs.forEach(function(l) {
        if (!seen[l.time + l.user + l.action]) {
          App.operationLogs.push(l);
          seen[l.time + l.user + l.action] = true;
        }
      });
      App.operationLogs.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });
      if (App.operationLogs.length > 500) App.operationLogs = App.operationLogs.slice(0, 500);
    }
  } catch(e) {}

  // 登录日志（必须在这里记录，因为 doLogin 是异步的，wrapper 中 loggedInUser 尚未设置）
  if (App.loggedInUser && !App._loginLogged) {
    App._loginLogged = true;
    App.addLog('用户登录', '系统', App.loggedInUser.name + '登录系统');
  }

  // 从 localStorage 恢复权限配置（持久化存储）
  try {
    var saved = localStorage.getItem('pa_role_perms');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        App.ROLE_PERMISSIONS = parsed;
      }
    }
  } catch(e) {}

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

  // 从后端拉取审计日志
  App.fetchAuditLogs();

  // 初始化所有子Tab动态表格
  App.refreshAllSubTabs();

  // 强制二次刷新客户矩阵（确保首次加载数据正确）
  setTimeout(function() {
  }, 200);

  // 权限引导：隐藏无权限菜单 + 锁定筛选下拉
  try { App.bootstrapPermissions(); } catch(e) { console.warn('bootstrapPermissions:', e); }

  // 记录系统启动
  if (App.operationLogs.length === 0 && App.loggedInUser) {
    App.addLog('系统启动', '平台初始化', App.loggedInUser.name + ' 登录后数据源加载完成');
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
