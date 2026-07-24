/**
 * charts.js — Chart.js 图表配置与初始化
 * 依赖: Chart.js CDN（全局 Chart 对象）
 */

// ===== Chart.js 全局默认配置 =====
Chart.defaults.font.family = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
Chart.defaults.font.size = 10.5;
Chart.defaults.color = '#6b7280';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
// 关闭全局动画，页面切换和首次加载即时渲染
Chart.defaults.animation = false;

// 图表实例全局存储（供筛选联动时动态更新）
App.charts = {};

// ===== 图表工厂函数 =====
function makeBar(labels, data, color, id, opts) {
  return new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: color, borderRadius: 3, barPercentage: .75 }]
    },
    options: Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false } }
      }
    }, opts || {})
  });
}

function makeHBar(labels, data, color, id, opts) {
  return new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: color, borderRadius: 3, barPercentage: .75 }]
    },
    options: Object.assign({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: '#f3f4f6' } },
        y: { grid: { display: false } }
      }
    }, opts || {})
  });
}

// ===== 1. 总览: 规上客均宽度排名 (已移至产品宽度页，保留安全初始化) =====
(function() {
  var canvas = document.getElementById('chart-ov-width-rank');
  if (canvas) {
    App.charts.ovWidthRank = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['陈思源', '王志强', '张伟', '李梦琪', '陈伟杰', '罗兴华', '张继成', '赵启超', '李金富', '徐宏源'],
        datasets: [{ data: [5.8, 5.2, 4.8, 4.3, 4.1, 3.9, 3.6, 3.4, 3.2, 3.0], backgroundColor: '#3b82f6', borderRadius: 3, barPercentage: .7 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: '规上客均宽度', font: { size: 12 } } },
        scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 9 } } } }
      }
    });
  }
})();

// ===== 2. 总览: 潜力产品销售排名 (已移至潜力产品页，保留安全初始化) =====
(function() {
  var canvas = document.getElementById('chart-ov-potential-rank');
  if (canvas) {
    App.charts.ovPotentialRank = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['NVR', '智能计算', 'IPC', '平台软件', '门禁', '智能交通', '存储', 'LCD'],
        datasets: [{ data: [3210, 2180, 1890, 1420, 980, 850, 720, 610], backgroundColor: ['#1a56db', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'], borderRadius: 3, barPercentage: .7 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: '销售额 (万)', font: { size: 12 } } },
        scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false }, ticks: { maxRotation: 30, font: { size: 9 } } } }
      }
    });
  }
})();

// ===== 总览: 产品宽度 — 按部门 =====
(function() {
  var canvas = document.getElementById('chart-ov-dept-width');
  if (canvas) {
    App.charts['ov_dept-width'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['政府行业组', '公安交警行业组', '工业企业一组', '智慧建筑组'],
        datasets: [{ data: [4.28, 3.76, 3.48, 3.24], backgroundColor: '#3b82f6', borderRadius: 6, barPercentage: .5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: function(evt, elements) {
          if (elements && elements.length > 0) {
            App.drillToWidth();
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) { return '客均宽度: ' + ctx.raw; } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '客均宽度', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      },
      plugins: [{
        id: 'barValues',
        afterDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds, i) {
            var meta = chart.getDatasetMeta(i);
            if (!meta || !meta.data) return;
            meta.data.forEach(function(bar, j) {
              if (!bar || typeof bar.x === 'undefined') return;
              var val = ds.data[j];
              if (val == null) return;
              ctx.save();
              ctx.fillStyle = '#1e293b';
              ctx.font = 'bold 11px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(val, bar.x, bar.y - 4);
              ctx.restore();
            });
          });
        }
      }]
    });
    // 兼容旧引用
    App.charts.ovDeptWidth = App.charts['ov_dept-width'];
  }
})();

// ===== 总览: 潜力产品 — 按部门 =====
(function() {
  var canvas = document.getElementById('chart-ov-dept-potential');
  if (canvas) {
    App.charts['ov_dept-potential'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'],
        datasets: [{ data: [1100,420,980,600,650,180,450,400,380,480,320], backgroundColor: '#3b82f6', borderRadius: 6, barPercentage: .5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) { return '销售额: ' + ctx.raw.toLocaleString() + '万'; } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额 (万)', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } }
        }
      },
      plugins: [{
        id: 'barValues',
        afterDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds, i) {
            var meta = chart.getDatasetMeta(i);
            if (!meta || !meta.data) return;
            meta.data.forEach(function(bar, j) {
              if (!bar || typeof bar.x === 'undefined') return;
              var val = ds.data[j];
              if (val == null) return;
              ctx.save();
              ctx.fillStyle = '#1e293b';
              ctx.font = 'bold 10px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(val.toLocaleString(), bar.x, bar.y - 4);
              ctx.restore();
            });
          });
        }
      }]
    });
    // 兼容旧引用
    App.charts.ovDeptPotential = App.charts['ov_dept-potential'];
  }
})();

