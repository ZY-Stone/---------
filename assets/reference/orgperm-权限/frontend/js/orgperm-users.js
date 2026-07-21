/**
 * OrgPerm Users — 用户管理 CRUD 弹窗
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  // ==================== 用户管理入口 ====================
  OP.showUserManagement = function () {
    OP.closeModal();
    if (OP.config.useApi) {
      OP.api.listUsers().then(function (res) {
        OP._renderUserTable(res.data);
      }).catch(function (err) {
        OP.toast(err.message, 'error');
      });
    } else {
      var users = OP.mockStore.getAll('users');
      // Mock 补充角色名
      var roles = OP.mockStore.getAll('roles');
      users = users.map(function (u) {
        var r = roles.find(function (rr) { return rr.code === u.role_code; }) || {};
        u.role_name = r.name || u.role_code;
        return u;
      });
      OP._renderUserTable(users);
    }
  };

  OP._renderUserTable = function (users) {
    var h = '<div class="orgperm-modal-header">';
    h += '<h3 class="orgperm-modal-title" style="margin:0">⚙️ 用户权限设置</h3>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.showUserForm()">＋ 新增用户</button>';
    h += '</div>';

    h += '<table class="orgperm-table"><thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>部门</th><th>所属组</th><th>操作</th></tr></thead><tbody>';

    if (users.length === 0) {
      h += '<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8">暂无用户</td></tr>';
    }

    users.forEach(function (u) {
      var roleInfo = OP.ROLES[u.role_code || u.role] || OP.ROLES.person || { badge: u.role_name || u.role_code, color: '#64748b' };
      var roleTag = '<span class="orgperm-badge" style="background:' + roleInfo.color + '18;color:' + roleInfo.color + '">' + OP.escapeHtml(roleInfo.badge) + '</span>';

      h += '<tr>';
      h += '<td><strong>' + OP.escapeHtml(u.username) + '</strong></td>';
      h += '<td>' + OP.escapeHtml(u.name) + '</td>';
      h += '<td>' + roleTag + '</td>';
      h += '<td class="orgperm-text-sm">' + OP.escapeHtml(u.dept || '-') + '</td>';
      h += '<td class="orgperm-text-sm">' + OP.escapeHtml((u.grp && u.grp !== '-') ? u.grp : '-') + '</td>';
      h += '<td style="white-space:nowrap">';
      // 角色下拉
      h += '<select onchange="OrgPerm.changeUserRole(' + u.id + ',this.value)" style="padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:11px;margin-right:4px" class="orgperm-select">';
      for (var rk in OP.ROLES) {
        h += '<option value="' + rk + '"' + ((u.role_code || u.role) === rk ? ' selected' : '') + '>' + OP.ROLES[rk].badge + '</option>';
      }
      h += '</select>';
      h += '<button class="orgperm-btn orgperm-btn-secondary orgperm-btn-sm" onclick="OrgPerm.showUserForm(' + u.id + ')" title="编辑" style="margin-right:2px">✎</button>';
      if (u.username !== 'admin') {
        h += '<button class="orgperm-btn orgperm-btn-danger orgperm-btn-sm" onclick="OrgPerm.deleteUser(' + u.id + ')" title="删除">✕</button>';
      } else {
        h += '<span style="font-size:10px;color:#94a3b8;margin-left:4px">内置</span>';
      }
      h += '</td></tr>';
    });

    h += '</tbody></table>';
    h += '<div class="orgperm-text-muted" style="margin-top:12px">共 ' + users.length + ' 个用户</div>';
    h += '<div class="orgperm-modal-footer"><button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.closeModal()">关闭</button></div>';

    OP.showModal(h);
  };

  // ==================== 新增/编辑用户表单 ====================
  OP.showUserForm = function (id) {
    var isEdit = (typeof id !== 'undefined');
    var u = null;
    if (isEdit) {
      if (OP.config.useApi) {
        // API 模式需先获取用户详情，这里简化使用缓存的列表数据
      } else {
        u = OP.mockStore.getById('users', id);
      }
    }

    var title = isEdit ? '✎ 编辑用户 — ' + (u ? u.name : '') : '＋ 新增用户';
    var h = '<h3 class="orgperm-modal-title">' + title + '</h3>';
    h += '<div class="orgperm-form-grid">';

    // 用户名
    h += '<div class="orgperm-form-group"><label>用户名 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opUfUsername" value="' + (isEdit ? OP.escapeHtml(u.username) : '') + '" placeholder="英文+数字"' + (isEdit ? ' disabled' : '') + '></div>';

    // 姓名
    h += '<div class="orgperm-form-group"><label>显示姓名 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opUfName" value="' + (isEdit ? OP.escapeHtml(u.name) : '') + '" placeholder="中文姓名"></div>';

    // 密码
    h += '<div class="orgperm-form-group"><label>' + (isEdit ? '新密码（留空不修改）' : '登录密码 <span class="orgperm-required">*</span>') + '</label>';
    h += '<input class="orgperm-input" type="password" id="opUfPwd" placeholder="' + (isEdit ? '留空则不修改' : '至少6位') + '"></div>';

    // 角色
    h += '<div class="orgperm-form-group"><label>角色 <span class="orgperm-required">*</span></label>';
    h += '<select class="orgperm-select" id="opUfRole" onchange="OrgPerm._toggleDeptGroup()">';
    for (var rk in OP.ROLES) {
      var r = OP.ROLES[rk];
      var sel = (isEdit && (u.role_code || u.role) === rk) ? ' selected' : '';
      h += '<option value="' + rk + '"' + sel + '>' + r.badge + ' · ' + r.perms + '</option>';
    }
    h += '</select></div>';

    // 部门 + 组（容器）
    h += '<div id="opUfDeptGroup">';
    h += '<div class="orgperm-form-group"><label id="opUfDeptLabel">所属部门</label>';
    h += '<select class="orgperm-select" id="opUfDept" onchange="OrgPerm._updateGroupOptions()">';
    var depts = OP.config.useApi ? [] : OP.mockStore.getAll('depts');
    depts.forEach(function (d) {
      h += '<option value="' + d.id + '"' + (isEdit && u && u.department_id === d.id ? ' selected' : '') + '>' + OP.escapeHtml(d.name) + '</option>';
    });
    h += '</select></div>';
    h += '<div class="orgperm-form-group" id="opUfGroupWrap"><label id="opUfGroupLabel">所属组</label>';
    h += '<select class="orgperm-select" id="opUfGroup"><option value="">— 请先选择部门 —</option></select></div>';
    h += '</div>'; // end opUfDeptGroup
    h += '</div>'; // end form-grid

    h += '<div class="orgperm-modal-footer">';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showUserManagement()">取消</button>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.saveUser(' + (isEdit ? id : 'null') + ')">' + (isEdit ? '保存修改' : '确认新增') + '</button>';
    h += '</div>';

    OP.showModal(h);

    // 延迟初始化联动
    setTimeout(function () {
      OP._toggleDeptGroup();
      OP._updateGroupOptions(isEdit && u ? u.group_id : null);
    }, 50);
  };

  // 角色联动：管理员/总经理/运营 不需要选部门组
  OP._toggleDeptGroup = function () {
    var roleEl = document.getElementById('opUfRole');
    var dgEl = document.getElementById('opUfDeptGroup');
    var gLabel = document.getElementById('opUfGroupLabel');
    if (!roleEl || !dgEl) return;
    var role = roleEl.value;
    if (role === 'admin' || role === 'gm' || role === 'operation') {
      dgEl.style.display = 'none';
    } else {
      dgEl.style.display = '';
      if (gLabel) {
        gLabel.innerHTML = (role === 'manager') ? '所属组 <span class="orgperm-required">*</span>' : '所属组';
      }
    }
    OP._updateGroupOptions();
  };

  // 部门联动：动态加载组列表
  OP._updateGroupOptions = function (preselectedId) {
    var deptEl = document.getElementById('opUfDept');
    var groupEl = document.getElementById('opUfGroup');
    var groupWrap = document.getElementById('opUfGroupWrap');
    if (!deptEl || !groupEl) return;

    var deptId = parseInt(deptEl.value);
    if (isNaN(deptId)) return;

    var groups = OP.config.useApi ? [] : OP.mockStore.getAll('groups').filter(function (g) { return g.department_id === deptId; });
    var selectedVal = preselectedId !== undefined ? preselectedId : (groupEl.value || '');
    var roleEl = document.getElementById('opUfRole');
    var isManager = roleEl && roleEl.value === 'manager';

    groupEl.innerHTML = '';
    if (groups.length === 0) {
      groupEl.innerHTML = '<option value="">— 该部门无下属组 —</option>';
      if (groupWrap) groupWrap.style.display = 'none';
    } else {
      groupEl.innerHTML = '<option value="">— 请选择组 —</option>';
      var found = false;
      groups.forEach(function (g) {
        var sel = (String(g.id) === String(selectedVal)) ? ' selected' : '';
        if (sel) found = true;
        groupEl.innerHTML += '<option value="' + g.id + '"' + sel + '>' + OP.escapeHtml(g.name) + '</option>';
      });
      if (isManager && !found) {
        groupEl.innerHTML = '<option value="">— 请选择组 —</option>';
        groups.forEach(function (g) {
          var sel = (g.id === groups[0].id) ? ' selected' : '';
          groupEl.innerHTML += '<option value="' + g.id + '"' + sel + '>' + OP.escapeHtml(g.name) + '</option>';
        });
      }
      if (groupWrap) groupWrap.style.display = '';
    }
  };

  // ==================== 保存用户 ====================
  OP.saveUser = function (id) {
    var isEdit = (id !== null);
    var username = document.getElementById('opUfUsername').value.trim();
    var name = document.getElementById('opUfName').value.trim();
    var pwd = document.getElementById('opUfPwd').value;
    var roleCode = document.getElementById('opUfRole').value;

    // 管理员/总经理/运营 不需要部门组
    var deptId = null, groupId = null, deptName = null, groupName = null;
    if (['admin', 'gm', 'operation'].indexOf(roleCode) >= 0) {
      deptName = null; groupName = null;
    } else {
      var deptEl = document.getElementById('opUfDept');
      var groupEl = document.getElementById('opUfGroup');
      deptId = deptEl ? parseInt(deptEl.value) : null;
      groupId = groupEl && groupEl.value ? parseInt(groupEl.value) : null;
      if (!deptId) { OP.toast('请选择所属部门', 'error'); return; }
      if (roleCode === 'manager' && !groupId) { OP.toast('主管必须选择所属组', 'error'); return; }

      // Mock 模式获取名称
      if (!OP.config.useApi) {
        var d = OP.mockStore.getById('depts', deptId);
        deptName = d ? d.name : null;
        if (groupId) {
          var g = OP.mockStore.getById('groups', groupId);
          groupName = g ? g.name : null;
        }
      }
    }

    // 验证
    if (!username) { OP.toast('请输入用户名', 'error'); return; }
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(username)) { OP.toast('用户名格式：字母开头，3-20位', 'error'); return; }
    if (!name) { OP.toast('请输入姓名', 'error'); return; }
    if (!isEdit && !pwd) { OP.toast('请输入密码', 'error'); return; }
    if (pwd && pwd.length < 6) { OP.toast('密码至少6位', 'error'); return; }

    var roleInfo = OP.ROLES[roleCode] || {};
    var userData = {
      username: username,
      name: name,
      role_code: roleCode,
      role_name: roleInfo.badge || '',
      department_id: deptId,
      group_id: groupId,
      dept: deptName,
      grp: groupName,
    };

    if (OP.config.useApi) {
      var promise = isEdit
        ? OP.api.updateUser(id, Object.assign(userData, pwd ? { password: pwd } : {}))
        : OP.api.createUser(Object.assign(userData, { password: pwd }));
      promise.then(function () {
        OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
        OP.showUserManagement();
      }).catch(function (err) {
        OP.toast(err.message, 'error');
      });
    } else {
      // Mock 模式
      if (!isEdit) {
        if (OP.mockStore.getAll('users').find(function (x) { return x.username === username; })) {
          OP.toast('用户名已存在', 'error'); return;
        }
        OP.mockStore.add('users', Object.assign(userData, { is_active: true }));
      } else {
        OP.mockStore.update('users', id, userData);
      }
      OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
      OP.showUserManagement();
    }
  };

  // ==================== 删除用户 ====================
  OP.deleteUser = function (id) {
    var user = OP.config.useApi ? { username: '' } : OP.mockStore.getById('users', id);
    if (user && user.username === 'admin') { OP.toast('内置管理员不可删除', 'error'); return; }

    OP.confirm('确定删除该用户吗？此操作不可恢复。', function () {
      if (OP.config.useApi) {
        OP.api.deleteUser(id).then(function () {
          OP.toast('删除成功', 'success');
          OP.showUserManagement();
        }).catch(function (err) {
          OP.toast(err.message, 'error');
        });
      } else {
        OP.mockStore.remove('users', id);
        OP.toast('删除成功', 'success');
        OP.showUserManagement();
      }
    });
  };

  // ==================== 快速变更角色 ====================
  OP.changeUserRole = function (id, newRole) {
    if (OP.config.useApi) {
      OP.api.updateUser(id, { role_code: newRole }).then(function () {
        OP.showUserManagement();
      }).catch(function (err) {
        OP.toast(err.message, 'error');
      });
    } else {
      OP.mockStore.update('users', id, { role_code: newRole });
      OP.showUserManagement();
    }
  };

})();
