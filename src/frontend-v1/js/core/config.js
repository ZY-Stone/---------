/**
 * field_config.js — 字段映射配置层（元数据驱动架构）
 *
 * 解决 PRD 核心问题：前端组件不应硬编码字段名，而应通过配置层动态适配导入数据。
 *
 * 三层模型：
 *   1. FieldConfig — 逻辑字段 → 实际列名的映射表
 *   2. Field.get()  — 动态字段访问器（替代 row.xxx 硬编码）
 *   3. Schema检测  — 导入时自动嗅探列名，更新 FieldConfig
 */
window.App = window.App || {};

// ===== 字段映射配置 =====
// 逻辑字段名 → 实际列名（默认值即导入模板标准表头）
// 导入时会根据实际 Excel 表头自动更新
App.FieldConfig = {
  // -- 产品宽度 --
  width: {
    user: {
      siebel:     'siebel',
      industry:   'industry',
      user:       'user',        // 最终用户
      sales:      'sales',       // 销售
      dept:       'dept',        // 销售部门
      guishang:   'guishang',    // 是否规上
      width:      'width',       // 产品线合计
      prods:      'prods',       // 产品覆盖对象（{产品名: 1/0}）
      contact:    'contact',     // 接口人
      level:      'level',       // 用户等级
    },
    cust: {
      siebel:     'siebel',
      name:       'name',        // 售达方描述
      sales:      'sales',
      dept:       'dept',
      guishang:   'guishang',
      width:      'width',
      prods:      'prods',
      contact:    'contact',
      level:      'level',
    }
  },

  // -- 潜力产品 --
  potential: {
    cust: {
      dept2:      'dept2',       // 二级部门/业务中心
      dept3:      'dept3',       // 三级部门/大部门
      dept4:      'dept4',       // 四级部门/团队小组
      dept5:      'dept5',       // 五级部门
      sales:      'sales',       // 负责销售
      product:    'product',     // 潜力产品
      custName:   'custName',    // 售达方名称
      userName:   'userName',    // 最终用户
      amount:     'amount',      // 销售额(万)
      amountPrev: 'amountPrev',  // 同期销售额
      yoy:        'yoy',         // 同比
      qty:        'qty',         // 销售数量
      qtyPrev:    'qtyPrev',     // 同期数量
      qtyYoy:     'qtyYoy',      // 数量同比
      opps:       'opps',        // 交易商机数
      oppsPrev:   'oppsPrev',    // 商机同期
      oppsYoy:    'oppsYoy',     // 商机同比
      users:      'users',       // 交易用户数
      usersPrev:  'usersPrev',   // 用户数同期
      usersYoy:   'usersYoy',    // 用户数同比
      contact:    'contact',     // 对接人
      level:      'level',       // 客户等级
    },
    user: {
      center:     'center',      // 业务中心
      dept3:      'dept3',
      dept4:      'dept4',
      dept5:      'dept5',
      sales:      'sales',
      contact:    'contact',
      userName:   'userName',
      industry:   'industry',
      product:    'product',
      outAmt:     'outAmt',      // 产品出库额(万)
      outAmtPrev: 'outAmtPrev',  // 出库额同期
      outYoy:     'outYoy',      // 出库额同比
      outQty:     'outQty',      // 出库数量
      outQtyPrev: 'outQtyPrev',  // 出库数量同期
      outQtyYoy:  'outQtyYoy',   // 出库数量同比
      opps:       'opps',
      oppsPrev:   'oppsPrev',
      oppsYoy:    'oppsYoy',
      users:      'users',
      usersPrev:  'usersPrev',
      usersYoy:   'usersYoy',
      custs:      'custs',       // 交易客户数
      custsPrev:  'custsPrev',
      custsYoy:   'custsYoy',
      level:      'level',
    }
  },

  // -- 宽度明细 --
  widthDetail: {
    team:       'team',
    account:    'account',
    user:       'user',
    width:      'width',
    guishang:   'guishang',
    prods:      'prods',
  }
};