// ===== 3. 产品宽度: 销售人员人均宽度分布 (统计销售人员在各宽度区间的分布) =====
(function() {
  var canvas = document.getElementById('chart-w-dist');
  if (!canvas) return;
  var buckets = ['0-2', '2-3', '3-4', '4-5', '5-6', '6+'];
  App.charts.wDist = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: buckets,
      datasets: [{
        data: [],
        backgroundColor: '#1a56db',
        borderRadius: 4,
        barPercentage: .7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      onClick: function(evt, elements) {
        if (elements && elements.length > 0) {
          var idx = elements[0].index;
          var buckets = ['0-2', '2-3', '3-4', '4-5', '5-6', '6+'];
          App.showWidthDrill(buckets[idx], idx);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return '销售人数: ' + ctx.parsed.y; } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 } }, title: { display: true, text: '人数' } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    },
    plugins: [{
      id: 'wDistValueLabels',
      afterDatasetsDraw: function(chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        var meta = chart.getDatasetMeta(0);
        meta.data.forEach(function(bar, i) {
          var v = chart.data.datasets[0].data[i];
          if (v != null) ctx.fillText(v, bar.x, bar.y - 4);
        });
        ctx.restore();
      }
    }]
  });
})();

// ===== 4. 产品宽度: 各团队平均 (凯玲版: 11 个完整团队名) =====
(function() {
  var canvas = document.getElementById('chart-w-team');
  if (!canvas) return;
  App.charts.wTeam = makeBar(
    ['政府组', '罗湖组', '陈天6', '高峰10', '沙头', '王鹏组', '彭城12', '招商17', '熊佳豪', '陈思源', '段金春'],
    [10.5, 7, 6, 5.4, 5.2, 4.8, 4, 4, 3.9, 3.4, 1.5],
    '#1a56db',
    'chart-w-team',
    { scales: { x: { ticks: { maxRotation: 45, font: { size: 10 } } } } }
  );
})();

// ===== 3b. 产品宽度: 按部门柱状图 (替换各团队平均宽度) =====
(function() {
  var canvas = document.getElementById('chart-w-width-bar');
  if (!canvas) return;
  App.charts.wWidthBar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['客户销售一部','客户销售二部','大客户销售部','场景数字化销售部','行业二部','行业一部'],
      datasets: [{ data: [3.52, 3.28, 3.14, 3.42, 4.28, 3.85], backgroundColor: '#3b82f6', borderRadius: 6, barPercentage: .5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return '客均宽度: ' + ctx.raw; } } } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '客均宽度' } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    },
    plugins: [{
      id: 'wBarValues',
      afterDraw: function(chart) {
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function(ds, i) {
          var meta = chart.getDatasetMeta(i);
          if (!meta || !meta.data) return;
          meta.data.forEach(function(bar, j) {
            if (!bar || typeof bar.x === 'undefined') return;
            var val = ds.data[j];
            if (val == null) return;
            ctx.save();
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(val, bar.x, bar.y - 4);
            ctx.restore();
          });
        });
      }
    }]
  });
})();

(function() {
  var canvas = document.getElementById('chart-w-team');
  if (canvas && App.charts.wTeam) {
    App.charts.wTeam.config.plugins = [{
      id: 'wTeamValueLabels',
      afterDatasetsDraw: function(chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        var meta = chart.getDatasetMeta(0);
        meta.data.forEach(function(bar, i) {
          var v = chart.data.datasets[0].data[i];
          ctx.fillText(v.toFixed(1), bar.x, bar.y - 4);
        });
        ctx.restore();
      }
    }];
    App.charts.wTeam.update('none');
  }
})();

// ===== 4.5 分组对比: 雷达图 (产品覆盖率对比) =====
(function() {
  var canvas = document.getElementById('chart-w-compare-radar');
  if (canvas) {
    var allProds = (window.App && App.WidthCustomer && App.WidthCustomer.PRODUCTS) ? App.WidthCustomer.PRODUCTS : ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专用摄像机','服务器','智能交通','移动终端','出入口停车','行业软件','对讲','报警','音频产品','人员通道','LED与拼控','综合布线','智慧屏','基础软件','传感产品','网络安全','智能计算','消防'];
    var zeroData = allProds.map(function() { return 0; });
    App.charts.wCompareRadar = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: allProds,
        datasets: [
          { label: '对比组A', data: zeroData.slice(), fill: true, backgroundColor: 'rgba(26, 86, 219, 0.18)', borderColor: '#1a56db', pointBackgroundColor: '#1a56db', pointRadius: 3, borderWidth: 2 },
          { label: '对比组B', data: zeroData.slice(), fill: true, backgroundColor: 'rgba(220, 38, 38, 0.15)', borderColor: '#dc2626', pointBackgroundColor: '#dc2626', pointRadius: 3, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 8, font: { size: 11 }, padding: 8 } } },
        scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 20, font: { size: 9 } }, pointLabels: { font: { size: 11 } }, grid: { color: '#e5e7eb' }, angleLines: { color: '#e5e7eb' } } }
      }
    });
  }
})();

