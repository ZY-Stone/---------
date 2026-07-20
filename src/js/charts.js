/**
 * charts.js — Chart.js 图表配置与初始化
 * 依赖: Chart.js CDN（全局 Chart 对象）
 */

// ===== Chart.js 全局默认配置 =====
Chart.defaults.font.family = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
Chart.defaults.font.size = 10.5;
Chart.defaults.color = '#6b7280';
Chart.defaults.plugins.legend.labels.boxWidth = 10;

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
    App.charts.ovDeptWidth = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['政府行业组', '公安交警组', '教育文化组', '智能交通组'],
        datasets: [{ data: [4.28, 3.76, 3.48, 3.24], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'], borderRadius: 6, barPercentage: .5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) { return '客均宽度: ' + ctx.raw; } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '客均宽度', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }
})();

// ===== 总览: 潜力产品 — 按部门 =====
(function() {
  var canvas = document.getElementById('chart-ov-dept-potential');
  if (canvas) {
    App.charts.ovDeptPotential = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['政府行业组', '公安交警组', '教育文化组', '智能交通组'],
        datasets: [{ data: [3850, 2620, 1740, 1320], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'], borderRadius: 6, barPercentage: .5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(ctx) { return '潜力产品销售额: ¥' + ctx.raw.toLocaleString() + '万'; } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额 (万)', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }
})();

// ===== 3. 产品宽度: 分布 =====
App.charts.wDist = makeBar(
  ['0', '1-3', '4-6', '7-10', '11-15', '16+'],
  [42, 302, 66, 34, 18, 9],
  '#3b82f6',
  'chart-w-dist'
);

// ===== 4. 产品宽度: 各团队平均 =====
App.charts.wTeam = makeBar(
  ['政府组', '罗湖组', '高峰10', '沙头', '王鹏组', '彭城12', '招商17', '熊佳豪', '陈思源', '段金春'],
  [10.5, 7, 6, 5.4, 5.2, 4.8, 4, 4, 3.9, 3.4],
  '#1a56db',
  'chart-w-team',
  { scales: { x: { ticks: { maxRotation: 45, font: { size: 9 } } } } }
);

// ===== 4.5 分组对比: 雷达图 (产品覆盖率对比) =====
(function() {
  var canvas = document.getElementById('chart-w-compare-radar');
  if (canvas) {
    App.charts.wCompareRadar = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专用摄像机','服务器','行业软件','智能计算','对讲','报警'],
        datasets: [
          { label: '对比组A', data: [53.1, 36.7, 27.8, 24.6, 17.6, 17.4, 16.3, 14.6, 11.5, 9.3, 8.9, 8.5, 7.9, 7.6, 7.4], fill: true, backgroundColor: 'rgba(26, 86, 219, 0.18)', borderColor: '#1a56db', pointBackgroundColor: '#1a56db', pointRadius: 3, borderWidth: 2 },
          { label: '对比组B', data: [36.7, 27.8, 24.6, 17.6, 17.4, 16.3, 14.6, 11.5, 9.3, 8.9, 8.5, 7.9, 7.6, 7.4, 7.0], fill: true, backgroundColor: 'rgba(220, 38, 38, 0.15)', borderColor: '#dc2626', pointBackgroundColor: '#dc2626', pointRadius: 3, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
        scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 20, font: { size: 9 } }, pointLabels: { font: { size: 10 } }, grid: { color: '#e5e7eb' }, angleLines: { color: '#e5e7eb' } } }
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
      data: {
        labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'],
        datasets: [
          { label: '对比组A', data: [42, 302, 66, 34, 18, 9], backgroundColor: '#1a56db', borderRadius: 4, barPercentage: .75 },
          { label: '对比组B', data: [56, 350, 78, 28, 12, 5], backgroundColor: '#dc2626', borderRadius: 4, barPercentage: .75 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '客户数', font: { size: 11 } } }
        }
      }
    });
  }
})();

// ===== 5. 产品宽度: 覆盖率 TOP 15 =====
App.charts.wCov = makeHBar(
  ['IPC', 'NVR', '门禁', '球机', 'LCD', '新业务', '通用', '网络', '存储', '专摄', '服务', '行业', '智能', '对讲', '报警'],
  [53.1, 36.7, 27.8, 24.6, 17.6, 17.4, 16.3, 14.6, 11.5, 9.3, 8.9, 8.5, 7.9, 7.6, 7.4],
  '#10b981',
  'chart-w-cov'
);

