/**
 * app.js — 应用主逻辑
 * SPA 路由、筛选联动、子 Tab 内容切换、数据刷新、导出
 */
window.App = window.App || {};

// ===== SPA 页面路由 =====
App.showPage = function(p) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });

  var page = document.getElementById('page-' + p);
  if (page) page.classList.add('active');

  var nav = document.querySelector('.nav-item[data-page="' + p + '"]');
  if (nav) nav.classList.add('active');

  window.scrollTo(0, 0);

  // 三级延迟 resize：解决隐藏 canvas 切换到可见后 Chart.js 尺寸为 0 的问题
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 80);
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 300);
  setTimeout(function() {
    document.querySelectorAll('canvas').forEach(function(canvas) {
      var chart = Chart.getChart(canvas);
      if (chart) chart.resize();
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

// ===== 子 Tab 切换：显示/隐藏内容区块 =====
document.querySelectorAll('.subtabs').forEach(function(bar) {
  bar.querySelectorAll('.subtab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      // 切换 active 样式
      bar.querySelectorAll('.subtab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // 获取当前页面容器
      var page = bar.closest('.page');
      if (!page) return;

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
        // resize 图表（如果区块内有 canvas）
        setTimeout(function() {
          target.querySelectorAll('canvas').forEach(function(canvas) {
            var chart = Chart.getChart(canvas);
            if (chart) chart.resize();
          });
        }, 100);
        // 分组对比 tab 切换时重新渲染（数据无变化时也确保 charts 正确显示）
        if (tabName === 'w-compare') {
          setTimeout(function() { App.renderCompare(); }, 60);
        }
        // 潜力产品-差距分析 tab 切换时重新渲染
        if (tabName === 'p-gap') {
          setTimeout(function() { App.renderGapAnalysis(); }, 60);
        }
      }
    });
  });
});

// ===== 辅助：读取筛选状态 =====
App.getFilterState = function(pageId) {
  var selects = document.querySelectorAll('#' + pageId + ' .filter-group select');
  var result = { team: 'all', group: 'all', person: 'all' };
  if (pageId === 'page-overview') {
    // selects: 对比期, 团队, 小组, 个人
    if (selects.length >= 2) result.team   = selects[1].value;
    if (selects.length >= 3) result.group  = selects[2].value;
    if (selects.length >= 4) result.person = selects[3].value;
  } else if (pageId === 'page-width') {
    // selects: 团队, 小组, 个人
    if (selects.length >= 1) result.team   = selects[0].value;
    if (selects.length >= 2) result.group  = selects[1].value;
    if (selects.length >= 3) result.person = selects[2].value;
  }
  return result;
};

App.getFilterLabel = function(state) {
  if (state.person !== 'all') return '个人';
  if (state.group  !== 'all') return '小组';
  if (state.team   !== 'all') return state.team;
  return '全部团队';
};

// ===== 数据总览 - 筛选联动 =====
App.updateOverview = function() {
  var state = App.getFilterState('page-overview');
  var label = App.getFilterLabel(state);
  var el = document.getElementById('overview-level');
  if (el) el.textContent = '当前粒度: ' + label;

  // 取数据切片（按团队粒度）
  var data = App.Data.getOverview(state.team);
  if (!data) return;

  // 更新 KPI
  var kpi = data.kpi;
  App.setText('ov-kpi-sales',          kpi.sales);
  App.setText('ov-kpi-potential-amt-v', kpi.potentialAmt);
  App.setText('ov-kpi-customers',      kpi.customers);
  App.setText('ov-kpi-users',          kpi.users);
  App.setText('ov-kpi-avgwidth',       kpi.avgWidth);
  App.setText('ov-kpi-scalerate',      kpi.scaleRate + ' (' + kpi.scaleCount + ' / ' + kpi.customers + ')');
  App.setText('ov-kpi-sales-yoy',      kpi.salesYoY);
  App.setText('ov-kpi-customers-mom',   '+' + kpi.customersMoM);
  App.setText('ov-kpi-avgwidth-yoy',   kpi.avgWidthYoY);
  App.setText('ov-kpi-potential',      kpi.potentialRate);

  // 更新部门维度对比图
  if (App.charts.ovDeptWidth) {
    App.charts.ovDeptWidth.data.labels = data.deptWidth.map(function(d) { return d.dept; });
    App.charts.ovDeptWidth.data.datasets[0].data = data.deptWidth.map(function(d) { return d.width; });
    App.charts.ovDeptWidth.update();
  }
  if (App.charts.ovDeptPotential) {
    App.charts.ovDeptPotential.data.labels = data.deptPotential.map(function(d) { return d.dept; });
    App.charts.ovDeptPotential.data.datasets[0].data = data.deptPotential.map(function(d) { return d.sales; });
    App.charts.ovDeptPotential.update();
  }
};

// ===== 产品宽度 - 筛选联动 =====
App.updateWidth = function() {
  var state = App.getFilterState('page-width');
  var label = App.getFilterLabel(state);
  var el = document.getElementById('width-level');
  if (el) el.textContent = '当前粒度: ' + label;

  var data = App.Data.getWidth(state.team);
  if (!data) return;

  var kpi = data.kpi;
  App.setText('w-kpi-customers', kpi.customers);
  App.setText('w-kpi-avgwidth',  kpi.avgWidth);
  App.setText('w-kpi-maxwidth',  kpi.maxWidth);
  App.setText('w-kpi-coverage',  kpi.coverage);
  App.setText('w-kpi-scale',     '规上 ' + kpi.scaleUp + ' · 非规上 ' + kpi.nonScale);
  App.setText('w-kpi-yoy',       kpi.widthYoY);
  App.setText('w-kpi-maxcust',   kpi.maxCust);
  App.setText('w-kpi-covdetail', kpi.scaleUp + ' / ' + kpi.customers);

  // 更新缺失分析表
  App.renderMissingTable('w-table-missing', data.missing);

  // 更新产品覆盖热力图
  App.renderHeatmap('w-heatmap', data.heatmap);

  // 更新客户产品宽度覆盖 (Top10 优质 / 后10 待提升)
  App.renderCustList('w-tbody-cust-good', data.custGood, true);
  App.renderCustList('w-tbody-cust-bad',  data.custBad,  false);

  // 更新用户产品宽度覆盖
  App.renderUserList('w-tbody-user-good', data.userGood, true);
  App.renderUserList('w-tbody-user-bad',  data.userBad,  false);

  // 更新图表
  if (App.charts.wDist) {
    App.charts.wDist.data.datasets[0].data = data.chartDist.data;
    App.charts.wDist.update();
  }
  if (App.charts.wTeam) {
    App.charts.wTeam.data.labels = data.chartTeam.labels;
    App.charts.wTeam.data.datasets[0].data = data.chartTeam.data;
    App.charts.wTeam.update();
  }
  if (App.charts.wCov) {
    App.charts.wCov.data.labels = data.chartCov.labels;
    App.charts.wCov.data.datasets[0].data = data.chartCov.data;
    App.charts.wCov.update();
  }
  if (App.charts.wReg) {
    App.charts.wReg.data.datasets[0].data = [0, data.chartReg.customers];
    App.charts.wReg.data.datasets[1].data = [6, parseFloat(data.chartReg.avgWidth)];
    App.charts.wReg.update();
  }
};

// ===== 潜力产品 - 筛选联动 =====
App.updatePotential = function() {
  var selects = document.querySelectorAll('#page-potential .filter-group select');
  var team = selects.length >= 2 ? selects[1].value : 'all';
  var data = App.Data.getPotential(team);
  if (!data) return;

  var kpi = data.kpi;
  App.setText('p-kpi-sales',      kpi.sales);
  App.setText('p-kpi-share',      '占部门 ' + kpi.share);
  App.setText('p-kpi-upcount',    kpi.upCount);
  App.setText('p-kpi-upamount',   '贡献 ' + kpi.upAmount);
  App.setText('p-kpi-downcount',  kpi.downCount);
  App.setText('p-kpi-downamount', '风险金额 ' + kpi.downAmount);
  App.setText('p-kpi-newcount',   kpi.newCount);
  App.setText('p-kpi-newamount',  '贡献 ' + kpi.newAmount);

  // ===== 经营概览 KPI (乔梦杰版 5 卡) =====
  var ov = data.overview;
  if (ov) {
    App.setText('p-kpi-sales',        '¥ ' + ov.sales.toLocaleString() + '万');
    App.setText('p-kpi-sales-prev',   ov.salesPrev.toLocaleString() + '万');
    App.setText('p-kpi-prodcount',    ov.productCount);
    App.setText('p-kpi-custcount',    ov.customerCount);
    App.setText('p-kpi-avgprice',     ov.avgPrice.toFixed(1));
    App.setText('p-kpi-deptcount',    ov.deptCount);
  }

  // ===== 团队×产品矩阵 =====
  App.renderTeamProdMatrix('p-team-prod-body', data.teamProdMatrix);

  // ===== 大部门 × 潜力产品 差距热图 (乔梦杰版) =====
  App.renderGapHeatmap('p-gap-heatmap-table', data.gapHeatmap);

  // ===== 销售人员潜力产品排名 (乔梦杰版) =====
  App.renderSalesPotentialRank('p-sales-potential-rank-body', data.salesPotentialRank);

  // 更新 TOP 10 表
  App.renderPotentialTop10('p-table-top10', data.top10);

  // 更新销售排名表
  App.renderSalesRankTable('p-table-salesrank', data.salesRank);

  // 更新图表
  if (App.charts.pSalesRank) {
    App.charts.pSalesRank.data.labels = data.salesRank.map(function(r) { return r[0]; });
    App.charts.pSalesRank.data.datasets[0].data = data.salesRank.map(function(r) { return r[1]; });
    App.charts.pSalesRank.update();
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
        cls = ratio < 0.10 ? 'heat-1' : (ratio < 0.30 ? 'heat-2' : (ratio < 0.60 ? 'heat-3' : (ratio < 0.85 ? 'heat-4' : 'heat-5'))));
      }
      var display = v > 0 ? v.toFixed(0) : '-';
      return '<td class="' + cls + '" title="' + prods[i] + ' (政府行业组维度对比): ' + v + ' 万">' + display + '</td>';
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
      '<td style="text-align:center;font-weight:700;color:var(--primary)">' + s.covered.length + '/' + total + '</td>' +
      '<td><div class="coverage-pills">' +
        '<span class="coverage-pill label covered">✓ 覆盖(' + s.covered.length + ')</span>' +
        coveredPills +
        (s.uncovered.length ? '<span class="coverage-pill label uncovered">✗ 未覆盖(' + s.uncovered.length + ')</span>' + uncoveredPills : '') +
      '</div></td>' +
      '</tr>';
  }).join('');
};