// ===== 4.6 分组对比: 产品宽度分布对比 (分组柱状图) =====
(function() {
  var canvas = document.getElementById('chart-w-compare-dist');
  if (canvas) {
    App.charts.wCompareDist = new Chart(canvas, {
      type: 'bar',
      plugins: [{
        id: 'barLabels',
        afterDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds, dsIdx) {
            var meta = chart.getDatasetMeta(dsIdx);
            if (!meta) return;
            meta.data.forEach(function(bar, i) {
              var val = ds.data[i];
              if (val > 0) {
                ctx.fillStyle = dsIdx === 0 ? '#1a56db' : '#dc2626';
                ctx.font = 'bold 11px "Microsoft YaHei", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(val, bar.x, bar.y - 4);
              }
            });
          });
        }
      }],
      data: {
        labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'],
        datasets: [
          { label: '对比组A', data: [42, 302, 66, 34, 18, 9], backgroundColor: '#1a56db', borderRadius: 4, barPercentage: .75 },
          { label: '对比组B', data: [56, 350, 78, 28, 12, 5], backgroundColor: '#dc2626', borderRadius: 4, barPercentage: .75 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '客户数', font: { size: 11 } } }
        }
      }
    });
  }
})();

// ===== 5. 产品宽度: 产品覆盖率 (27品类全部展示 · 客户/用户覆盖率切换) =====
(function() {
  var canvas = document.getElementById('chart-w-cov');
  if (!canvas) return;
  var prods = ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专用摄像机','服务器','行业软件','智能计算','对讲','报警','出入口停车','人员通道','音频产品','PCP产品','LED与拼控','移动终端产品','智能交通','智慧屏与视频会议','综合布线与机柜','基础软件','网络安全','传感产品'];
  var custRates = [53.1, 36.7, 27.8, 24.6, 17.6, 17.4, 16.3, 14.6, 11.5, 9.3, 8.9, 8.5, 7.9, 7.6, 7.4, 7.4, 6.4, 5.9, 4.5, 4.5, 4.2, 4.0, 3.6, 3.6, 1.9, 1.7, 0.8];
  var userRates = [80.3, 69.4, 47.9, 54.4, 31.1, 22.1, 35.2, 28.5, 36.8, 19.8, 17.3, 15.6, 14.2, 13.0, 11.5, 18.7, 10.8, 9.4, 8.2, 7.8, 7.1, 24.6, 6.5, 5.8, 4.3, 3.6, 2.1];
  App.charts.wCov = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: prods,
      datasets: [
        { label: '客户覆盖率', data: custRates, backgroundColor: '#22c55e', borderRadius: 4, barPercentage: .7 },
        { label: '用户覆盖率', data: userRates, backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: .7, hidden: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return (ctx.dataset.label || '覆盖率') + ': ' + ctx.parsed.y + '%'; } } }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 } }, title: { display: true, text: '覆盖率 (%)' } },
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' }, color: '#000', maxRotation: 60, minRotation: 60 } }
      }
    },
    plugins: [{
      id: 'covValueLabels',
      afterDatasetsDraw: function(chart) {
        var ctx2 = chart.ctx;
        ctx2.save();
        chart.data.datasets.forEach(function(ds, dsIdx) {
          var meta = chart.getDatasetMeta(dsIdx);
          if (!meta || meta.hidden) return;
          ds.data.forEach(function(v, i) {
            var bar = meta.data[i];
            if (!bar || typeof bar.x === 'undefined') return;
            ctx2.fillStyle = dsIdx === 0 ? '#16a34a' : '#2563eb';
            ctx2.font = '600 10px -apple-system, sans-serif';
            ctx2.textAlign = 'center';
            ctx2.textBaseline = 'bottom';
            ctx2.fillText(v + '%', bar.x, bar.y - 2);
          });
        });
        ctx2.restore();
      }
    }]
  });
  // 存储覆盖率数据引用，方便切换
  App.charts.wCov._custData = custRates;
  App.charts.wCov._userData = userRates;
  // 强制默认只展示客户覆盖率
  App.charts.wCov.setDatasetVisibility(0, true);
  App.charts.wCov.setDatasetVisibility(1, false);
  App.charts.wCov.update();
})();

