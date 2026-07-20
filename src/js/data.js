/**
 * data.js — Demo 数据集
 * 按页面 + 筛选维度预置多套数据，切换筛选时动态加载
 */
window.App = window.App || {};

// ===== 团队数据缩放系数 =====
var SCALE = {
  'all':       { sales: 1.00, customers: 1.00, width: 1.00 },
  '政府行业组': { sales: 0.40, customers: 0.35, width: 1.08 },
  '公安交警组': { sales: 0.28, customers: 0.30, width: 0.95 },
  '教育文化组': { sales: 0.18, customers: 0.20, width: 0.88 },
  '智能交通组': { sales: 0.14, customers: 0.15, width: 0.82 }
};

// ===== 产品宽度 Demo 数据 =====
App.Data = {};

// 总览页 KPI 基础值
var BASE_OVERVIEW = {
  sales: 28400, customers: 1247, users: 386, products: '27 / 27', productRate: '100%',
  avgPrice: 22.8, avgWidth: 3.96, potentialRate: '34.6%', potentialAmount: 9830,
  scaleRate: '71.2%', scaleCount: 888,
  salesYoY: '+18.2%', customersMoM: '+62', avgPriceYoY: '+9.4%', avgWidthYoY: '+0.42'
};

// 总览页 部门维度: 产品宽度
var BASE_OVERVIEW_DEPT_WIDTH = [
  { dept: '政府行业组', width: 4.28 },
  { dept: '公安交警组', width: 3.76 },
  { dept: '教育文化组', width: 3.48 },
  { dept: '智能交通组', width: 3.24 }
];

// 总览页 部门维度: 潜力产品销售额 (万元)
var BASE_OVERVIEW_DEPT_POTENTIAL = [
  { dept: '政府行业组', sales: 3850, yoy: '+15.2%' },
  { dept: '公安交警组', sales: 2620, yoy: '+10.8%' },
  { dept: '教育文化组', sales: 1740, yoy: '+6.5%'  },
  { dept: '智能交通组', sales: 1320, yoy: '-3.2%'  }
];

// 总览页预警
var BASE_ALERTS = [
  { cls: 'alert-risk', text: '下滑: 门禁 -23.5%' },
  { cls: 'alert-warn', text: '突破空白: 5个新客户已激活' },
  { cls: 'alert-warn', text: '待突破: 47个客户未覆盖IPC' },
  { cls: 'alert-good', text: '快速: NVR +58.3%' }
];

// 总览页销售人员宽度排名
var BASE_WIDTH_RANK = [
  ['陈思源', 18, 5.8, 10, '政府行业组'],
  ['王志强', 15, 5.2, 9, '政府行业组'],
  ['张伟',   12, 4.8, 8, '公安交警组'],
  ['李梦琪', 10, 4.3, 7, '政府行业组'],
  ['陈伟杰',  9, 4.1, 6, '政府行业组'],
  ['罗兴华',  8, 3.9, 6, '教育文化组'],
  ['张继成',  8, 3.6, 5, '公安交警组'],
  ['赵启超',  7, 3.4, 5, '智能交通组'],
  ['李金富',  7, 3.2, 4, '智能交通组'],
  ['徐宏源',  6, 3.0, 4, '教育文化组']
];

// 总览页潜力产品贡献排名
var BASE_POTENTIAL_RANK = [
  { name: '陈思源', amount: 1850, yoy: '+35%', share: '18.8%', team: '政府行业组' },
  { name: '王志强', amount: 1420, yoy: '+22%', share: '14.4%', team: '政府行业组' },
  { name: '张伟',   amount: 980,  yoy: '+18%', share: '10.0%', team: '公安交警组' },
  { name: '陈伟杰', amount: 850,  yoy: '+85%', share: '8.6%',  team: '政府行业组' },
  { name: '李梦琪', amount: 720,  yoy: '+12%', share: '7.3%',  team: '政府行业组' },
  { name: '罗兴华', amount: 650,  yoy: '+28%', share: '6.6%',  team: '教育文化组' },
  { name: '黄燕滨', amount: 580,  yoy: '+92%', share: '5.9%',  team: '教育文化组' },
  { name: '赵启超', amount: 480,  yoy: '+15%', share: '4.9%',  team: '智能交通组' },
  { name: '张继成', amount: 420,  yoy: '+42%', share: '4.3%',  team: '公安交警组' },
  { name: '李金富', amount: 360,  yoy: '+8%',  share: '3.7%',  team: '智能交通组' }
];