// ===== 差距分析 (整合自乔梦杰版) - 整体渲染入口 =====
App.renderGapAnalysis = function() {
  var data = App.Data.getPotential('all');
  if (!data || !data.gapHeatmap) return;

  // 1. 复用差距热图
  App.renderGapHeatmap('p-gap-heatmap-table-main', data.gapHeatmap);

  // 2. 差距明细表 (与团队均值的差距分析)
  App.renderGapDetail('p-gap-detail-table', data.gapHeatmap);

  // 3. 更新粒度提示
  var dimEl = document.getElementById('gap-dim');
  var dim = dimEl ? dimEl.value : 'dept3';
  var labelMap = { dept3: '大部门', dept4: '团队小组', person: '销售人员' };
  var levelEl = document.getElementById('gap-level');
  if (levelEl) levelEl.textContent = '当前粒度: ' + (labelMap[dim] || '大部门');
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

// 潜力产品销售排名表
App.renderPotentialProductTable = function(tbodyId, products) {
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

// 潜力产品贡献排名表
App.renderPotentialRankTable = function(tbodyId, rows) {
  var html = '';
  rows.forEach(function(r, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    html += '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td>' + r.name + '</td>' +
      '<td>¥ ' + r.amount.toLocaleString() + '万</td>' +
      '<td><span class="badge b-up">' + r.yoy + '</span></td>' +
      '<td>' + r.share + '</td>' +
      '<td>' + r.team + '</td>' +
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

// ===== 客户产品宽度覆盖 (参考简刚平版) =====
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
    count:     s(BASE_WIDTH.customers, f.customers),
    avgWidth:  parseFloat((BASE_WIDTH.avgWidth * f.width).toFixed(2)),
    guishang:  s(BASE_WIDTH.scaleUp, f.customers),
    guishangRate: parseFloat(((BASE_WIDTH.scaleUp / BASE_WIDTH.customers) * 100).toFixed(1)),
    prodRates: BASE_HEATMAP_PRODS.map(function(p) { return p.rate; })
  };
}

function getAllMeanStats() {
  var teams = ['政府行业组', '公安交警组', '教育文化组', '智能交通组'];
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

App.renderCompare = function() {
  var mode = (document.getElementById('compare-mode') || {}).value || 'group';
  var gA   = (document.getElementById('compare-groupA') || {}).value || '政府行业组';
  var gB   = (document.getElementById('compare-groupB') || {}).value || '公安交警组';
  var wrapB = document.getElementById('compare-groupB-wrap');
  if (wrapB) wrapB.style.display = (mode === 'mean') ? 'none' : '';

  var sA = getTeamStats(gA);
  var sB = (mode === 'mean') ? getAllMeanStats() : getTeamStats(gB);
  var labelB = sB.name;

  // 更新表头
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  setText('w-compare-th-A',  sA.name);
  setText('w-compare-th-A2', sA.name + ' 覆盖率');
  setText('w-compare-th-B',  labelB);
  setText('w-compare-th-B2', labelB + ' 覆盖率');
  setText('compare-level', '对比模式: ' + (mode === 'mean' ? (sA.name + ' vs 全部均值') : (sA.name + ' vs ' + labelB)));

  // 综合指标对比表
  var metrics = [
    ['客户数',       sA.count,        sB.count,        false, 0],
    ['平均产品宽度', sA.avgWidth,     sB.avgWidth,     true,  2],
    ['规上客户数',   sA.guishang,     sB.guishang,     true,  0],
    ['规上比率%',    sA.guishangRate, sB.guishangRate, true,  1]
  ];
  var summaryHtml = '';
  metrics.forEach(function(m) {
    var label = m[0], va = m[1], vb = m[2], biggerBetter = m[3], dec = m[4];
    var na = parseFloat(va), nb = parseFloat(vb);
    var diff = (na - nb);
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(dec);
    var vaStr = (typeof va === 'number' && dec > 0) ? va.toFixed(dec) : va;
    var vbStr = (typeof vb === 'number' && dec > 0) ? vb.toFixed(dec) : vb;
    var aCls = biggerBetter ? (na > nb ? 'compare-better' : (na < nb ? 'compare-worse' : '')) : '';
    var bCls = biggerBetter ? (nb > na ? 'compare-better' : (nb < na ? 'compare-worse' : '')) : '';
    var dCls = diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '');
    summaryHtml += '<tr>' +
      '<td><strong>' + label + '</strong></td>' +
      '<td class="' + aCls + '">' + vaStr + '</td>' +
      '<td class="' + bCls + '">' + vbStr + '</td>' +
      '<td class="' + dCls + '"><strong>' + diffStr + '</strong></td>' +
      '</tr>';
  });
  App.setHTML('w-compare-summary-body', summaryHtml);

  // 各产品类别覆盖对比
  var prodHtml = '';
  sA.prodRates.forEach(function(rA, i) {
    var name = BASE_HEATMAP_PRODS[i].name;
    var rB = sB.prodRates[i];
    var diff = rA - rB;
    var dCls = diff > 0 ? 'compare-better' : (diff < 0 ? 'compare-worse' : '');
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    prodHtml += '<tr>' +
      '<td>' + name + '</td>' +
      '<td>' + rA.toFixed(1) + '%</td>' +
      '<td>' + rB.toFixed(1) + '%</td>' +
      '<td class="' + dCls + '"><strong>' + diffStr + '</strong></td>' +
      '</tr>';
  });
  App.setHTML('w-compare-prod-body', prodHtml);

  // AI 智能分析
  var avgDiff = sA.avgWidth - sB.avgWidth;
  var weakProds = [], strongProds = [];
  sA.prodRates.forEach(function(rA, i) {
    var rB = sB.prodRates[i];
    if (rA < rB - 10) weakProds.push({ name: BASE_HEATMAP_PRODS[i].name, gap: (rB - rA).toFixed(1) });
    else if (rA > rB + 10) strongProds.push({ name: BASE_HEATMAP_PRODS[i].name, lead: (rA - rB).toFixed(1) });
  });
  var aiBody = '';
  setText('w-compare-ai-title', sA.name + ' vs ' + labelB + ' 诊断');
  if (avgDiff > 0) {
    aiBody += '<h4>一、整体表现</h4><ul><li>' + sA.name + ' 平均产品宽度 <strong>' + sA.avgWidth.toFixed(2) + '</strong>，高于 ' + labelB + ' <strong>' + sB.avgWidth.toFixed(2) + '</strong>（+' + avgDiff.toFixed(2) + '）</li></ul>';
    if (strongProds.length) aiBody += '<h4>二、优势产品 (领先 ' + labelB + ' 10% 以上)</h4><ul><li>' + strongProds.slice(0, 5).map(function(x) { return x.name + ' (+' + x.lead + '%)'; }).join('、') + '</li></ul>';
    if (weakProds.length)  aiBody += '<h4>三、待提升产品 (低于 ' + labelB + ' 10% 以上)</h4><ul><li>' + weakProds.slice(0, 5).map(function(x) { return x.name + ' (-' + x.gap + '%)'; }).join('、') + '</li></ul>';
    aiBody += '<h4>四、建议</h4><ul><li>保持优势产品覆盖节奏，重点补齐' + (weakProds.length ? weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') : '其他短板品类') + '等。</li></ul>';
  } else if (avgDiff < 0) {
    aiBody += '<h4>一、整体表现</h4><ul><li>' + sA.name + ' 平均产品宽度 <strong>' + sA.avgWidth.toFixed(2) + '</strong>，低于 ' + labelB + ' <strong>' + sB.avgWidth.toFixed(2) + '</strong>（' + avgDiff.toFixed(2) + '）</li></ul>';
    if (weakProds.length)  aiBody += '<h4>二、明显短板 (低于 ' + labelB + ' 10% 以上)</h4><ul><li>' + weakProds.slice(0, 5).map(function(x) { return x.name + ' (-' + x.gap + '%)'; }).join('、') + '</li></ul>';
    if (strongProds.length) aiBody += '<h4>三、相对优势</h4><ul><li>' + strongProds.slice(0, 3).map(function(x) { return x.name + ' (+' + x.lead + '%)'; }).join('、') + '</li></ul>';
    aiBody += '<h4>四、建议</h4><ul><li>优先突破' + (weakProds.length ? weakProds.slice(0, 3).map(function(x) { return x.name; }).join('、') : '差距产品') + '；复制 ' + labelB + ' 成功经验。</li></ul>';
  } else {
    aiBody += '<h4>一、整体表现</h4><ul><li>' + sA.name + ' 与 ' + labelB + ' 平均产品宽度基本一致 (均 ' + sA.avgWidth.toFixed(2) + ')</li></ul>';
    if (weakProds.length) aiBody += '<h4>二、仍有提升空间</h4><ul><li>' + weakProds.slice(0, 3).map(function(x) { return x.name + ' (-' + x.gap + '%)'; }).join('、') + '</li></ul>';
    aiBody += '<h4>三、建议</h4><ul><li>对标 ' + labelB + ' 找出差距，重点补齐薄弱产品。</li></ul>';
  }
  App.setHTML('w-compare-ai-body', aiBody);

  // 雷达图: 27 品类的覆盖率 (取前 15)
  var labels15 = BASE_HEATMAP_PRODS.slice(0, 15).map(function(p) { return p.name; });
  var dataA15 = sA.prodRates.slice(0, 15);
  var dataB15 = sB.prodRates.slice(0, 15);
  if (App.charts.wCompareRadar) {
    App.charts.wCompareRadar.data.labels = labels15;
    App.charts.wCompareRadar.data.datasets[0].label = sA.name;
    App.charts.wCompareRadar.data.datasets[0].data = dataA15;
    App.charts.wCompareRadar.data.datasets[1].label = labelB;
    App.charts.wCompareRadar.data.datasets[1].data = dataB15;
    App.charts.wCompareRadar.update();
  }

  // 分布对比图: 客户宽度分布 (0/1-3/4-6/7-10/11-15/16+)
  var buckets = ['0', '1-3', '4-6', '7-10', '11-15', '16+'];
  // 各团队的宽度分布比例 = 全局分布 * f.width
  var baseDist = [42, 302, 66, 34, 18, 9];
  var distA = baseDist.map(function(b) { return Math.round(b * (sA.avgWidth / 3.96)); });
  var distB = baseDist.map(function(b) { return Math.round(b * (sB.avgWidth / 3.96)); });
  if (App.charts.wCompareDist) {
    App.charts.wCompareDist.data.labels = buckets;
    App.charts.wCompareDist.data.datasets[0].label = sA.name;
    App.charts.wCompareDist.data.datasets[0].data = distA;
    App.charts.wCompareDist.data.datasets[1].label = labelB;
    App.charts.wCompareDist.data.datasets[1].data = distB;
    App.charts.wCompareDist.update();
  }
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
// 启动 Tooltip 系统
document.addEventListener('DOMContentLoaded', App.initCustTooltip);
if (document.readyState !== 'loading') App.initCustTooltip();

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

// 销售排名表（潜力产品页）
App.renderSalesRankTable = function(tbodyId, rows) {
  var html = '';
  rows.forEach(function(r, i) {
    var rn = i < 3 ? 'rn' + (i + 1) : 'rn0';
    html += '<tr>' +
      '<td><span class="rn ' + rn + '">' + (i + 1) + '</span></td>' +
      '<td>' + r[0] + '</td>' +
      '<td>¥ ' + r[1].toLocaleString() + '万</td>' +
      '<td><span class="badge b-up">' + r[2] + '</span></td>' +
      '<td>' + r[3] + '</td>' +
      '<td>' + r[4] + '</td>' +
      '</tr>';
  });
  App.setHTML(tbodyId, html);
};

// ===== 级联筛选入口函数（供 HTML onchange 调用） =====
App.updateOverviewCascade = function() { App.updateOverview(); };
App.updateWidthCascade    = function() { App.updateWidth(); };

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

  // 更新阈值标签
  var labelEl = document.querySelector('#page-width .card-title .right-meta span:first-child');
  if (!labelEl) {
    // Fallback: find the "宽度低于" span text
    var spans = document.querySelectorAll('#page-width .right-meta span');
    // The first span is "宽度低于", the last span is "的客户"
  }
};

// ===== 导出 PDF =====
App.exportPDF = function() {
  window.print();
};

// ===== 导出 Excel (CSV) =====
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

// ===== 页面首次加载时初始化数据 =====
(function initAll() {
  App.updateOverview();
  App.updateWidth();
  App.updatePotential();
  App.renderCompare();
  App.renderGapAnalysis();
})();