// ===== 6. 产品宽度: 规上 vs 非规上（双轴混合图）- 已从页面移除，保留安全初始化 =====
(function() {
  var canvas = document.getElementById('chart-w-reg');
  if (canvas) {
    App.charts.wReg = new Chart(canvas, {
  type: 'bar',
  data: {
    labels: ['基线', '当前'],
    datasets: [
      {
        label: '客户数',
        data: [0, 471],
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        yAxisID: 'y1'
      },
      {
        label: '平均宽度',
        type: 'line',
        data: [6, 3.2],
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        yAxisID: 'y',
        tension: .3,
        pointRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { position: 'left', title: { display: true, text: '平均宽度' } },
      y1: { position: 'right', grid: { display: false }, title: { display: true, text: '客户数' } }
    }
  }
});
  }
})();

// ===== 6b. 产品宽度: 历史趋势（折线图） =====
(function() {
var trendCanvas = document.getElementById('chart-w-width-trend');
if (trendCanvas) {
App.charts.wWidthTrend = new Chart(trendCanvas, {
  type: 'line',
  data: {
    labels: ['08','09','10','11','12','01','02','03','04','05','06','07'],
    datasets: [
      { label: '客户销售一部', data: [2.5,2.6,2.7,2.8,2.9,3.0,3.1,3.2,3.3,3.4,3.45,3.52], borderColor: '#3b82f6', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#3b82f6' },
      { label: '客户销售二部', data: [2.3,2.4,2.5,2.55,2.6,2.7,2.8,2.9,3.0,3.1,3.2,3.28], borderColor: '#10b981', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#10b981' },
      { label: '大客户销售部', data: [2.2,2.3,2.35,2.4,2.5,2.6,2.7,2.8,2.9,3.0,3.05,3.14], borderColor: '#f59e0b', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#f59e0b' },
      { label: '场景数字化销售部', data: [2.4,2.5,2.55,2.6,2.7,2.8,2.9,3.0,3.1,3.2,3.3,3.42], borderColor: '#ef4444', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#ef4444' },
      { label: '行业二部', data: [3.2,3.3,3.4,3.5,3.6,3.7,3.8,3.9,4.0,4.1,4.2,4.28], borderColor: '#7c3aed', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#7c3aed' },
      { label: '行业一部', data: [2.8,2.9,3.0,3.1,3.2,3.3,3.4,3.5,3.6,3.7,3.78,3.85], borderColor: '#0891b2', tension:.3, fill:false, pointRadius:4, pointBackgroundColor:'#0891b2' },
      { label: '平均宽度', data: [3.2,3.3,3.3,3.4,3.5,3.5,3.6,3.7,3.8,3.8,3.9,3.96], borderColor: '#94a3b8', borderDash:[6,4], tension:.3, fill:false, pointRadius:3, pointBackgroundColor:'#94a3b8' }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
    scales: {
      y: { beginAtZero: false, min: 0, grid: { color: '#f3f4f6' }, title: { display: true, text: '产品宽度' } },
      x: { grid: { display: false } }
    }
  }
});
}
})();

// Keep old chart for compatibility (wrapped in null check — canvas may not exist)
(function() {
  var oldCanvas = document.getElementById('chart-width-trend');
  if (!oldCanvas) return;
  new Chart(oldCanvas, {
  type: 'line',
  data: {
    labels: ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'],
    datasets: [
      {
        label: '平均产品宽度',
        data: [3.2, 3.3, 3.3, 3.4, 3.5, 3.5, 3.6, 3.7, 3.8, 3.8, 3.9, 3.96],
        borderColor: '#1a56db',
        backgroundColor: 'rgba(26,86,219,.1)',
        tension: .3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#1a56db'
      },
      {
        label: '规上客户平均宽度',
        data: [5.1, 5.2, 5.2, 5.3, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0],
        borderColor: '#10b981',
        tension: .3,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: '#10b981'
      },
      {
        label: '非规上客户平均宽度',
        data: [1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5, 1.5, 1.5, 1.6, 1.6],
        borderColor: '#f59e0b',
        tension: .3,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: '#f59e0b'
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        min: 0,
        grid: { color: '#f3f4f6' },
        title: { display: true, text: '产品宽度' }
      },
      x: { grid: { display: false } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } }
    }
  }
  });
})();

// ===== 7. 潜力产品: 量价四象限（散点图）- 安全初始化 =====
(function() {
var quadCanvas = document.getElementById('chart-quadrant');
if (!quadCanvas) return;
var quadCtx = quadCanvas.getContext('2d');
var pts = [
  { x: 42.1, y: 58.3, l: 'NVR' },
  { x: 100, y: 100, l: '智能计算' },
  { x: 15.2, y: 22.4, l: 'IPC' },
  { x: -3.2, y: 18.7, l: '平台软件' },
  { x: -18.6, y: -23.5, l: '门禁' },
  { x: -5.4, y: -11.2, l: '智能交通' },
  { x: 12.3, y: 8.4, l: '存储' },
  { x: 8.7, y: 5.2, l: 'LCD' }
];

new Chart(quadCtx, {
  type: 'scatter',
  data: {
    datasets: [{
      label: '潜力产品',
      data: pts.map(function(p) { return { x: p.x, y: p.y }; }),
      backgroundColor: pts.map(function(p) {
        if (p.y > 0 && p.x > 0) return '#10b981';   // 量价齐升
        if (p.y < 0 && p.x < 0) return '#ef4444';   // 量价齐跌
        if (p.y > 0) return '#f59e0b';              // 金额涨
        return '#3b82f6';                            // 其他
      }),
      pointRadius: 8,
      borderColor: '#fff',
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(ctx) {
            var p = pts[ctx.dataIndex];
            return p.l + ': 数量同比 ' + p.x.toFixed(1) + '% / 金额同比 ' + p.y.toFixed(1) + '%';
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: '数量同比 %' },
        grid: { color: '#f3f4f6' },
        ticks: { callback: function(v) { return v + '%'; } }
      },
      y: {
        title: { display: true, text: '金额同比 %' },
        grid: { color: '#f3f4f6' },
        ticks: { callback: function(v) { return v + '%'; } }
      }
    }
  }
});
})();

// ===== 8. 潜力产品: 行业分布（饼图） =====
var indCanvas=document.getElementById('chart-industry'); if(indCanvas) new Chart(indCanvas, {
  type: 'doughnut',
  data: {
    labels: ['政府', '公安', '教育', '交通', '卫生', '文体', '司法', '税务', '能源', '企业通用', '其他'],
    datasets: [{
      data: [38, 22, 15, 8, 5, 4, 3, 2, 1, 1, 1],
      backgroundColor: [
        '#1a56db', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#0891b2', '#ca8a04', '#7c3aed', '#fb923c', '#9ca3af'
      ]
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } }
    }
  }
});

// ===== 9. 潜力产品: 销售排名 =====
(function() {
  var canvas = document.getElementById('chart-sales-rank');
  if (canvas) {
    App.charts.pSalesRank = new Chart(canvas, {
  type: 'bar',
  data: {
    labels: ['陈思源', '王志强', '张伟', '陈伟杰', '李梦琪', '罗兴华', '黄燕滨', '赵启超', '张继成', '李金富'],
    datasets: [{
      data: [1850, 1420, 980, 850, 720, 650, 580, 480, 420, 360],
      backgroundColor: [
        '#1a56db', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
        '#1a56db', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'
      ],
      borderRadius: 3,
      barPercentage: .7
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: '潜力产品贡献额 (万)', font: { size: 12 } }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
      x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 9 } } }
    }
  }
});
  }
})();

// ===== 10. 潜力产品: 历史趋势（折线图） =====
var _ct = document.getElementById('chart-trend'); if (_ct) new Chart(_ct, {
  type: 'line',
  data: {
    labels: ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'],
    datasets: [
      {
        label: 'NVR',
        data: [1200, 1320, 1410, 1380, 1500, 1620, 1750, 1880, 2050, 2280, 2780, 3210],
        borderColor: '#1a56db',
        tension: .3,
        fill: false,
        pointRadius: 2
      },
      {
        label: '智能计算',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1200, 2180],
        borderColor: '#7c3aed',
        tension: .3,
        fill: false,
        pointRadius: 2,
        borderDash: [5, 3]
      },
      {
        label: '门禁',
        data: [1650, 1620, 1580, 1520, 1450, 1400, 1350, 1280, 1200, 1100, 1020, 980],
        borderColor: '#ef4444',
        tension: .3,
        fill: false,
        pointRadius: 2
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额(万)' } },
      x: { grid: { display: false } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8 } }
    }
  }
});

// ===== 11. 总览: 产品宽度历史趋势 (近12月) =====
(function() {
  var canvas = document.getElementById('chart-ov-width-trend');
  if (canvas) {
    App.charts['ov_width-trend'] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'],
        datasets: [
          {
            label: '平均产品宽度',
            data: [3.2, 3.3, 3.3, 3.4, 3.5, 3.5, 3.6, 3.7, 3.8, 3.8, 3.9, 3.96],
            borderColor: '#1a56db',
            backgroundColor: 'rgba(26,86,219,.08)',
            tension: .3, fill: true, pointRadius: 4, pointBackgroundColor: '#1a56db'
          },
          {
            label: '规上客户产品宽度',
            data: [5.1, 5.2, 5.2, 5.3, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0],
            borderColor: '#10b981', tension: .3, fill: false, pointRadius: 4, pointBackgroundColor: '#10b981'
          },
          {
            label: '规上用户产品宽度',
            data: [4.5, 4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6],
            borderColor: '#f59e0b', tension: .3, fill: false, pointRadius: 4, pointBackgroundColor: '#f59e0b'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
        scales: {
          y: { beginAtZero: false, min: 0, grid: { color: '#f3f4f6' }, title: { display: true, text: '产品宽度' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
})();

// ===== 12. 总览: 潜力产品历史趋势 (近12月) =====
(function() {
  var canvas = document.getElementById('chart-ov-potential-trend');
  if (canvas) {
    App.charts['ov_potential-trend'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'],
        datasets: [
          {
            label: '本期销售额',
            data: [1100, 420, 980, 600, 650, 180, 450, 400, 380, 480, 320],
            backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: .6
          },
          {
            label: '同期销售额',
            data: [880, 380, 0, 520, 0, 170, 360, 300, 260, 320, 280],
            backgroundColor: '#cbd5e1', borderRadius: 4, barPercentage: .6
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额 (万)' } },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } }
        }
      }
    });
  }
})();

// ===== 13. 潜力产品: 销售量构成 (按产品) — 环形饼图 =====
var pcCanvas=document.getElementById('chart-p-composition'); App.charts.potComposition = pcCanvas ? new Chart(pcCanvas, {
  type: 'doughnut',
  data: {
    labels: ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'],
    datasets: [{ data: [3210, 2180, 1890, 1420, 980, 850, 720, 610, 420, 320, 180, 150], backgroundColor: ['#1a56db','#7c3aed','#10b981','#f59e0b','#ef4444','#06b6d4','#3b82f6','#84cc16','#a855f7','#ec4899','#14b8a6','#f97316'], borderWidth: 0 }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
      tooltip: { callbacks: { label: function(ctx) { var total = ctx.dataset.data.reduce(function(a,b){return a+b;},0); return ctx.label + ': ¥' + ctx.raw + '万 (' + (ctx.raw/total*100).toFixed(1) + '%)'; } } }
    }
  },
  plugins: [{
    id: 'pieLabels',
    afterDraw: function(chart) {
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      var total = chart.data.datasets[0].data.reduce(function(a,b){return a+b;},0);
      meta.data.forEach(function(arc, i) {
        var val = chart.data.datasets[0].data[i];
        if (val / total < 0.03) return;
        var angle = (arc.startAngle + arc.endAngle) / 2;
        var r = (arc.outerRadius + arc.innerRadius) / 2 * 1.15;
        var x = arc.x + Math.cos(angle) * r;
        var y = arc.y + Math.sin(angle) * r;
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 10px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¥' + val + '万', x, y);
        ctx.restore();
      });
    }
  }]
});

// ===== 14. 潜力产品本期销售额趋势 (12月×12产品线) =====
(function() {
var pYoyCanvas = document.getElementById('chart-p-yoy');
if (pYoyCanvas) {
new Chart(pYoyCanvas, {
  type: 'line',
  data: {
    labels: ['08','09','10','11','12','01','02','03','04','05','06','07'],
    datasets: [
      { label: 'NVR', data: [1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210], borderColor: '#1a56db', tension: .3, fill: false, pointRadius: 3 },
      { label: '智能计算', data: [0,0,0,0,0,0,0,0,0,0,1200,2180], borderColor: '#7c3aed', borderDash: [5,3], tension: .3, fill: false, pointRadius: 3 },
      { label: 'IPC', data: [1100,1180,1220,1280,1320,1380,1420,1500,1580,1650,1780,1890], borderColor: '#10b981', tension: .3, fill: false, pointRadius: 3 },
      { label: '平台软件', data: [620,650,680,710,740,780,820,880,930,1050,1280,1420], borderColor: '#f59e0b', tension: .3, fill: false, pointRadius: 3 },
      { label: '门禁', data: [1650,1620,1580,1520,1450,1400,1350,1280,1200,1100,1020,980], borderColor: '#ef4444', tension: .3, fill: false, pointRadius: 3 },
      { label: '智能交通', data: [380,400,420,450,480,520,560,600,650,720,780,850], borderColor: '#06b6d4', tension: .3, fill: false, pointRadius: 2 },
      { label: '存储', data: [280,300,320,340,360,390,420,460,500,550,620,720], borderColor: '#3b82f6', tension: .3, fill: false, pointRadius: 2 },
      { label: 'LCD与解码', data: [200,210,220,240,260,280,310,340,380,430,500,610], borderColor: '#84cc16', tension: .3, fill: false, pointRadius: 2 },
      { label: '出入口停车', data: [150,160,170,180,190,210,230,260,290,330,380,420], borderColor: '#a855f7', tension: .3, fill: false, pointRadius: 2 },
      { label: '音频产品', data: [100,110,120,130,140,150,170,190,210,240,280,320], borderColor: '#ec4899', tension: .3, fill: false, pointRadius: 2 },
      { label: '人员通道', data: [60,65,70,75,80,85,95,105,120,140,160,180], borderColor: '#14b8a6', tension: .3, fill: false, pointRadius: 2 },
      { label: '行业软件', data: [40,45,48,52,55,60,65,72,80,95,110,150], borderColor: '#f97316', tension: .3, fill: false, pointRadius: 2 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 20, font: { size: 9 }, usePointStyle: true, padding: 8 } } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额(万)', font: { size: 10 } } },
      x: { grid: { display: false } }
    }
  }
});
}
})();

// ===== 15. 潜力产品: 量价四象限 (散点图·参考乔梦杰版) =====
var quadColors = { '量价齐升': '#10b981', '量跌价增': '#f59e0b', '量价齐跌': '#ef4444', '量增价跌': '#8b5cf6' };
var pqCanvas=document.getElementById('chart-p-quadrant'); App.charts.potQuadrant = pqCanvas ? new Chart(pqCanvas, {
  type: 'scatter',
  data: { datasets: [] },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, generateLabels: function() {
        return Object.keys(quadColors).map(function(k) { return { text: k, fillStyle: quadColors[k], strokeStyle: quadColors[k], pointStyle: 'circle', hidden: false }; });
      }}},
      tooltip: { callbacks: { label: function(ctx) { return ctx.raw.prodName + ': 金额' + ctx.raw.y.toFixed(1) + '% 数量' + ctx.raw.x.toFixed(1) + '%'; } } }
    },
    scales: {
      x: { title: { display: true, text: '数量同比 (%)', font: { size: 10 } }, grid: { color: '#f3f4f6' } },
      y: { title: { display: true, text: '金额同比 (%)', font: { size: 10 } }, grid: { color: '#f3f4f6' } }
    }
  },
  plugins: [{
    id: 'quadrantBg',
    beforeDraw: function(chart) {
      var ctx = chart.ctx, area = chart.chartArea, x = area.left, y = area.top, w = area.right - x, h = area.bottom - y;
      var midX = x + w / 2, midY = y + h / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(16,185,129,0.06)'; ctx.fillRect(midX, y, w / 2, h / 2);
      ctx.fillStyle = 'rgba(245,158,11,0.06)'; ctx.fillRect(x, y, w / 2, h / 2);
      ctx.fillStyle = 'rgba(239,68,68,0.06)'; ctx.fillRect(x, midY, w / 2, h / 2);
      ctx.fillStyle = 'rgba(139,92,246,0.06)'; ctx.fillRect(midX, midY, w / 2, h / 2);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(midX, y); ctx.lineTo(midX, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke();
      ctx.restore();
    }
  }]
});

// ===== 16. 潜力产品: 二级部门销售排名 (水平柱图) =====
(function() {
var deptRankCanvas = document.getElementById('chart-p-dept-rank');
if (deptRankCanvas) new Chart(deptRankCanvas, {
  type: 'bar',
  data: {
    labels: ['政府行业组', '公安交警行业组', '工业企业一组', '智慧建筑组'],
    datasets: [
      { label: '销售额 (万)', data: [3850, 2620, 1740, 1320], backgroundColor: ['#1a56db', '#10b981', '#f59e0b', '#ef4444'], borderRadius: 6, barPercentage: .6 }
    ]
  },
  options: {
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx) { return '销售额: ¥' + ctx.raw.toLocaleString() + '万'; } } }
    },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额 (万)', font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  }
})();
})();

