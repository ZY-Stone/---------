/**
 * api.js — 后端 API 封装层
 * 自动检测后端可用性，不可用时回退到本地 Mock 数据
 */
window.App = window.App || {};

App.API = (function() {
  var BASE = 'http://localhost:8800';
  var TOKEN = null;
  var _available = null;  // null=未检测, true=可用, false=不可用

  // ── 基础 fetch 封装 ──
  function request(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if (TOKEN) {
      headers['Authorization'] = 'Bearer ' + TOKEN;
    }
    return fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      if (!r.ok) {
        return r.json().then(function(e) { throw new Error(e.detail || '请求失败 (' + r.status + ')'); });
      }
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) return r.json();
      return r.blob();
    });
  }

  // ── 后端可用性检测 ──
  function checkAvailable() {
    if (_available !== null) return Promise.resolve(_available);
    return fetch(BASE + '/health', { method: 'GET', signal: AbortSignal.timeout(3000) })
      .then(function(r) { return r.json(); })
      .then(function(d) { _available = (d.status === 'ok'); return _available; })
      .catch(function() { _available = false; return false; });
  }

  // ── 认证 ──
  function login(username, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: { username: username, password: password }
    }).then(function(data) {
      TOKEN = data.token;
      sessionStorage.setItem('pa_token', TOKEN);
      return data;
    });
  }

  function logout() {
    TOKEN = null;
    sessionStorage.removeItem('pa_token');
  }

  function changePwd(oldPwd, newPwd) {
    return request('/api/auth/change-pwd', {
      method: 'POST',
      body: { old_password: oldPwd, new_password: newPwd }
    });
  }

  // 恢复 token
  function restoreToken() {
    var saved = sessionStorage.getItem('pa_token');
    if (saved) TOKEN = saved;
    return !!saved;
  }

  // ── 总览 ──
  function getOverview() {
    return request('/api/dashboard/overview');
  }

  function getDeptRanking() {
    return request('/api/potential/dept-ranking');
  }

  // ── 产品宽度 ──
  function getWidthSummary() {
    return request('/api/width/summary');
  }

  function getWidthHeatmap() {
    return request('/api/width/heatmap');
  }

  function getWidthCustomers(limit) {
    return request('/api/width/customers?limit=' + (limit || 20));
  }

  // ── 潜力产品 ──
  function getPotentialSummary() {
    return request('/api/potential/summary');
  }

  function getPotentialDeptRanking() {
    return request('/api/potential/dept-ranking');
  }

  function getTeamMatrix() {
    return request('/api/potential/team-matrix');
  }

  // ── 管理 ──
  function getUsers() {
    return request('/api/admin/users');
  }

  function createUser(userData) {
    return request('/api/admin/users', { method: 'POST', body: userData });
  }

  function updateUser(id, userData) {
    return request('/api/admin/users/' + id, { method: 'PUT', body: userData });
  }

  function deleteUser(id) {
    return request('/api/admin/users/' + id, { method: 'DELETE' });
  }

  function getDepartments() {
    return request('/api/admin/departments');
  }

  function getGroups(deptId) {
    var q = deptId ? '?dept_id=' + deptId : '';
    return request('/api/admin/groups' + q);
  }

  // ── 导出 ──
  function getExportUrl(type) {
    return BASE + '/api/export/' + type + '?token=' + encodeURIComponent(TOKEN || '');
  }

  function exportWidth() {
    return request('/api/export/width');
  }

  function exportPotential() {
    return request('/api/export/potential');
  }

  // ── 备份 ──
  function createBackup() {
    return request('/api/backup/create', { method: 'POST' });
  }

  function listBackups() {
    return request('/api/backup/list');
  }

  function restoreBackup(filename) {
    return request('/api/backup/restore/' + filename, { method: 'POST' });
  }

  function deleteBackup(filename) {
    return request('/api/backup/' + filename, { method: 'DELETE' });
  }

  // ── 公开 API ──
  return {
    BASE: BASE,
    request: request,
    checkAvailable: checkAvailable,
    isAvailable: function() { return _available; },
    restoreToken: restoreToken,

    // Auth
    login: login,
    logout: logout,
    changePwd: changePwd,

    // Dashboard
    getOverview: getOverview,
    getDeptRanking: getDeptRanking,

    // Width
    getWidthSummary: getWidthSummary,
    getWidthHeatmap: getWidthHeatmap,
    getWidthCustomers: getWidthCustomers,

    // Potential
    getPotentialSummary: getPotentialSummary,
    getPotentialDeptRanking: getPotentialDeptRanking,
    getTeamMatrix: getTeamMatrix,

    // Admin
    getUsers: getUsers,
    createUser: createUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    getDepartments: getDepartments,
    getGroups: getGroups,

    // Export
    getExportUrl: getExportUrl,
    exportWidth: exportWidth,
    exportPotential: exportPotential,

    // Backup
    createBackup: createBackup,
    listBackups: listBackups,
    restoreBackup: restoreBackup,
    deleteBackup: deleteBackup,
  };
})();