// 总览页潜力产品销售排名
var BASE_POTENTIAL_PRODUCT = [
  { product: 'NVR',      sales: 3210, yoy: '+58.3%', qty: '+42.1%', type: '量价齐升' },
  { product: '智能计算', sales: 2180, yoy: '新增',   qty: '+100%',  type: '新增' },
  { product: 'IPC',      sales: 1890, yoy: '+22.4%', qty: '+15.2%', type: '量价齐升' },
  { product: '平台软件', sales: 1420, yoy: '+18.7%', qty: '-3.2%',  type: '量跌价增' },
  { product: '门禁',     sales: 980,  yoy: '-23.5%', qty: '-18.6%', type: '量价齐跌' },
  { product: '智能交通', sales: 850,  yoy: '-11.2%', qty: '-5.4%',  type: '量价齐跌' },
  { product: '存储',     sales: 720,  yoy: '+8.4%',  qty: '+12.3%', type: '量价齐升' },
  { product: 'LCD与解码', sales: 610, yoy: '+5.2%',  qty: '+8.7%',  type: '量价齐升' }
];

// 产品宽度页 KPI 基础值
var BASE_WIDTH = {
  customers: 1247, scaleUp: 888, nonScale: 359,
  avgWidth: 3.96, maxWidth: 10, maxCust: '深圳市政府',
  coverage: '71.2%', widthYoY: '+0.42'
};

// 产品宽度页缺失分析
var BASE_MISSING = [
  { product: '智能计算',  covered: 45,  missing: 843, rate: '5.1%',  bar: 5 },
  { product: '专网摄像机', covered: 62,  missing: 826, rate: '7.0%',  bar: 7 },
  { product: '行业软件',  covered: 78,  missing: 810, rate: '8.8%',  bar: 9 },
  { product: '服务',      covered: 95,  missing: 793, rate: '10.7%', bar: 11 },
  { product: '门禁',      covered: 120, missing: 768, rate: '13.5%', bar: 14 }
];

// 产品覆盖热力图 - 27 品类（来源：凯玲产品宽度分析）
var BASE_HEATMAP_TOTAL = 471;
var BASE_HEATMAP_PRODS = [
  { name: 'IPC',              rate: 53.1, count: 250 },
  { name: 'NVR',              rate: 36.7, count: 173 },
  { name: '门禁',             rate: 27.8, count: 131 },
  { name: '球机',             rate: 24.6, count: 116 },
  { name: 'LCD与解码',        rate: 17.6, count: 83  },
  { name: '新业务',           rate: 17.4, count: 82  },
  { name: '通用软件',         rate: 16.3, count: 77  },
  { name: '网络产品',         rate: 14.6, count: 69  },
  { name: '存储',             rate: 11.5, count: 54  },
  { name: '专用摄像机',       rate: 9.3,  count: 44  },
  { name: '服务器',           rate: 8.9,  count: 42  },
  { name: '行业软件',         rate: 8.5,  count: 40  },
  { name: '智能计算',         rate: 7.9,  count: 37  },
  { name: '对讲',             rate: 7.6,  count: 36  },
  { name: '报警',             rate: 7.4,  count: 35  },
  { name: '出入口停车',       rate: 7.4,  count: 35  },
  { name: '人员通道',         rate: 6.4,  count: 30  },
  { name: '音频产品',         rate: 5.9,  count: 28  },
  { name: 'PCP产品',          rate: 4.5,  count: 21  },
  { name: 'LED与拼控',        rate: 4.5,  count: 21  },
  { name: '移动终端产品',     rate: 4.2,  count: 20  },
  { name: '智能交通',         rate: 4.0,  count: 19  },
  { name: '智慧屏与视频会议', rate: 3.6,  count: 17  },
  { name: '综合布线与机柜',   rate: 3.6,  count: 17  },
  { name: '基础软件',         rate: 1.9,  count: 9   },
  { name: '网络安全',         rate: 1.7,  count: 8   },
  { name: '传感产品',         rate: 0.8,  count: 4   }
];