// ===== 17. 潜力产品: 空白产品率 & 待突破实体率 综合对比 (柱+线双轴) =====
// 12 个产品的空白率(%) 和 待突破率(%)
var gapCombinedCanvas = document.getElementById('chart-p-gap-combined');
App.charts.pGapCombined = gapCombinedCanvas ? new Chart(gapCombinedCanvas, {
  type: 'bar',
  data: {
    labels: ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'],
    datasets: [
      { label: '待突破实体率(%)', data: [0, 75, 0, 0, 25, 50, 0, 0, 25, 25, 50, 50], backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false, yAxisID: 'y', order: 2 },
      { label: '空白产品率(%·实体维度)', data: [0, 25, 0, 0, 0, 0, 0, 0, 25, 50, 75, 75], type: 'line', borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#f59e0b', yAxisID: 'y1', tension: 0.3, order: 1 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12, usePointStyle: true } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y:  { position: 'left',  beginAtZero: true, max: 100, title: { display: true, text: '待突破率(%)' }, ticks: { callback: function(v) { return v + '%'; } }, grid: { color: '#f3f4f6' } },
      y1: { position: 'right', beginAtZero: true, max: 100, title: { display: true, text: '空白率(%)' },  ticks: { callback: function(v) { return v + '%'; } }, grid: { drawOnChartArea: false } },
      x:  { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  }
}) : null;

// ===== 18. 潜力产品: 产品维度-量价四象限 (散点图) =====
(function() {
  var prodQuadCanvas = document.getElementById('chart-p-prod-quadrant');
  if (!prodQuadCanvas) return;
  new Chart(prodQuadCanvas, {
  type: 'scatter',
  data: {
    datasets: [
      { label: '量价齐升', data: [{x:42.1,y:58.3},{x:15.2,y:22.4},{x:12.3,y:8.4},{x:8.7,y:5.2},{x:18.5,y:15.2},{x:6.3,y:2.8},{x:25,y:32.5}], backgroundColor: '#10b981', pointRadius: 8, pointHoverRadius: 12 },
      { label: '新增',     data: [{x:100,y:100}], backgroundColor: '#7c3aed', pointRadius: 10, pointStyle: 'star', pointHoverRadius: 14 },
      { label: '量跌价增', data: [{x:-3.2,y:18.7}], backgroundColor: '#f59e0b', pointRadius: 8, pointHoverRadius: 12 },
      { label: '量价齐跌', data: [{x:-18.6,y:-23.5},{x:-5.4,y:-11.2},{x:-2.5,y:-1.8}], backgroundColor: '#ef4444', pointRadius: 8, pointHoverRadius: 12 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } },
      tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ' (' + ctx.parsed.x + '%, ' + ctx.parsed.y + '%)'; } } }
    },
    scales: {
      x: { min: -30, max: 110, grid: { color: '#e5e7eb' }, title: { display: true, text: '数量同比%', font: { size: 11 } }, ticks: { font: { size: 9 } } },
      y: { min: -30, max: 110, grid: { color: '#e5e7eb' }, title: { display: true, text: '金额同比%', font: { size: 11 } }, ticks: { font: { size: 9 } } }
    }
  }
  });
})();

