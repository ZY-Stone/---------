/**
 * OrgPerm Roles — 角色/权限管理 UI
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  OP.showRoleManagement = function () {
    OP.closeModal();
    if (OP.config.useApi) {
      OP.api.listRoles().then(function (res) {
        OP._renderRolePanel(res.data);
      }).catch(function (err) { OP.toast(err.message, 'error'); });
    } else {
      OP._renderRolePanel(OP.mockStore.getAll('roles'));
    }
  };

  OP._renderRolePanel = function (roles) {
    var h = '<div class="orgperm-modal-header">';
    h += '<h3 class="orgperm-modal-title" style="margin:0">🔑 角色与权限管理</h3>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.showRoleForm()">＋ 新增角色</button>';
    h += '</div>';

    if (roles.length === 0) {
      h += '<div class="orgperm-empty-state">暂无角色</div>';
    }

    roles.forEach(function (r) {
      var scopeLabels = { all: '全部数据', dept: '部门数据', group: '组数据', self: '仅自己' };
      var scopeText = scopeLabels[r.scope] || r.scope;
      var permCount = (r.permissions && r.permissions.length) ? r.permissions.length : 0;

      h += '<div class="orgperm-role-card">';
      h += '<div class="orgperm-role-color" style="background:' + (r.color || '#64748b') + '">' + (r.name || '?')[0] + '</div>';
      h += '<div class="orgperm-role-info">';
      h += '<div class="orgperm-role-name">' + OP.escapeHtml(r.name) + ' <span style="font-size:11px;color:#94a3b8">(' + OP.escapeHtml(r.code) + ')</span>';
      if (r.is_system) h += ' <span class="orgperm-system-badge">内置</span>';
      h += '</div>';
      h += '<div class="orgperm-role-meta">数据范围：' + scopeText + ' · 权限数：' + permCount + '</div>';
      h += '</div>';
      h += '<button class="orgperm-btn orgperm-btn-secondary orgperm-btn-sm" onclick="OrgPerm.showRoleForm(' + r.id + ')">✎</button>';
      h += '<button class="orgperm-btn orgperm-btn-secondary orgperm-btn-sm" onclick="OrgPerm.showPermAssign(' + r.id + ')" style="margin-left:2px">🔐</button>';
      if (!r.is_system) {
        h += '<button class="orgperm-btn orgperm-btn-danger orgperm-btn-sm" onclick="OrgPerm.deleteRole(' + r.id + ')" style="margin-left:2px">✕</button>';
      }
      h += '</div>';
    });

    h += '<div class="orgperm-modal-footer"><button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.closeModal()">关闭</button></div>';
    OP.showModal(h);
  };

  // ==================== 角色表单 ====================
  OP.showRoleForm = function (id) {
    var isEdit = (typeof id !== 'undefined');
    var r = !isEdit || OP.config.useApi ? null : OP.mockStore.getById('roles', id);

    var h = '<h3 class="orgperm-modal-title">' + (isEdit ? '✎ 编辑角色' : '＋ 新增角色') + '</h3>';
    h += '<div class="orgperm-form-group"><label>角色代码 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opRoleCode" value="' + (r ? OP.escapeHtml(r.code) : '') + '" placeholder="英文标识，如：auditor"' + (isEdit ? ' disabled' : '') + '></div>';
    h += '<div class="orgperm-form-group"><label>角色名称 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opRoleName" value="' + (r ? OP.escapeHtml(r.name) : '') + '" placeholder="如：审计员"></div>';
    h += '<div class="orgperm-form-group"><label>数据范围</label>';
    h += '<select class="orgperm-select" id="opRoleScope">';
    ['all', 'dept', 'group', 'self'].forEach(function (s) {
      var labels = { all: '全部数据', dept: '部门数据', group: '组数据', self: '仅自己' };
      h += '<option value="' + s + '"' + (r && r.scope === s ? ' selected' : '') + '>' + labels[s] + ' (' + s + ')</option>';
    });
    h += '</select></div>';
    h += '<div class="orgperm-form-group"><label>颜色标识</label>';
    h += '<input class="orgperm-input" type="color" id="opRoleColor" value="' + (r ? r.color : '#64748b') + '" style="width:60px;height:40px;padding:2px"></div>';
    h += '<div class="orgperm-form-group"><label>描述</label>';
    h += '<input class="orgperm-input" id="opRoleDesc" value="' + (r ? OP.escapeHtml(r.description || '') : '') + '" placeholder="角色描述（可选）"></div>';
    h += '<div class="orgperm-modal-footer">';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showRoleManagement()">取消</button>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.saveRole(' + (isEdit ? id : 'null') + ')">' + (isEdit ? '保存修改' : '确认新增') + '</button>';
    h += '</div>';
    OP.showModal(h);
  };

  OP.saveRole = function (id) {
    var isEdit = (id !== null);
    var code = document.getElementById('opRoleCode').value.trim();
    var name = document.getElementById('opRoleName').value.trim();
    var scope = document.getElementById('opRoleScope').value;
    var color = document.getElementById('opRoleColor').value;
    var desc = document.getElementById('opRoleDesc').value.trim();

    if (!code) { OP.toast('请输入角色代码', 'error'); return; }
    if (!name) { OP.toast('请输入角色名称', 'error'); return; }

    var data = { code: code, name: name, scope: scope, color: color, description: desc };

    if (OP.config.useApi) {
      var promise = isEdit ? OP.api.updateRole(id, data) : OP.api.createRole(data);
      promise.then(function () {
        OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
        OP.showRoleManagement();
      }).catch(function (err) { OP.toast(err.message, 'error'); });
    } else {
      if (isEdit) {
        OP.mockStore.update('roles', id, data);
      } else {
        OP.mockStore.add('roles', Object.assign(data, { is_system: false, permissions: [] }));
      }
      OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
      OP.showRoleManagement();
    }
  };

  OP.deleteRole = function (id) {
    OP.confirm('确定删除该角色吗？', function () {
      if (OP.config.useApi) {
        OP.api.deleteRole(id).then(function () {
          OP.toast('删除成功', 'success');
          OP.showRoleManagement();
        }).catch(function (err) { OP.toast(err.message, 'error'); });
      } else {
        OP.mockStore.remove('roles', id);
        OP.toast('删除成功', 'success');
        OP.showRoleManagement();
      }
    });
  };

  // ==================== 权限分配 ====================
  var PERM_TABLE = {
    'user.list':   '查看用户列表',
    'user.create': '创建用户',
    'user.update': '编辑用户',
    'user.delete': '删除用户',
    'role.manage': '管理角色权限',
    'dept.manage': '管理部门',
    'group.manage':'管理组',
    'org.view':    '查看组织结构',
  };

  OP.showPermAssign = function (roleId) {
    var role = OP.config.useApi ? null : OP.mockStore.getById('roles', roleId);
    if (!role) { OP.toast('角色不存在', 'error'); return; }

    var currentPerms = role.permissions || [];

    var h = '<h3 class="orgperm-modal-title">🔐 为「' + OP.escapeHtml(role.name) + '」分配权限</h3>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
    for (var code in PERM_TABLE) {
      if (!PERM_TABLE.hasOwnProperty(code)) continue;
      var checked = currentPerms.indexOf(code) >= 0 ? ' checked' : '';
      h += '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:13px">';
      h += '<input type="checkbox" value="' + code + '"' + checked + ' class="opPermCheck">';
      h += '<strong>' + code + '</strong> <span class="orgperm-text-sm">' + PERM_TABLE[code] + '</span>';
      h += '</label>';
    }
    h += '</div>';
    h += '<div class="orgperm-modal-footer">';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showRoleManagement()">取消</button>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.savePermAssign(' + roleId + ')">保存权限</button>';
    h += '</div>';
    OP.showModal(h);
  };

  OP.savePermAssign = function (roleId) {
    var checks = document.querySelectorAll('.opPermCheck:checked');
    var codes = [];
    checks.forEach(function (cb) { codes.push(cb.value); });

    if (OP.config.useApi) {
      OP.api.setRolePermissions(roleId, codes).then(function () {
        OP.toast('权限已更新', 'success');
        OP.showRoleManagement();
      }).catch(function (err) { OP.toast(err.message, 'error'); });
    } else {
      OP.mockStore.update('roles', roleId, { permissions: codes });
      OP.toast('权限已更新', 'success');
      OP.showRoleManagement();
    }
  };

})();
