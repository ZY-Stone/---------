/**
 * OrgPerm Filter — 数据权限过滤工具
 * 根据当前登录用户角色自动过滤数据
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  // ==================== 数据权限核心 ====================

  /**
   * 获取当前用户可见的部门名称列表
   * 根据用户的 role.scope 自动判断：
   *   all    → 全量（由外部传入或配置决定，这里返回 null 表示不过滤）
   *   dept   → 仅本部门
   *   group  → 仅本部门（因为组也属于部门）
   *   self   → 空
   */
  OP.getVisibleDeptIds = function (allDepts) {
    var user = OP.state.currentUser;
    if (!user) return allDepts ? allDepts.map(function (d) { return d.id; }) : [];

    var scope = user.role_scope || 'self';
    if (scope === 'all') return allDepts ? allDepts.map(function (d) { return d.id; }) : null;
    if (scope === 'dept' || scope === 'group') {
      return user.department_id ? [user.department_id] : [];
    }
    return [];
  };

  OP.getVisibleGroupIds = function (allGroups) {
    var user = OP.state.currentUser;
    if (!user) return allGroups ? allGroups.map(function (g) { return g.id; }) : [];

    var scope = user.role_scope || 'self';
    if (scope === 'all') return allGroups ? allGroups.map(function (g) { return g.id; }) : null;
    if (scope === 'dept') {
      if (!user.department_id || !allGroups) return [];
      return allGroups.filter(function (g) { return g.department_id === user.department_id; }).map(function (g) { return g.id; });
    }
    if (scope === 'group') {
      return user.group_id ? [user.group_id] : [];
    }
    return [];
  };

  /**
   * 通用过滤函数
   * @param {Array} dataArray - 待过滤的数据数组
   * @param {String} field - 数据中的字段名（用于匹配）
   * @param {String} scope - 'dept' | 'group' | 'person'
   * @param {Array} visibleIds - 可见的 ID 列表（null = 不限制，空 = 全不可见）
   */
  OP.filterByScope = function (dataArray, field, scope, visibleIds) {
    var user = OP.state.currentUser;
    if (!user) return dataArray;

    var userScope = user.role_scope || 'self';
    if (userScope === 'all') return dataArray;  // 管理员/总经理/运营 看全部

    if (visibleIds === null) return dataArray;
    if (visibleIds.length === 0) return [];

    return dataArray.filter(function (item) {
      return visibleIds.indexOf(item[field]) >= 0;
    });
  };

  /**
   * 过滤指定字段在可见值列表中的数据
   */
  OP.filterByVisible = function (dataArray, field, visibleValues) {
    if (!OP.state.currentUser) return dataArray;
    if (!visibleValues || visibleValues.length === 0) return [];
    return dataArray.filter(function (item) {
      return visibleValues.indexOf(item[field]) >= 0;
    });
  };

  // ==================== 便捷方法（兼容原 API） ====================
  OP.getVisibleDepts = function (allDeptNames) {
    var user = OP.state.currentUser;
    if (!user) return allDeptNames;
    if (user.role_scope === 'all') return allDeptNames;
    if (!user.dept) return [];
    return [user.dept];
  };

  OP.getVisibleGroups = function (allGroupNames) {
    var user = OP.state.currentUser;
    if (!user) return allGroupNames;
    if (user.role_scope === 'all') return allGroupNames;
    if (!user.grp) return [];
    return [user.grp];
  };

  // ==================== 数据范围描述 ====================
  OP.getDataScope = function () {
    var user = OP.state.currentUser;
    if (!user) return '未登录';
    switch (user.role_scope) {
      case 'all': return '全部数据';
      case 'dept': return user.dept || '本部门';
      case 'group': return (user.dept || '') + ' / ' + (user.grp || '本组');
      default: return '仅自己';
    }
  };

  // ==================== 权限检查 ====================
  OP.hasPermission = function (permCode) {
    var user = OP.state.currentUser;
    if (!user || !user.permissions) return false;
    return user.permissions.indexOf(permCode) >= 0;
  };

  OP.isAdmin = function () {
    var user = OP.state.currentUser;
    return user && user.role === 'admin';
  };

})();