// ===== 6. 产品宽度: 规上 vs 非规上（双轴混合图） =====
App.charts.wReg = new Chart(document.getElementById('chart-w-reg'), {
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

// ===== 6b. 产品宽度: 历史趋势（折线图） =====
new Chart(document.getElementById('chart-width-trend'), {
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

// ===== 7. 潜力产品: 量价四象限（散点图） =====
var quadCtx = document.getElementById('chart-quadrant').getContext('2d');
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

// ===== 8. 潜力产品: 行业分布（饼图） =====
new Chart(document.getElementById('chart-industry'), {
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
new Chart(document.getElementById('chart-trend'), {
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
new Chart(document.getElementById('chart-ov-width-trend'), {
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
        label: '规上客户平均宽度',
        data: [5.1, 5.2, 5.2, 5.3, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0],
        borderColor: '#10b981', tension: .3, fill: false, pointRadius: 4, pointBackgroundColor: '#10b981'
      },
      {
        label: '非规上客户平均宽度',
        data: [1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5, 1.5, 1.5, 1.6, 1.6],
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

// ===== 12. 总览: 潜力产品历史趋势 (近12月) =====
new Chart(document.getElementById('chart-ov-potential-trend'), {
  type: 'line',
  data: {
    labels: ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'],
    datasets: [
      {
        label: 'NVR',
        data: [1200, 1320, 1410, 1380, 1500, 1620, 1750, 1880, 2050, 2280, 2780, 3210],
        borderColor: '#1a56db', tension: .3, fill: false, pointRadius: 3
      },
      {
        label: '智能计算',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1200, 2180],
        borderColor: '#7c3aed', tension: .3, fill: false, pointRadius: 3, borderDash: [5, 3]
      },
      {
        label: 'IPC',
        data: [1100, 1180, 1220, 1280, 1320, 1380, 1420, 1500, 1580, 1650, 1780, 1890],
        borderColor: '#10b981', tension: .3, fill: false, pointRadius: 3
      },
      {
        label: '门禁',
        data: [1650, 1620, 1580, 1520, 1450, 1400, 1350, 1280, 1200, 1100, 1020, 980],
        borderColor: '#ef4444', tension: .3, fill: false, pointRadius: 3
      },
      {
        label: '平台软件',
        data: [950, 980, 1010, 1050, 1100, 1150, 1180, 1220, 1280, 1320, 1380, 1420],
        borderColor: '#f59e0b', tension: .3, fill: false, pointRadius: 3
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额(万)' } },
      x: { grid: { display: false } }
    }
  }
});

// ===== 13. 潜力产品: 销售量构成 (按产品) — 水平柱图 =====
new Chart(document.getElementById('chart-p-composition'), {
  type: 'bar',
  data: {
    labels: ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','出入口停车','音频产品','人员通道','行业软件'],
    datasets: [{ data: [3210, 2180, 1890, 1420, 980, 850, 720, 610, 420, 320, 180, 150], backgroundColor: ['#1a56db','#7c3aed','#10b981','#f59e0b','#ef4444','#06b6d4','#3b82f6','#84cc16','#a855f7','#ec4899','#14b8a6','#f97316'], borderRadius: 4, barPercentage: .78 }]
  },
  options: {
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额 (万)', font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  }
});

// ===== 14. 潜力产品: 本期 vs 同期 · 产品同比趋势 (折线) =====
new Chart(document.getElementById('chart-p-yoy'), {
  type: 'line',
  data: {
    labels: ['08','09','10','11','12','01','02','03','04','05','06','07'],
    datasets: [
      { label: 'NVR 本期',      data: [1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210], borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.10)', tension: .3, fill: true, pointRadius: 3 },
      { label: 'NVR 同期',      data: [ 800, 850, 880, 920, 960,1010,1080,1150,1220,1300,1680,2030], borderColor: '#1a56db', borderDash: [5, 3], tension: .3, fill: false, pointRadius: 2 },
      { label: 'IPC 本期',      data: [1100,1180,1220,1280,1320,1380,1420,1500,1580,1650,1780,1890], borderColor: '#10b981', tension: .3, fill: false, pointRadius: 3 },
      { label: '智能计算 本期', data: [   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,1200,2180], borderColor: '#7c3aed', borderDash: [5, 3], tension: .3, fill: false, pointRadius: 3 },
      { label: '门禁 本期',     data: [1650,1620,1580,1520,1450,1400,1350,1280,1200,1100,1020, 980], borderColor: '#ef4444', tension: .3, fill: false, pointRadius: 3 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, title: { display: true, text: '销售额(万)', font: { size: 10 } } },
      x: { grid: { display: false } }
    }
  }
});

// ===== 15. 潜力产品: 量价四象限 (散点图) =====
new Chart(document.getElementById('chart-p-quadrant'), {
  type: 'scatter',
  data: {
    datasets: [
      { label: '量价齐升', data: [{x:42.1,y:58.3},{x:15.2,y:22.4},{x:12.3,y:8.4},{x:8.7,y:5.2},{x:18.5,y:15.2},{x:6.3,y:2.8},{x:25,y:32.5}], backgroundColor: '#10b981', pointRadius: 8 },
      { label: '新增',     data: [{x:100,y:100}],                                                                                          backgroundColor: '#7c3aed', pointRadius: 10, pointStyle: 'star' },
      { label: '量跌价增', data: [{x:-3.2,y:18.7}],                                                                                        backgroundColor: '#f59e0b', pointRadius: 8 },
      { label: '量价齐跌', data: [{x:-18.6,y:-23.5},{x:-5.4,y:-11.2},{x:-2.5,y:-1.8}],                                                    backgroundColor: '#ef4444', pointRadius: 8 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 10 } } },
      tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ' (' + ctx.parsed.x + '%, ' + ctx.parsed.y + '%)'; } } }
    },
    scales: {
      x: { min: -30, max: 110, grid: { color: '#f3f4f6' }, title: { display: true, text: '数量同比%', font: { size: 10 } }, ticks: { font: { size: 9 } } },
      y: { min: -30, max: 110, grid: { color: '#f3f4f6' }, title: { display: true, text: '金额同比%', font: { size: 10 } }, ticks: { font: { size: 9 } } }
    }
  }
});

// ===== 16. 潜力产品: 二级部门销售排名 (水平柱图) =====
new Chart(document.getElementById('chart-p-dept-rank'), {
  type: 'bar',
  data: {
    labels: ['政府行业组', '公安交警组', '教育文化组', '智能交通组'],
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
});

// ===== 17. 潜力产品: 空白产品率 & 待突破实体率 综合对比 (柱+线双轴) =====
// 12 个产品的空白率(%) 和 待突破率(%)
new Chart(document.getElementById('chart-p-gap-combined'), {
  type: 'bar',
  data: {
    labels: ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','出入口停车','音频产品','人员通道','行业软件'],
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
});
