/**
 * OrgPerm Orgs — 部门/组管理 UI
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  OP.showOrgManagement = function () {
    OP.closeModal();
    if (OP.config.useApi) {
      OP.api.listDepts().then(function (res) {
        OP._renderOrgPanel(res.data);
      }).catch(function (err) {
        OP.toast(err.message, 'error');
      });
    } else {
      OP._renderOrgPanel(OP.mockStore.getAll('depts'));
    }
  };

  OP._renderOrgPanel = function (depts) {
    var groups = OP.config.useApi ? [] : OP.mockStore.getAll('groups');

    var h = '<div class="orgperm-modal-header">';
    h += '<h3 class="orgperm-modal-title" style="margin:0">🏢 组织架构管理</h3>';
    h += '<div style="display:flex;gap:8px">';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.showDeptForm()">＋ 新增部门</button>';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showGroupForm()">＋ 新增组</button>';
    h += '</div></div>';

    // 部门列表
    if (depts.length === 0) {
      h += '<div class="orgperm-empty-state">暂无部门数据</div>';
    } else {
      depts.forEach(function (d) {
        var deptGroups = OP.config.useApi ? [] : groups.filter(function (g) { return g.department_id === d.id; });
        h += '<div class="orgperm-role-card">';
        h += '<div class="orgperm-role-color" style="background:#2563eb">' + (d.name || '?')[0] + '</div>';
        h += '<div class="orgperm-role-info">';
        h += '<div class="orgperm-role-name">' + OP.escapeHtml(d.name) + '</div>';
        h += '<div class="orgperm-role-meta">负责人：' + OP.escapeHtml(d.leader || '-') + ' · 下属组：' + deptGroups.length + ' 个</div>';
        h += '</div>';
        h += '<button class="orgperm-btn orgperm-btn-secondary orgperm-btn-sm" onclick="OrgPerm.showDeptForm(' + d.id + ')">✎</button>';
        h += '<button class="orgperm-btn orgperm-btn-danger orgperm-btn-sm" onclick="OrgPerm.deleteDept(' + d.id + ')" style="margin-left:4px">✕</button>';
        h += '</div>';

        // 组列表
        deptGroups.forEach(function (g) {
          h += '<div style="margin-left:36px;margin-bottom:6px;padding:8px 12px;background:#f8fafc;border-radius:6px;display:flex;align-items:center;gap:8px;font-size:13px">';
          h += '<span style="flex:1"><strong>' + OP.escapeHtml(g.name) + '</strong> <span class="orgperm-text-sm">组长：' + OP.escapeHtml(g.leader || '-') + '</span></span>';
          h += '<button class="orgperm-btn orgperm-btn-secondary orgperm-btn-sm" onclick="OrgPerm.showGroupForm(' + g.id + ')">✎</button>';
          h += '<button class="orgperm-btn orgperm-btn-danger orgperm-btn-sm" onclick="OrgPerm.deleteGroup(' + g.id + ')">✕</button>';
          h += '</div>';
        });
      });
    }

    h += '<div class="orgperm-modal-footer"><button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.closeModal()">关闭</button></div>';
    OP.showModal(h);
  };

  // ==================== 部门表单 ====================
  OP.showDeptForm = function (id) {
    var isEdit = (typeof id !== 'undefined');
    var d = !isEdit || OP.config.useApi ? null : OP.mockStore.getById('depts', id);

    var h = '<h3 class="orgperm-modal-title">' + (isEdit ? '✎ 编辑部门' : '＋ 新增部门') + '</h3>';
    h += '<div class="orgperm-form-group"><label>部门名称 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opDeptName" value="' + (d ? OP.escapeHtml(d.name) : '') + '" placeholder="例如：客户销售一部"></div>';
    h += '<div class="orgperm-form-group"><label>负责人</label>';
    h += '<input class="orgperm-input" id="opDeptLeader" value="' + (d ? OP.escapeHtml(d.leader || '') : '') + '" placeholder="部门负责人姓名"></div>';
    h += '<div class="orgperm-form-group"><label>排序</label>';
    h += '<input class="orgperm-input" type="number" id="opDeptSort" value="' + (d ? d.sort_order : '0') + '" style="width:100px"></div>';
    h += '<div class="orgperm-modal-footer">';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showOrgManagement()">取消</button>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.saveDept(' + (isEdit ? id : 'null') + ')">' + (isEdit ? '保存修改' : '确认新增') + '</button>';
    h += '</div>';
    OP.showModal(h);
  };

  OP.saveDept = function (id) {
    var isEdit = (id !== null);
    var name = document.getElementById('opDeptName').value.trim();
    var leader = document.getElementById('opDeptLeader').value.trim();
    var sortOrder = parseInt(document.getElementById('opDeptSort').value) || 0;

    if (!name) { OP.toast('请输入部门名称', 'error'); return; }

    var data = { name: name, leader: leader, sort_order: sortOrder };

    if (OP.config.useApi) {
      var promise = isEdit ? OP.api.updateDept(id, data) : OP.api.createDept(data);
      promise.then(function () {
        OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
        OP.showOrgManagement();
      }).catch(function (err) { OP.toast(err.message, 'error'); });
    } else {
      if (isEdit) {
        OP.mockStore.update('depts', id, data);
      } else {
        OP.mockStore.add('depts', data);
      }
      OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
      OP.showOrgManagement();
    }
  };

  OP.deleteDept = function (id) {
    OP.confirm('删除部门将同时删除下属组。确定继续吗？', function () {
      if (OP.config.useApi) {
        OP.api.deleteDept(id).then(function () {
          OP.toast('删除成功', 'success');
          OP.showOrgManagement();
        }).catch(function (err) { OP.toast(err.message, 'error'); });
      } else {
        // 同时删除下属组
        var groups = OP.mockStore.getAll('groups').filter(function (g) { return g.department_id === id; });
        groups.forEach(function (g) { OP.mockStore.remove('groups', g.id); });
        OP.mockStore.remove('depts', id);
        OP.toast('删除成功', 'success');
        OP.showOrgManagement();
      }
    });
  };

  // ==================== 组表单 ====================
  OP.showGroupForm = function (id) {
    var isEdit = (typeof id !== 'undefined');
    var g = !isEdit || OP.config.useApi ? null : OP.mockStore.getById('groups', id);
    var depts = OP.config.useApi ? [] : OP.mockStore.getAll('depts');

    var h = '<h3 class="orgperm-modal-title">' + (isEdit ? '✎ 编辑组' : '＋ 新增组') + '</h3>';
    h += '<div class="orgperm-form-group"><label>组名称 <span class="orgperm-required">*</span></label>';
    h += '<input class="orgperm-input" id="opGroupName" value="' + (g ? OP.escapeHtml(g.name) : '') + '" placeholder="例如：客户销售一组"></div>';
    h += '<div class="orgperm-form-group"><label>所属部门 <span class="orgperm-required">*</span></label>';
    h += '<select class="orgperm-select" id="opGroupDept">';
    depts.forEach(function (d) {
      h += '<option value="' + d.id + '"' + (g && g.department_id === d.id ? ' selected' : '') + '>' + OP.escapeHtml(d.name) + '</option>';
    });
    h += '</select></div>';
    h += '<div class="orgperm-form-group"><label>组长</label>';
    h += '<input class="orgperm-input" id="opGroupLeader" value="' + (g ? OP.escapeHtml(g.leader || '') : '') + '" placeholder="组长姓名"></div>';
    h += '<div class="orgperm-form-group"><label>排序</label>';
    h += '<input class="orgperm-input" type="number" id="opGroupSort" value="' + (g ? g.sort_order : '0') + '" style="width:100px"></div>';
    h += '<div class="orgperm-modal-footer">';
    h += '<button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.showOrgManagement()">取消</button>';
    h += '<button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.saveGroup(' + (isEdit ? id : 'null') + ')">' + (isEdit ? '保存修改' : '确认新增') + '</button>';
    h += '</div>';
    OP.showModal(h);
  };

  OP.saveGroup = function (id) {
    var isEdit = (id !== null);
    var name = document.getElementById('opGroupName').value.trim();
    var deptId = parseInt(document.getElementById('opGroupDept').value);
    var leader = document.getElementById('opGroupLeader').value.trim();
    var sortOrder = parseInt(document.getElementById('opGroupSort').value) || 0;

    if (!name) { OP.toast('请输入组名称', 'error'); return; }
    if (!deptId) { OP.toast('请选择所属部门', 'error'); return; }

    var data = { name: name, department_id: deptId, leader: leader, sort_order: sortOrder };

    if (OP.config.useApi) {
      var promise = isEdit ? OP.api.updateGroup(id, data) : OP.api.createGroup(data);
      promise.then(function () {
        OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
        OP.showOrgManagement();
      }).catch(function (err) { OP.toast(err.message, 'error'); });
    } else {
      if (isEdit) {
        OP.mockStore.update('groups', id, data);
      } else {
        OP.mockStore.add('groups', data);
      }
      OP.toast(isEdit ? '更新成功' : '创建成功', 'success');
      OP.showOrgManagement();
    }
  };

  OP.deleteGroup = function (id) {
    OP.confirm('确定删除该组吗？', function () {
      if (OP.config.useApi) {
        OP.api.deleteGroup(id).then(function () {
          OP.toast('删除成功', 'success');
          OP.showOrgManagement();
        }).catch(function (err) { OP.toast(err.message, 'error'); });
      } else {
        OP.mockStore.remove('groups', id);
        OP.toast('删除成功', 'success');
        OP.showOrgManagement();
      }
    });
  };

})();