// 产品宽度页 客户 TOP 列表（带产品明细，参考简刚平版）
var BASE_CUST_GOOD = [
  { name: '广东源水智能科技有限公司深圳分公司', avgW: 23.00, gsCnt: '1/1', soldCnt: 23, sold: ['IPC','球机','专用摄像机','监控器','网络产品','NVR','存储','LCD与解码','智能交通','出入口停车','门禁','对讲','人员通道','报警','音频产品','智慧屏与视频会议','通用软件','行业软件','基础软件','新业务','专网摄像机','服务器','智能计算'], person: '高峰10' },
  { name: '深圳市苍景科技有限公司',             avgW: 21.00, gsCnt: '1/1', soldCnt: 21, sold: ['IPC','NVR','门禁','球机','LCD与解码','监控器','智能交通','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务','智能计算'], person: '陈伟杰' },
  { name: '深圳市青葱互联网技术服务有限公司',   avgW: 20.00, gsCnt: '1/1', soldCnt: 20, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务','专网摄像机','智能计算'], person: '罗兴华' },
  { name: '深圳市光敏互联智能有限公司',         avgW: 18.00, gsCnt: '1/1', soldCnt: 18, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务'], person: '王志强' },
  { name: '顺丰科技有限公司',                   avgW: 17.00, gsCnt: '1/1', soldCnt: 17, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器'], person: '彭城12' },
  { name: '深圳市洪创科技有限公司',             avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市南粤实业有限公司',             avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市方联仕业科技有限公司',         avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市鑫天网网络科技有限公司',       avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '彭城12' },
  { name: '维语技术有限公司',                   avgW: 15.00, gsCnt: '1/1', soldCnt: 15, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏'], person: '陈伟杰' }
];
var BASE_CUST_BAD = [
  { name: '深圳市瑞图同创科技有限公司',         avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '彭城12' },
  { name: '深圳市汇蒙山科技有限公司',           avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '王鹏组' },
  { name: '广东联泰恒昌物业管理有限公司深圳分公司', avgW: 0.00, gsCnt: '0/1', soldCnt: 0, sold: [], person: '段金春' },
  { name: '深圳优控泰森科技开发有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳信易立信信息技术有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳芯鸿星通讯有限公司',             avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '智谋翼飞科技（深圳）有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳市鹏华汇汽车服务有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '童亮泽' },
  { name: '顺新鑫（广州）供应链管理服务有限公司厦门分公司', avgW: 0.00, gsCnt: '0/1', soldCnt: 0, sold: [], person: '孙天6' },
  { name: '深圳金蓝科技有限公司',               avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' }
];

// 产品宽度页 用户 TOP 列表（关联客户 + 产品明细）
var BASE_USER_GOOD = [
  { name: '深圳市公安局',       avgW: 6.20, custCnt: 12, soldCnt: 18, sold: ['IPC','NVR','门禁','球机','智能交通','LCD与解码','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','网络产品','服务器','新业务','专用摄像机'], custs: '深圳市政府、宝安公安局、龙岗分局' },
  { name: '深圳市教育局',       avgW: 5.10, custCnt: 8,  soldCnt: 14, sold: ['IPC','NVR','LCD与解码','平台软件','门禁','球机','存储','对讲','人员通道','通用软件','行业软件','基础软件','智慧屏','音频产品'], custs: '罗湖教育局、南山区教育局、福田区教育局' },
  { name: '广东省交通厅',       avgW: 4.50, custCnt: 6,  soldCnt: 11, sold: ['智能交通','IPC','存储','NVR','球机','门禁','LCD与解码','网络产品','通用软件','行业软件','服务器'], custs: '广东省高速、广州市交委、深圳市交通局' },
  { name: '深圳市卫健委',       avgW: 3.80, custCnt: 5,  soldCnt: 9,  sold: ['IPC','门禁','通用','存储','NVR','球机','对讲','人员通道','报警'], custs: '市人民医院、宝安医院、罗湖医院' },
  { name: '深圳市文体局',       avgW: 3.20, custCnt: 4,  soldCnt: 8,  sold: ['LCD','新业务','通用','IPC','NVR','门禁','平台软件','智慧屏'], custs: '市图书馆、市体育馆、市博物馆、市文化馆' }
];
var BASE_USER_BAD = [
  { name: '深圳市气象局',       avgW: 0.40, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '深圳市气象局' },
  { name: '深圳市水务集团',     avgW: 0.60, custCnt: 2,  soldCnt: 1,  sold: ['对讲'], custs: '深圳水务集团、深圳清源水务' },
  { name: '深圳市城管局',       avgW: 0.80, custCnt: 1,  soldCnt: 2,  sold: ['IPC','通用软件'], custs: '深圳市城管局' },
  { name: '深圳市规划与自然资源局', avgW: 0.50, custCnt: 1, soldCnt: 1, sold: ['IPC'], custs: '深圳市规划与自然资源局' },
  { name: '深圳市审计局',       avgW: 0.30, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '深圳市审计局' }
];

// 潜力产品页 KPI 基础值
var BASE_POTENTIAL = {
  sales: 9830, share: '34.6%',
  upCount: 5, upAmount: 5200,
  downCount: 2, downAmount: 1800,
  newCount: 3, newAmount: 480
};

// 潜力产品页 客户矩阵
var BASE_MATRIX = [
  ['深圳市政府', '+125%', '新增', '+45%', '+18%', '未覆盖', '未覆盖', '+22%'],
  ['宝安公安局', '+68%',  '未覆盖', '+22%', '-5%', '-32%', '+12%', '+8%'],
  ['罗湖教育局', '+42%',  '新增', '+15%', '未覆盖', '未覆盖', '未覆盖', '+5%'],
  ['招商17',    '+38%',  '未覆盖', '+8%', '-2%', '-15%', '未覆盖', '未覆盖'],
  ['高峰10',    '+85%',  '新增', '+25%', '+12%', '未覆盖', '未覆盖', '+18%'],
  ['沙头',      '+52%',  '未覆盖', '+10%', '+3%', '-8%', '未覆盖', '未覆盖']
];

// 潜力产品页销售排名
var BASE_SALES_RANK = [
  ['陈思源', 1850, '+35%', '18.8%', '政府行业组'],
  ['王志强', 1420, '+22%', '14.4%', '政府行业组'],
  ['张伟',    980, '+18%', '10.0%', '公安交警组'],
  ['陈伟杰',  850, '+85%', '8.6%',  '政府行业组'],
  ['李梦琪',  720, '+12%', '7.3%',  '政府行业组'],
  ['罗兴华',  650, '+28%', '6.6%',  '教育文化组'],
  ['黄燕滨',  580, '+92%', '5.9%',  '教育文化组'],
  ['赵启超',  480, '+15%', '4.9%',  '智能交通组'],
  ['张继成',  420, '+42%', '4.3%',  '公安交警组'],
  ['李金富',  360, '+8%',  '3.7%',  '智能交通组']
];

// 经营概览 (整合自乔梦杰版): 团队小组 × 8 潜力产品
// 列: 团队\小组 / NVR / 智能计算 / IPC / 平台软件 / 门禁 / 智能交通 / 存储 / LCD与解码 / 本期合计 / 同期合计 / 整体同比
var BASE_TEAM_PROD_MATRIX = [
  { team: '政府行业组-陈思源组',   nvr: 850,  ai: 480, ipc: 580, sw: 420, ac: 180, it: 90,  st: 220, lcd: 150, prev: 2480, yoy: '+25.8%' },
  { team: '政府行业组-王志强组',   nvr: 720,  ai: 380, ipc: 420, sw: 320, ac: 130, it: 60,  st: 180, lcd: 110, prev: 1900, yoy: '+22.1%' },
  { team: '政府行业组-李梦琪组',   nvr: 480,  ai: 220, ipc: 280, sw: 180, ac: 90,  it: 40,  st: 130, lcd: 80,  prev: 1280, yoy: '+15.3%' },
  { team: '公安交警组-张伟组',     nvr: 380,  ai: 60,  ipc: 250, sw: 130, ac: 240, it: 120, st: 95,  lcd: 60,  prev: 1180, yoy: '+12.5%' },
  { team: '公安交警组-张继成组',   nvr: 280,  ai: 40,  ipc: 180, sw: 90,  ac: 180, it: 80,  st: 70,  lcd: 45,  prev: 850,  yoy: '+8.2%'  },
  { team: '教育文化组-罗兴华组',   nvr: 220,  ai: 30,  ipc: 130, sw: 220, ac: 50,  it: 25,  st: 55,  lcd: 75,  prev: 720,  yoy: '+12.5%' },
  { team: '教育文化组-黄燕滨组',   nvr: 180,  ai: 25,  ipc: 95,  sw: 180, ac: 40,  it: 20,  st: 40,  lcd: 50,  prev: 510,  yoy: '+23.5%' },
  { team: '智能交通组-赵启超组',   nvr: 130,  ai: 15,  ipc: 80,  sw: 65,  ac: 35,  it: 380, st: 50,  lcd: 30,  prev: 690,  yoy: '-8.5%'  },
  { team: '智能交通组-李金富组',   nvr: 95,   ai: 8,   ipc: 55,  sw: 45,  ac: 25,  it: 250, st: 30,  lcd: 20,  prev: 480,  yoy: '+5.2%'  }
];

// 经营概览: 二级部门销售排名 (政府行业组/公安交警组/教育文化组/智能交通组)
var BASE_DEPT_RANK = [
  { dept: '政府行业组', sales: 3850, yoy: 15.2 },
  { dept: '公安交警组', sales: 2620, yoy: 10.8 },
  { dept: '教育文化组', sales: 1740, yoy:  6.5 },
  { dept: '智能交通组', sales: 1320, yoy: -3.2 }
];

// 经营概览: 销售量构成 (按产品, 12 潜力产品)
var BASE_PROD_COMPOSITION = [
  { product: 'NVR',          sales: 3210, color: '#1a56db' },
  { product: '智能计算',      sales: 2180, color: '#7c3aed' },
  { product: 'IPC',          sales: 1890, color: '#10b981' },
  { product: '平台软件',      sales: 1420, color: '#f59e0b' },
  { product: '门禁',          sales:  980, color: '#ef4444' },
  { product: '智能交通',      sales:  850, color: '#06b6d4' },
  { product: '存储',          sales:  720, color: '#3b82f6' },
  { product: 'LCD与解码',     sales:  610, color: '#84cc16' },
  { product: '出入口停车',     sales:  420, color: '#a855f7' },
  { product: '音频产品',      sales:  320, color: '#ec4899' },
  { product: '人员通道',      sales:  180, color: '#14b8a6' },
  { product: '行业软件',      sales:  150, color: '#f97316' }
];

// 经营概览: 本期 vs 同期 + 产品同比趋势 (按月, 近 12 月)
var BASE_PROD_YOY_MONTHS = ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'];
// 4 个核心潜力产品的本期/同期数据 (单位: 万元)
var BASE_PROD_YOY_DATA = [
  { prod: 'NVR',      curr: [1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210], prev: [800, 850, 880, 920, 960, 1010,1080,1150,1220,1300,1680,2030] },
  { prod: '智能计算',   curr: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1200, 2180], prev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { prod: 'IPC',      curr: [1100,1180,1220,1280,1320,1380,1420,1500,1580,1650,1780,1890], prev: [950, 980, 1010, 1050, 1090, 1130, 1170, 1230, 1290, 1350, 1430, 1540] },
  { prod: '门禁',      curr: [1650,1620,1580,1520,1450,1400,1350,1280,1200,1100,1020, 980], prev: [1250,1280,1310,1340,1370,1400,1430,1440,1450,1440,1430,1280] }
];

// 经营概览: 量价四象限 (X=数量同比%, Y=金额同比%, 颜色=分类)
var BASE_QUADRANT = [
  { product: 'NVR',        qtyYoY:  42.1, amtYoY:  58.3, type: '量价齐升' },
  { product: '智能计算',    qtyYoY: 100.0, amtYoY: 100.0, type: '新增' },
  { product: 'IPC',        qtyYoY:  15.2, amtYoY:  22.4, type: '量价齐升' },
  { product: '平台软件',    qtyYoY:  -3.2, amtYoY:  18.7, type: '量跌价增' },
  { product: '门禁',        qtyYoY: -18.6, amtYoY: -23.5, type: '量价齐跌' },
  { product: '智能交通',    qtyYoY:  -5.4, amtYoY: -11.2, type: '量价齐跌' },
  { product: '存储',        qtyYoY:  12.3, amtYoY:   8.4, type: '量价齐升' },
  { product: 'LCD与解码',   qtyYoY:   8.7, amtYoY:   5.2, type: '量价齐升' },
  { product: '出入口停车',   qtyYoY:  18.5, amtYoY:  15.2, type: '量价齐升' },
  { product: '音频产品',    qtyYoY:   6.3, amtYoY:   2.8, type: '量价齐升' },
  { product: '人员通道',    qtyYoY:  -2.5, amtYoY:  -1.8, type: '量价齐跌' },
  { product: '行业软件',    qtyYoY:  25.0, amtYoY:  32.5, type: '量价齐升' }
];

// 经营概览: 大部门 × 产品 差距热图数据 (整合自乔梦杰版)
// 12 个潜力产品 × 4 团队 销售额(万元)
var BASE_GAP_HEATMAP_PRODS = [
  'NVR', '智能计算', 'IPC', '平台软件', '门禁', '智能交通',
  '存储', 'LCD与解码', '出入口停车', '音频产品', '人员通道', '行业软件'
];
var BASE_GAP_HEATMAP_TEAMS = [
  { team: '政府行业组',   data: [ 850, 480, 580, 420, 180,  90, 220, 150,  60,  45,  35,  80] },
  { team: '公安交警组',   data: [ 660, 100, 430, 220, 420, 200, 165, 105,  40,  30,  25,  35] },
  { team: '教育文化组',   data: [ 400,  55, 225, 400,  90,  45,  95, 125,  30,  20,  15,  40] },
  { team: '智能交通组',   data: [ 225,  23, 135, 110,  60, 630,  80,  50,  20,  10,  10,  15] }
];

// 经营概览: 销售人员潜力产品排名 (整合自乔梦杰版)
// 12 潜力产品, 每个销售员标注覆盖/未覆盖
var BASE_SALES_POTENTIAL_RANK = [
  { rank: 1, name: '陈思源', team: '政府行业组', sales: 1850, prev: 1370, yoy: '+35%',  covered: ['NVR','智能计算','IPC','平台软件','门禁','存储','LCD与解码','出入口停车'], uncovered: ['智能交通','音频产品','人员通道','行业软件'] },
  { rank: 2, name: '王志强', team: '政府行业组', sales: 1420, prev: 1164, yoy: '+22%',  covered: ['NVR','IPC','平台软件','门禁','存储','LCD与解码','出入口停车'], uncovered: ['智能计算','智能交通','音频产品','人员通道','行业软件'] },
  { rank: 3, name: '张伟',   team: '公安交警组', sales:  980, prev:  831, yoy: '+18%',  covered: ['NVR','IPC','门禁','智能交通','存储','出入口停车','音频产品'], uncovered: ['智能计算','平台软件','LCD与解码','人员通道','行业软件'] },
  { rank: 4, name: '陈伟杰', team: '政府行业组', sales:  850, prev:  459, yoy: '+85%',  covered: ['智能计算','NVR','IPC','平台软件','LCD与解码','存储'], uncovered: ['门禁','智能交通','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 5, name: '李梦琪', team: '政府行业组', sales:  720, prev:  643, yoy: '+12%',  covered: ['NVR','LCD与解码','存储','IPC','平台软件'], uncovered: ['智能计算','门禁','智能交通','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 6, name: '罗兴华', team: '教育文化组', sales:  650, prev:  508, yoy: '+28%',  covered: ['平台软件','LCD与解码','行业软件','NVR','存储'], uncovered: ['智能计算','门禁','智能交通','出入口停车','音频产品','人员通道','IPC'] },
  { rank: 7, name: '黄燕滨', team: '教育文化组', sales:  580, prev:  302, yoy: '+92%',  covered: ['智能计算','平台软件','NVR','LCD与解码','行业软件','存储','IPC'], uncovered: ['门禁','智能交通','出入口停车','音频产品','人员通道'] },
  { rank: 8, name: '赵启超', team: '智能交通组', sales:  480, prev:  417, yoy: '+15%',  covered: ['智能交通','NVR','存储','IPC'], uncovered: ['智能计算','平台软件','门禁','LCD与解码','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 9, name: '张继成', team: '公安交警组', sales:  420, prev:  296, yoy: '+42%',  covered: ['门禁','NVR','IPC','出入口停车','人员通道'], uncovered: ['智能计算','平台软件','智能交通','LCD与解码','存储','音频产品','行业软件'] },
  { rank: 10, name: '李金富', team: '智能交通组', sales:  360, prev:  333, yoy: '+8%',  covered: ['智能交通','存储','IPC','出入口停车'], uncovered: ['NVR','智能计算','平台软件','门禁','LCD与解码','音频产品','人员通道','行业软件'] }
];

// ===== 数据切片生成函数 =====
function scaleKpi(base, factor, decimals) {
  decimals = decimals || 0;
  return Math.round(base * factor * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function scaleYoY(base, factor) {
  // 同比百分比随因子微调
  var num = parseFloat(base);
  var adjusted = num + (factor - 1) * 5;
  return (adjusted > 0 ? '+' : '') + adjusted.toFixed(1) + '%';
}

/**
 * 生成 Overview 页某个团队的数据切片
 */
App.Data.getOverview = function(team) {
  var f = SCALE[team] || SCALE['all'];
  var s = scaleKpi;

  return {
    kpi: {
      sales:         '¥ ' + (s(BASE_OVERVIEW.sales, f.sales) / 10000).toFixed(2) + '亿',
      customers:     s(BASE_OVERVIEW.customers, f.customers),
      users:         s(BASE_OVERVIEW.users, f.customers),
      products:      '27 / 27',
      productRate:   '100%',
      avgPrice:      '¥ ' + (s(BASE_OVERVIEW.avgPrice * 10000, f.sales / f.customers) / 10000).toFixed(1) + '万',
      avgWidth:      s(BASE_OVERVIEW.avgWidth, f.width).toFixed(2),
      potentialRate: (s(parseFloat(BASE_OVERVIEW.potentialRate), 1) + (f.sales - 1) * 2).toFixed(1) + '%',
      potentialAmt:  '¥ ' + s(BASE_OVERVIEW.potentialAmount, f.sales).toLocaleString() + '万',
      scaleRate:     (s(parseFloat(BASE_OVERVIEW.scaleRate), 1) + (f.sales - 1) * 3).toFixed(1) + '%',
      scaleCount:    s(BASE_OVERVIEW.scaleCount, f.customers),
      salesYoY:      scaleYoY(BASE_OVERVIEW.salesYoY, f.sales),
      customersMoM:  '+' + s(62, f.customers),
      avgPriceYoY:   scaleYoY(BASE_OVERVIEW.avgPriceYoY, f.sales),
      avgWidthYoY:   scaleYoY(BASE_OVERVIEW.avgWidthYoY, f.width)
    },
    alerts: team === 'all' ? BASE_ALERTS : BASE_ALERTS.slice(0, 2).concat([
      { cls: 'alert-warn', text: '待突破: ' + s(47, f.customers) + '个客户未覆盖IPC' }
    ]),
    widthRank: BASE_WIDTH_RANK.filter(function(r) {
      return team === 'all' || r[4] === team;
    }).slice(0, team === 'all' ? 10 : 5),
    potentialRank: BASE_POTENTIAL_RANK.filter(function(r) {
      return team === 'all' || r.team === team;
    }).slice(0, team === 'all' ? 10 : 5),
    potentialProduct: BASE_POTENTIAL_PRODUCT.map(function(p) {
      return {
        product: p.product,
        sales: s(p.sales, f.sales),
        yoy: p.yoy,
        qty: p.qty,
        type: p.type
      };
    }),
    // 部门维度对比: 产品宽度
    deptWidth: BASE_OVERVIEW_DEPT_WIDTH.map(function(d) {
      return { dept: d.dept, width: parseFloat((d.width * (team === 'all' ? 1 : f.width)).toFixed(2)) };
    }),
    // 部门维度对比: 潜力产品
    deptPotential: BASE_OVERVIEW_DEPT_POTENTIAL.map(function(d) {
      return { dept: d.dept, sales: s(d.sales, team === 'all' ? 1 : f.sales), yoy: d.yoy };
    })
  };
};

/**
 * 生成 Width 页某个团队的数据切片
 */
App.Data.getWidth = function(team) {
  var f = SCALE[team] || SCALE['all'];
  var s = scaleKpi;

  return {
    kpi: {
      customers: s(BASE_WIDTH.customers, f.customers),
      scaleUp: s(BASE_WIDTH.scaleUp, f.customers),
      nonScale: s(BASE_WIDTH.nonScale, f.customers),
      avgWidth: s(BASE_WIDTH.avgWidth, f.width).toFixed(2),
      maxWidth: f.width > 1.02 ? 10 : (f.width > 0.9 ? 8 : 6),
      maxCust: f.width > 1.02 ? '深圳市政府' : (f.width > 0.9 ? '宝安公安局' : '罗湖教育局'),
      coverage: (s(parseFloat(BASE_WIDTH.coverage), f.customers / (f.customers + 359)).toFixed(1)) + '%',
      widthYoY: scaleYoY(BASE_WIDTH.widthYoY, f.width)
    },
    missing: BASE_MISSING.map(function(m) {
      return {
        product: m.product,
        covered: s(m.covered, f.customers),
        missing: s(m.missing, f.customers),
        rate: (s(parseFloat(m.rate), 1 / f.customers) + 2).toFixed(1) + '%',
        bar: Math.min(100, Math.round(s(m.bar, 1 / f.customers) + 2))
      };
    }),
    // 宽度分布图表数据
    chartDist: {
      labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'],
      data: [s(42,1/f.customers), s(302,f.customers), s(66,f.customers), s(34,f.customers), s(18,f.customers), s(9,f.customers)]
    },
    // 团队宽度排名图表
    chartTeam: {
      labels: team === 'all'
        ? ['政府组','罗湖组','高峰10','沙头','王鹏组','彭城12','招商17','熊佳豪','陈思源','段金春']
        : ['一组','二组','三组'],
      data: team === 'all'
        ? [10.5, 7, 6, 5.4, 5.2, 4.8, 4, 4, 3.9, 3.4]
        : [s(8,f.width).toFixed(1), s(6,f.width).toFixed(1), s(5,f.width).toFixed(1)]
    },
    // 覆盖率图表
    chartCov: {
      labels: ['IPC','NVR','门禁','球机','LCD'],
      data: [s(53.1, f.width).toFixed(0), s(36.7, f.width).toFixed(0), s(27.8, f.width).toFixed(0), s(24.6, f.width).toFixed(0), s(17.6, f.width).toFixed(0)]
    },
    // 规上 vs 非规上
    chartReg: {
      customers: s(471, f.customers),
      avgWidth: s(3.2, f.width).toFixed(1)
    },
    // 产品覆盖热力图 (27 品类)
    heatmap: (function() {
      var total = s(BASE_HEATMAP_TOTAL, f.customers);
      var products = BASE_HEATMAP_PRODS.map(function(p) {
        var cnt = s(p.count, f.customers);
        return {
          name:  p.name,
          count: cnt,
          rate:  parseFloat(((cnt / total) * 100).toFixed(1))
        };
      });
      return { total: total, products: products };
    })(),
    // 客户产品宽度覆盖 TOP 10 / 后 10
    custGood: BASE_CUST_GOOD,
    custBad:  BASE_CUST_BAD,
    // 用户产品宽度覆盖 TOP / 后 5
    userGood: BASE_USER_GOOD,
    userBad:  BASE_USER_BAD
  };
};

/**
 * 生成 Potential 页某个团队的数据切片
 */
App.Data.getPotential = function(team) {
  var f = SCALE[team] || SCALE['all'];
  var s = scaleKpi;

  return {
    kpi: {
      sales: '¥ ' + s(BASE_POTENTIAL.sales, f.sales).toLocaleString() + '万',
      share: (s(parseFloat(BASE_POTENTIAL.share), 1) + (f.sales - 1) * 2).toFixed(1) + '%',
      upCount: Math.max(1, s(BASE_POTENTIAL.upCount, f.sales)),
      upAmount: '¥ ' + s(BASE_POTENTIAL.upAmount, f.sales).toLocaleString() + '万',
      downCount: s(BASE_POTENTIAL.downCount, 1),
      downAmount: '¥ ' + s(BASE_POTENTIAL.downAmount, f.sales).toLocaleString() + '万',
      newCount: s(BASE_POTENTIAL.newCount, f.sales),
      newAmount: '¥ ' + s(BASE_POTENTIAL.newAmount, f.sales).toLocaleString() + '万'
    },
    top10: BASE_POTENTIAL_PRODUCT.map(function(p) {
      return { product: p.product, sales: '¥ ' + s(p.sales, f.sales).toLocaleString() + '万', yoy: p.yoy, qty: p.qty, type: p.type };
    }),
    matrix: team === 'all' ? BASE_MATRIX : BASE_MATRIX.slice(0, 3),
    salesRank: BASE_SALES_RANK.filter(function(r) {
      return team === 'all' || r[4] === team;
    }).slice(0, team === 'all' ? 10 : 5),
    // ===== 经营概览 (整合自乔梦杰版) =====
    // 5 KPI 卡片
    overview: {
      sales:        s(BASE_POTENTIAL.sales, f.sales),                                  // 万元
      salesPrev:    s(Math.round(BASE_POTENTIAL.sales * 0.78), f.sales),               // 同期 (模拟 78% base)
      productCount: 12,                                                                 // 潜力产品数
      customerCount: s(386, f.customers),                                               // 客户数
      customerPrev:  s(312, f.customers),                                               // 同期客户数
      avgPrice:     parseFloat((s(BASE_POTENTIAL.sales, f.sales) / s(386, f.customers)).toFixed(1)),
      deptCount:    4                                                                    // 二级部门数
    },
    // 团队 × 产品矩阵
    teamProdMatrix: BASE_TEAM_PROD_MATRIX,
    // 部门销售排名
    deptRank: BASE_DEPT_RANK,
    // 销售量构成
    prodComposition: BASE_PROD_COMPOSITION,
    // 产品同比趋势
    prodYoY: { months: BASE_PROD_YOY_MONTHS, data: BASE_PROD_YOY_DATA },
    // 量价四象限
    quadrant: BASE_QUADRANT,
    // 大部门 x 产品 差距热图 (整合自乔梦杰版)
    gapHeatmap: {
      prods: BASE_GAP_HEATMAP_PRODS,
      teams: BASE_GAP_HEATMAP_TEAMS
    },
    // 销售人员潜力产品排名 (整合自乔梦杰版)
    salesPotentialRank: BASE_SALES_POTENTIAL_RANK
  };
};