// ===== 客户分层: 四象限散点图 =====
(function initCustSegment() {
  var canvas = document.getElementById('chart-cust-segment');
  if (!canvas) return;
  App.charts.custSegment = new Chart(canvas, {
    type: 'scatter',
    data: { datasets: [
      { label: '明星客户', data: [
        { x: 880, y: 9, custName: '深圳市政府' }, { x: 720, y: 8, custName: '宝安公安局' },
        { x: 650, y: 7, custName: '罗湖教育局' }, { x: 580, y: 8, custName: '广东省交通厅' },
        { x: 520, y: 7, custName: '高峰10' }
      ], backgroundColor: '#7c3aed', pointRadius: 9, pointHoverRadius: 12 },
      { label: '维持客户', data: [
        { x: 420, y: 6, custName: '招商17' }, { x: 380, y: 5, custName: '深圳大学' },
        { x: 350, y: 6, custName: '南方科技大学' }, { x: 320, y: 5, custName: '深圳市卫健委' },
        { x: 280, y: 4, custName: '深圳机场集团' }
      ], backgroundColor: '#f59e0b', pointRadius: 8, pointHoverRadius: 11 },
      { label: '潜力客户', data: [
        { x: 220, y: 3, custName: '深圳巴士集团' }, { x: 180, y: 2, custName: '天眼监控' },
        { x: 150, y: 3, custName: '招商局地产' }, { x: 130, y: 2, custName: '鹏城科技' },
        { x: 110, y: 1, custName: '深圳交警支队' }
      ], backgroundColor: '#10b981', pointRadius: 8, pointHoverRadius: 11 },
      { label: '沉睡客户', data: [
        { x: 80, y: 1, custName: '龙岗分局' }, { x: 60, y: 1, custName: '南山教育局' },
        { x: 45, y: 1, custName: '深圳文体局' }, { x: 35, y: 1, custName: '港口集团' },
        { x: 25, y: 1, custName: '车管所' }
      ], backgroundColor: '#9ca3af', pointRadius: 7, pointHoverRadius: 10 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
        tooltip: { callbacks: { label: function(ctx) { return ctx.raw.custName + ': ¥' + ctx.raw.x.toFixed(0) + '万 / 宽度' + ctx.raw.y; } } }
      },
      scales: {
        x: { title: { display: true, text: '销售额 (万元)', font: { size: 12, weight: 'bold' } }, grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 } } },
        y: { title: { display: true, text: '产品宽度 (品类数)', font: { size: 12, weight: 'bold' } }, grid: { color: '#f3f4f6' }, ticks: { stepSize: 2, font: { size: 10 } } }
      }
    }
  });

  // ===== 18. 潜力产品·产品维度 — 四象限散点图（覆盖率 × 增速） =====
  var quad2Colors = { '成熟核心': '#10b981', '蓝海潜力': '#3b82f6', '增长见顶': '#f59e0b', '弱势品类': '#ef4444' };
  var pq2Canvas=document.getElementById('chart-p-quad2'); App.charts.potQuad2 = pq2Canvas ? new Chart(pq2Canvas, {
    type: 'scatter',
    data: { datasets: [
      { label: '成熟核心', data: [], backgroundColor: quad2Colors['成熟核心'], pointRadius: 8, pointHoverRadius: 12 },
      { label: '蓝海潜力', data: [], backgroundColor: quad2Colors['蓝海潜力'], pointRadius: 8, pointHoverRadius: 12 },
      { label: '增长见顶', data: [], backgroundColor: quad2Colors['增长见顶'], pointRadius: 8, pointHoverRadius: 12 },
      { label: '弱势品类', data: [], backgroundColor: quad2Colors['弱势品类'], pointRadius: 8, pointHoverRadius: 12 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      onClick: function(e) {
        var pts = this.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
        if (pts.length > 0) {
          var idx = pts[0].datasetIndex;
          var di = pts[0].index;
          var prod = this.data.datasets[idx].data[di].prodName;
          if (prod && App.filterProductByQuad) App.filterProductByQuad(prod);
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 10 }, generateLabels: function() {
          return Object.keys(quad2Colors).map(function(k) { return { text: k, fillStyle: quad2Colors[k], strokeStyle: quad2Colors[k], pointStyle: 'circle' }; });
        }}},
        tooltip: { callbacks: { label: function(ctx) {
          var d = ctx.raw;
          return d.prodName + ': 覆盖率' + d.x.toFixed(1) + '% 增速' + (d.y >= 0 ? '+' : '') + d.y.toFixed(1) + '% 销售额¥' + (d.amount || 0) + '万';
        }}}
      },
      scales: {
        x: { title: { display: true, text: '客户覆盖率 (%)', font: { size: 10 } }, grid: { color: '#f3f4f6' }, min: 0, max: 60 },
        y: { title: { display: true, text: '销售额同比增速 (%)', font: { size: 10 } }, grid: { color: '#f3f4f6' }, min: -30, max: 100 }
      }
    },
    plugins: [{
      id: 'quadAnnotations',
      afterDraw: function(chart) {
        var ctx = chart.ctx, xS = chart.scales.x, yS = chart.scales.y;
        var xMid = xS.getPixelForValue(12), yMid = yS.getPixelForValue(10);
        var xL = xS.left, xR = xS.right, yT = yS.top, yB = yS.bottom;
        ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.moveTo(xMid, yT); ctx.lineTo(xMid, yB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xL, yMid); ctx.lineTo(xR, yMid); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#9ca3af'; ctx.font = '10px system-ui';
        ctx.textAlign = 'right'; ctx.fillText('①成熟核心', xR-8, yMid-8);
        ctx.textAlign = 'left';  ctx.fillText('②蓝海潜力', xMid+8, yMid-8);
        ctx.textAlign = 'left';  ctx.fillText('④弱势品类', xMid+8, yB-4);
        ctx.textAlign = 'right'; ctx.fillText('③增长见顶', xR-8, yB-4);
        ctx.restore();
      }
    }]
  });

  // ===== 19. 潜力产品·产品维度 — 多品类趋势对比折线图 =====
  var ptcCanvas=document.getElementById('chart-p-trend-compare'); App.charts.potTrendCompare = ptcCanvas ? new Chart(ptcCanvas, {
    type: 'line',
    data: { labels: ['08','09','10','11','12','01','02','03','04','05','06','07'], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 16, font: { size: 9 }, usePointStyle: true, padding: 8 } } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额(万)', font: { size: 10 } } },
        x: { grid: { display: false } }
      }
    }
}) : null;
})();
