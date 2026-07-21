/**
 * OrgPerm API Client — HTTP 请求层
 * 支持 JWT 认证 + Mock 模式自动切换
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  // ==================== API 客户端 ====================
  OP.api = {
    BASE: OP.config.apiBase,

    _request: function (method, path, data) {
      var url = OP.config.apiBase + path;
      var opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (OP.state.token) {
        opts.headers['Authorization'] = 'Bearer ' + OP.state.token;
      }
      if (data && method !== 'GET') {
        opts.body = JSON.stringify(data);
      }
      return fetch(url, opts).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.detail || 'Request failed');
          return body;
        });
      });
    },

    get: function (path) { return this._request('GET', path); },
    post: function (path, data) { return this._request('POST', path, data); },
    put: function (path, data) { return this._request('PUT', path, data); },
    del: function (path) { return this._request('DELETE', path); },

    // 登录
    login: function (username, password) {
      return this.post('/auth/login', { username: username, password: password });
    },
    // 获取当前用户
    me: function () { return this.get('/auth/me'); },
    // 修改密码
    changePassword: function (oldPwd, newPwd) {
      return this.post('/auth/change-password', { old_password: oldPwd, new_password: newPwd });
    },

    // 用户 CRUD
    listUsers: function (params) {
      var qs = params ? '?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') : '';
      return this.get('/users' + qs);
    },
    createUser: function (data) { return this.post('/users', data); },
    updateUser: function (id, data) { return this.put('/users/' + id, data); },
    deleteUser: function (id) { return this.del('/users/' + id); },

    // 部门 CRUD
    listDepts: function () { return this.get('/departments'); },
    getDept: function (id) { return this.get('/departments/' + id); },
    createDept: function (data) { return this.post('/departments', data); },
    updateDept: function (id, data) { return this.put('/departments/' + id, data); },
    deleteDept: function (id) { return this.del('/departments/' + id); },

    // 组 CRUD
    listGroups: function (deptId) {
      var qs = deptId ? '?department_id=' + deptId : '';
      return this.get('/groups' + qs);
    },
    createGroup: function (data) { return this.post('/groups', data); },
    updateGroup: function (id, data) { return this.put('/groups/' + id, data); },
    deleteGroup: function (id) { return this.del('/groups/' + id); },

    // 角色 CRUD
    listRoles: function () { return this.get('/roles'); },
    createRole: function (data) { return this.post('/roles', data); },
    updateRole: function (id, data) { return this.put('/roles/' + id, data); },
    deleteRole: function (id) { return this.del('/roles/' + id); },
    getRolePermissions: function (id) { return this.get('/roles/' + id + '/permissions'); },
    setRolePermissions: function (id, codes) { return this.put('/roles/' + id + '/permissions', { permission_codes: codes }); },
    listPermissions: function () { return this.get('/roles/permissions/list'); },
  };

  // ==================== Mock 数据存储 ====================
  OP.mockStore = {
    _key: 'orgperm_mock',
    _load: function () {
      try { return JSON.parse(localStorage.getItem(this._key)) || this._defaults(); } catch (e) { return this._defaults(); }
    },
    _save: function (data) {
      try { localStorage.setItem(this._key, JSON.stringify(data)); } catch (e) { }
    },
    _defaults: function () {
      return {
        nextId: 24,
        users: [
          { id: 1, username: 'admin', name: '系统管理员', role_code: 'admin', role_name: '管理员', department_id: null, group_id: null, dept: null, grp: null, is_active: true },
          { id: 22, username: 'jiangying', name: '江英', role_code: 'operation', role_name: '运营', department_id: null, group_id: null, dept: null, grp: null, is_active: true },
          { id: 23, username: 'guchengcheng', name: '顾城成', role_code: 'gm', role_name: '总经理', department_id: null, group_id: null, dept: null, grp: null, is_active: true },
        ],
        roles: [
          { id: 1, code: 'admin', name: '管理员', scope: 'all', color: '#2563eb', is_system: true, description: '', permissions: ['user.list', 'user.create', 'user.update', 'user.delete', 'role.manage', 'dept.manage', 'group.manage', 'org.view'] },
          { id: 2, code: 'gm', name: '总经理', scope: 'all', color: '#1e40af', is_system: true, description: '', permissions: ['user.list', 'org.view'] },
          { id: 3, code: 'operation', name: '运营', scope: 'all', color: '#7c3aed', is_system: true, description: '', permissions: ['user.list', 'org.view'] },
          { id: 4, code: 'director', name: '总监', scope: 'dept', color: '#0891b2', is_system: true, description: '', permissions: ['org.view'] },
          { id: 5, code: 'manager', name: '主管', scope: 'group', color: '#ea580c', is_system: true, description: '', permissions: ['org.view'] },
        ],
        depts: [
          { id: 1, name: '客户销售一部', leader: '高巍', sort_order: 0, is_active: true },
          { id: 2, name: '客户销售二部', leader: '吴正豪', sort_order: 1, is_active: true },
          { id: 3, name: '行业一部', leader: '卫玉昌', sort_order: 2, is_active: true },
          { id: 4, name: '行业二部', leader: '房伟建', sort_order: 3, is_active: true },
        ],
        groups: [
          { id: 1, name: '客户销售一组', department_id: 1, leader: '张栋柱', sort_order: 0, is_active: true },
          { id: 2, name: '客户销售二组', department_id: 1, leader: '陈刚sz', sort_order: 1, is_active: true },
          { id: 3, name: '智慧建筑组', department_id: 3, leader: '朱绪浩', sort_order: 2, is_active: true },
          { id: 4, name: '政府行业组', department_id: 4, leader: '廖贝贝', sort_order: 3, is_active: true },
        ],
      };
    },
    getAll: function (table) { var d = this._load(); return d[table] || []; },
    getById: function (table, id) { return this.getAll(table).find(function (x) { return x.id === id; }); },
    add: function (table, item) {
      var d = this._load();
      item.id = d.nextId++;
      item.is_active = item.is_active !== undefined ? item.is_active : true;
      d[table].push(item);
      this._save(d);
      return item;
    },
    update: function (table, id, updates) {
      var d = this._load();
      var item = d[table].find(function (x) { return x.id === id; });
      if (!item) return null;
      for (var k in updates) { if (updates.hasOwnProperty(k)) item[k] = updates[k]; }
      this._save(d);
      return item;
    },
    remove: function (table, id) {
      var d = this._load();
      var idx = d[table].findIndex(function (x) { return x.id === id; });
      if (idx < 0) return false;
      d[table].splice(idx, 1);
      this._save(d);
      return true;
    },
  };

  // Mock 用户认证
  OP.mockLogin = function (username, password) {
    var users = OP.mockStore.getAll('users');
    var user = users.find(function (u) { return u.username === username && u.is_active; });
    // Demo 模式：所有用户密码为 admin123
    if (!user || password !== 'admin123') return null;
    var roles = OP.mockStore.getAll('roles');
    var role = roles.find(function (r) { return r.code === user.role_code; }) || {};
    return {
      access_token: 'mock-token-' + user.id,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role_code,
        role_name: role.name || '',
        role_scope: role.scope || 'self',
        dept: user.dept,
        grp: user.grp,
        department_id: user.department_id,
        group_id: user.group_id,
        is_active: user.is_active,
        permissions: role.permissions || [],
      }
    };
  };

})();
