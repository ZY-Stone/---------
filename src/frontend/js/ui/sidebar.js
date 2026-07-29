App.PRIMARY_NAV = [
  { page:'overview',  icon:'📊', text:'数据总览' },
  { page:'width',     icon:'📐', text:'产品宽度分析' },
  { page:'potential', icon:'🚀', text:'潜力产品分析' },
  { page:'admin',     icon:'⚙', text:'账号管理' }
];
App.SIDEBAR_MENUS = {
  overview: [],
  width: [{ id:'w-overview',icon:'📊',text:'总览分析' },{ id:'w-product',icon:'📦',text:'产品维度' },{ id:'w-team',icon:'👥',text:'团队维度' },{ id:'w-customer',icon:'🔑',text:'客户维度' },{ id:'w-user',icon:'🏢',text:'用户维度' },{ id:'w-compare',icon:'⚖️',text:'分组对比' },{ id:'w-import',icon:'📥',text:'数据导入与管理' },{ id:'w-ai',icon:'🤖',text:'AI建议与分析' }],
  potential: [{ id:'p-overview',icon:'📊',text:'总览分析' },{ id:'p-product',icon:'📦',text:'产品维度' },{ id:'p-team',icon:'👥',text:'团队维度' },{ id:'p-customer',icon:'🔑',text:'客户维度' },{ id:'p-user',icon:'🏢',text:'用户维度' },{ id:'p-gap',icon:'📊',text:'差距分析' },{ id:'p-import',icon:'📥',text:'数据导入与管理' },{ id:'p-ai',icon:'🤖',text:'AI建议与分析' }],
  admin: [{ id:'a-users',icon:'👥',text:'用户管理' },{ id:'a-roles',icon:'🔐',text:'角色权限' },{ id:'a-audit',icon:'📋',text:'审计日志' }]
};
App.renderSidebar = function(pageId) {
  var links = App.SIDEBAR_MENUS[pageId] || [];
  var container = document.getElementById('sidebarLinks');
  if (!container) return;
  var html = '';
  App.PRIMARY_NAV.forEach(function(n) {
    var active = n.page === pageId ? ' active' : '';
    html += '<a class="sidebar-link primary' + active + '" onclick="App.showPage(\'' + n.page + '\')"><span class="sl-icon">' + n.icon + '</span><span class="sl-text">' + n.text + '</span></a>';
  });
  if (links.length > 0) {
    html += '<div class="sidebar-divider"></div><div class="sidebar-section">' + (pageId==='width'?'产品宽度分析':pageId==='potential'?'潜力产品分析':'账号管理') + '</div>';
    links.forEach(function(l) { html += '<a class="sidebar-link" data-tab="' + l.id + '" onclick="App.switchTab(\'' + pageId + '\',\'' + l.id + '\')"><span class="sl-icon">' + l.icon + '</span><span class="sl-text">' + l.text + '</span></a>'; });
  }
  container.innerHTML = html;
  if (links.length > 0) App.switchTab(pageId, links[0].id);
};
App.toggleSidebar = function() { document.getElementById('sidebar').classList.toggle('collapsed'); };
App.switchTab = function(pageId, tabId) {
  document.querySelectorAll('#sidebarLinks .sidebar-link').forEach(function(a) { a.classList.toggle('active', a.getAttribute('data-tab') === tabId); });
  var page = document.getElementById('page-' + pageId);
  if (!page) return;
  page.querySelectorAll('[data-tab-content]').forEach(function(c) { c.style.display = 'none'; });
  var target = page.querySelector('[data-tab-content="' + tabId + '"]');
  if (!target) return;
  target.style.display = '';
  var handlers = {
    'w-overview':'updateWidth','w-product':'renderWidthProductTab','w-team':'WidthDetail.render', 'w-customer':'WidthCustomer.render',
    'w-user':'updateWidth','w-compare':'initCompare','w-import':'ImportData.render',
    'p-overview':'updatePotential','p-product':'renderPotentialProductTab','p-team':'renderPotentialTeamTab',
    'p-customer':'renderPotentialCustTab','p-user':'renderPotentialUserTab','p-gap':'renderGapAnalysis','p-import':'ImportPotential.render'
  };
  var fn = handlers[tabId];
  if (fn) {
    var parts = fn.split('.');
    var ctx = window.App;
    parts.forEach(function(p) { if (ctx) ctx = ctx[p]; });
    if (typeof ctx === 'function') { try { if (tabId === 'w-user') { App.updateWidth(); App.WidthUser.render(); } else ctx(); } catch(e) {} }
  }
};