// ===== 动态字段访问器 =====
// 替代硬编码的 row.xxx，通过 FieldConfig 映射查找实际字段名
App.Field = {
  /**
   * 从数据行中读取指定逻辑字段的值
   * @param {Object} row       数据行
   * @param {string} logicalName  逻辑字段名（如 'amount'）
   * @param {string} configPath   配置路径（如 'potential.cust'）
   * @param {*}      defaultValue 默认值
   */
  get: function(row, logicalName, configPath, defaultValue) {
    if (row == null) return defaultValue != null ? defaultValue : '';
    // 1. 尝试从 FieldConfig 查找映射
    var cfg = App.FieldConfig;
    var path = (configPath || '').split('.');
    for (var i = 0; i < path.length; i++) {
      cfg = cfg[path[i]];
      if (!cfg) break;
    }
    var actualName = cfg ? cfg[logicalName] : null;
    // 2. 用实际列名读取；如果没配映射，直接用逻辑名
    var key = actualName || logicalName;
    if (key in row) return row[key];
    return defaultValue != null ? defaultValue : '';
  },

  /**
   * 读字符串
   */
  g: function(row, logicalName, configPath, def) {
    var v = App.Field.get(row, logicalName, configPath, def);
    return v != null ? v : '';
  },

  /**
   * 读浮点数
   */
  gf: function(row, logicalName, configPath, def) {
    var v = parseFloat(App.Field.get(row, logicalName, configPath, def != null ? def : 0));
    return isNaN(v) ? (def != null ? def : 0) : v;
  },

  /**
   * 读整数
   */
  gi: function(row, logicalName, configPath, def) {
    var v = parseInt(App.Field.get(row, logicalName, configPath, def != null ? def : 0));
    return isNaN(v) ? (def != null ? def : 0) : v;
  },

  /**
   * 读布尔（中文字段 '是' → true）
   */
  gb: function(row, logicalName, configPath) {
    var v = App.Field.g(row, logicalName, configPath, '');
    if (v === true || v === 1) return true;
    if (typeof v === 'string' && v.indexOf('是') >= 0) return true;
    return false;
  },

  // ===== Schema 探测 =====
  /**
   * 根据 Excel 表头自动更新 FieldConfig 映射
   * @param {Array}  headers    表头数组
   * @param {string} configPath 配置路径（如 'potential.cust'）
   * @returns {Object} 探测结果 { mapped: 已匹配字段数, total: 总逻辑字段数, unmatched: 未匹配列表 }
   */
  detectSchema: function(headers, configPath) {
    var cfg = App.FieldConfig;
    var path = configPath.split('.');
    for (var i = 0; i < path.length; i++) {
      cfg = cfg[path[i]];
      if (!cfg) return { mapped: 0, total: 0, unmatched: [], error: '配置路径不存在: ' + configPath };
    }

    var headerSet = {};
    headers.forEach(function(h, i) {
      var s = String(h || '').trim();
      if (s) headerSet[s] = i;
    });

    var result = { mapped: 0, total: 0, unmatched: [], columns: [] };
    var logicalNames = Object.keys(cfg);
    result.total = logicalNames.length;

    // 遍历所有表头，尝试匹配逻辑字段
    headers.forEach(function(h, i) {
      var s = String(h || '').trim();
      if (!s) return;
      result.columns.push({ index: i, name: s });
    });

    // 对每个逻辑字段，在表头中查找最佳匹配
    logicalNames.forEach(function(logicalName) {
      var matched = false;
      var keywords = App.Field._getKeywords(logicalName);
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i] || '').trim();
        for (var k = 0; k < keywords.length; k++) {
          if (h.indexOf(keywords[k]) >= 0) {
            cfg[logicalName] = h;  // 更新映射为实际列名
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) {
        result.mapped++;
      } else {
        result.unmatched.push(logicalName);
      }
    });

    return result;
  },

  /**
   * 获取逻辑字段的关键词（用于表头匹配）
   */
  _getKeywords: function(logicalName) {
    var map = {
      'dept2':     ['二级部门', '业务中心'],
      'dept3':     ['三级部门', '大部门'],
      'dept4':     ['四级部门', '团队小组'],
      'dept5':     ['五级部门'],
      'sales':     ['销售雇员', '销售员', '负责销售', '销售'],
      'product':   ['潜力产品'],
      'custName':  ['售达方名称', '售达方', '客户名', '客户名称'],
      'userName':  ['最终用户名称', '最终用户', '用户名'],
      'user':      ['最终用户'],
      'amount':    ['销售额(万)', '销售额'],
      'amountPrev':['同期销售额', '同期(万)', '去年同期'],
      'outAmt':    ['产品出库额', '出库额(万)'],
      'outAmtPrev':['产品出库额同期', '出库额同期'],
      'qty':       ['销售数量', '数量'],
      'qtyPrev':   ['同期数量', '同期销售数量'],
      'outQty':    ['出库数量'],
      'outQtyPrev':['出库数量同期'],
      'guishang':  ['规上', '是否规上'],
      'width':     ['产品线合计', '产品宽度合计', '宽度合计'],
      'dept':      ['销售部门', '部门'],
      'name':      ['售达方描述', '客户', '售达方'],
      'contact':   ['对接人', '接口人'],
      'level':     ['等级', '客户等级', '用户等级'],
      'industry':  ['行业'],
      'siebel':    ['siebel', 'Siebel'],
      'prods':     ['IPC', '球机', 'NVR'],
    };
    return map[logicalName] || [logicalName];
  }
};

console.log('[FieldConfig] 字段映射配置层已加载，支持动态Schema探测');
