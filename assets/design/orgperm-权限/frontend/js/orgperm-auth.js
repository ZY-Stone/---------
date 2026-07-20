/**
 * OrgPerm Auth — 登录/登出、用户头像、认证流程
 */
(function () {
  'use strict';

  var OP = window.OrgPerm;

  // ==================== 角色定义 ====================
  OP.ROLES = {
    admin:     { name: '管理员', avatar: '管', badge: '管理员', color: '#2563eb', perms: '全部权限' },
    gm:        { name: '总经理', avatar: '总', badge: '总经理', color: '#1e40af', perms: '全局查看' },
    operation: { name: '运营',   avatar: '运', badge: '运营',   color: '#7c3aed', perms: '全局查看' },
    director:  { name: '总监',   avatar: '总', badge: '总监',   color: '#0891b2', perms: '部门管理' },
    manager:   { name: '主管',   avatar: '主', badge: '主管',   color: '#ea580c', perms: '组级管理' },
    person:    { name: '普通用户',avatar: '用', badge: '用户',   color: '#64748b', perms: '个人查看' },
  };

  // ==================== 登录 ====================
  OP.renderLoginOverlay = function (container) {
    container = container || document.body;
    var overlay = document.createElement('div');
    overlay.className = 'orgperm-login-overlay';
    overlay.id = 'orgpermLoginOverlay';
    overlay.innerHTML =
      '<div class="orgperm-login-box">' +
      '<div class="orgperm-login-logo"><span class="orgperm-login-logo-dot"></span>' + OP.escapeHtml(OP.config.appTitle) + '</div>' +
      '<div class="orgperm-login-sub">请输入账号密码登录</div>' +
      '<div class="orgperm-login-field"><label>账号</label><input type="text" id="opLoginUser" placeholder="请输入用户名" autocomplete="off"></div>' +
      '<div class="orgperm-login-field"><label>密码</label><input type="password" id="opLoginPwd" placeholder="请输入密码"></div>' +
      '<div class="orgperm-login-error" id="opLoginError" style="display:none"></div>' +
      '<button class="orgperm-login-btn" id="opLoginBtn">登 录</button>' +
      '<div class="orgperm-login-hint">Demo · 管理员初始账号 admin / admin123</div>' +
      '</div>';
    container.appendChild(overlay);

    // 事件绑定
    document.getElementById('opLoginBtn').addEventListener('click', OP.login);
    document.getElementById('opLoginPwd').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') OP.login();
    });
    document.getElementById('opLoginUser').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') OP.login();
    });

    return overlay;
  };

  OP.showLogin = function () {
    var overlay = document.getElementById('orgpermLoginOverlay');
    if (overlay) overlay.classList.remove('hidden');
  };

  OP.hideLogin = function () {
    var overlay = document.getElementById('orgpermLoginOverlay');
    if (overlay) overlay.classList.add('hidden');
  };

  OP.login = function () {
    var username = document.getElementById('opLoginUser').value.trim();
    var password = document.getElementById('opLoginPwd').value;
    var errEl = document.getElementById('opLoginError');

    if (!username) { OP._showLoginError('请输入用户名'); return; }
    if (!password) { OP._showLoginError('请输入密码'); return; }

    if (OP.config.useApi) {
      // 真实 API 登录
      OP.api.login(username, password).then(function (res) {
        OP._onLoginSuccess(res.data);
      }).catch(function (err) {
        OP._showLoginError(err.message || '登录失败');
      });
    } else {
      // Mock 登录
      var result = OP.mockLogin(username, password);
      if (!result) {
        OP._showLoginError('用户名或密码错误');
        return;
      }
      OP._onLoginSuccess(result);
    }
  };

  OP._onLoginSuccess = function (data) {
    OP.state.token = data.access_token;
    OP.state.currentUser = data.user;
    OP.state.isLoggedIn = true;

    // 持久化
    try { sessionStorage.setItem('orgperm_login', JSON.stringify({ token: data.access_token, user: data.user })); } catch (e) { }

    OP.hideLogin();
    OP._showLoginError('');  // 清除错误

    OP.emit('login', data.user);
    if (typeof OP.config.onLogin === 'function') {
      OP.config.onLogin(data.user);
    }
  };

  OP._showLoginError = function (msg) {
    var el = document.getElementById('opLoginError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  };

  // ==================== 登出 ====================
  OP.logout = function () {
    OP.state.token = null;
    OP.state.currentUser = null;
    OP.state.isLoggedIn = false;
    try { sessionStorage.removeItem('orgperm_login'); } catch (e) { }

    OP.showLogin();
    OP.emit('logout', {});
    if (typeof OP.config.onLogout === 'function') {
      OP.config.onLogout();
    }
  };

  // ==================== 用户头像 ====================
  OP.renderUserHeader = function (container) {
    container = container || document.body;

    var wrapper = document.createElement('div');
    wrapper.className = 'orgperm-user-header';
    wrapper.id = 'orgpermUserHeader';
    wrapper.innerHTML =
      '<div class="orgperm-hu-trigger" id="opHuTrigger">' +
      '<span class="orgperm-hu-avatar" id="opHuAvatar"></span>' +
      '<span class="orgperm-hu-name" id="opHuName"></span>' +
      '<span class="orgperm-hu-role" id="opHuRole"></span>' +
      '<span class="orgperm-hu-arrow">▾</span>' +
      '</div>' +
      '<div class="orgperm-hu-dropdown" id="opHuDropdown" style="display:none">' +
      '<div class="orgperm-hu-drop-item" id="opPermSetting" onclick="OrgPerm.showUserManagement()">权限设置</div>' +
      '<div class="orgperm-hu-drop-item" onclick="OrgPerm.showOrgManagement()">组织管理</div>' +
      '<div class="orgperm-hu-drop-item" onclick="OrgPerm.showRoleManagement()">角色管理</div>' +
      '<div class="orgperm-hu-drop-item" onclick="OrgPerm.showChangePwd()">修改密码</div>' +
      '<div class="orgperm-hu-drop-divider"></div>' +
      '<div class="orgperm-hu-drop-item" onclick="OrgPerm.logout()">退出登录</div>' +
      '</div>';
    container.appendChild(wrapper);

    // 事件
    document.getElementById('opHuTrigger').addEventListener('click', function () {
      var dd = document.getElementById('opHuDropdown');
      var isOpen = dd.style.display !== 'none';
      dd.style.display = isOpen ? 'none' : 'block';
      this.classList.toggle('open', !isOpen);

      // 权限设置仅管理员可见
      var permEl = document.getElementById('opPermSetting');
      if (permEl && OP.state.currentUser) {
        var role = OP.state.currentUser.role;
        permEl.style.display = (role === 'admin') ? '' : 'none';
      }
    });

    // 点击外部关闭
    document.addEventListener('click', function (e) {
      var hu = document.getElementById('orgpermUserHeader');
      if (hu && !hu.contains(e.target)) {
        var dd = document.getElementById('opHuDropdown');
        if (dd) dd.style.display = 'none';
        var tr = document.getElementById('opHuTrigger');
        if (tr) tr.classList.remove('open');
      }
    });

    // 更新 UI
    OP.updateUserHeader();

    return wrapper;
  };

  OP.updateUserHeader = function () {
    var user = OP.state.currentUser;
    if (!user) return;
    var roleInfo = OP.ROLES[user.role] || OP.ROLES.person;

    var avatar = document.getElementById('opHuAvatar');
    var name = document.getElementById('opHuName');
    var roleEl = document.getElementById('opHuRole');
    var permEl = document.getElementById('opPermSetting');

    if (avatar) {
      avatar.textContent = roleInfo.avatar;
      avatar.style.background = roleInfo.color;
    }
    if (name) name.textContent = user.name;
    if (roleEl) {
      roleEl.textContent = roleInfo.badge;
      roleEl.style.background = roleInfo.color + '18';
      roleEl.style.color = roleInfo.color;
    }
    if (permEl) {
      permEl.style.display = (user.role === 'admin') ? '' : 'none';
    }
  };

  // ==================== 修改密码 ====================
  OP.showChangePwd = function () {
    var h = '<h3 class="orgperm-modal-title">🔑 修改密码</h3>';
    if (OP.state.currentUser) {
      var role = OP.ROLES[OP.state.currentUser.role] || OP.ROLES.person;
      h += '<div class="orgperm-text-sm" style="margin-bottom:12px">当前用户：<strong>' + OP.escapeHtml(role.name) + '</strong></div>';
    }
    h += '<div class="orgperm-form-group"><label>当前密码</label><input class="orgperm-input" type="password" id="opPwdOld" placeholder="请输入当前密码"></div>';
    h += '<div class="orgperm-form-group"><label>新密码</label><input class="orgperm-input" type="password" id="opPwdNew" placeholder="至少6位"></div>';
    h += '<div class="orgperm-form-group"><label>确认新密码</label><input class="orgperm-input" type="password" id="opPwdConfirm" placeholder="请再次输入"></div>';
    h += '<div class="orgperm-modal-footer"><button class="orgperm-btn orgperm-btn-secondary" onclick="OrgPerm.closeModal()">取消</button><button class="orgperm-btn orgperm-btn-primary" onclick="OrgPerm.doChangePwd()">确认修改</button></div>';
    OP.showModal(h);
  };

  OP.doChangePwd = function () {
    var old = document.getElementById('opPwdOld').value;
    var nw = document.getElementById('opPwdNew').value;
    var cf = document.getElementById('opPwdConfirm').value;
    if (!old) { OP.toast('请输入当前密码', 'error'); return; }
    if (!nw || nw.length < 6) { OP.toast('新密码至少6位', 'error'); return; }
    if (nw !== cf) { OP.toast('两次密码不一致', 'error'); return; }

    if (OP.config.useApi) {
      OP.api.changePassword(old, nw).then(function () {
        OP.toast('密码修改成功', 'success');
        OP.closeModal();
      }).catch(function (err) {
        OP.toast(err.message || '修改失败', 'error');
      });
    } else {
      OP.toast('密码修改成功！（Demo）', 'success');
      OP.closeModal();
    }
  };

})();
