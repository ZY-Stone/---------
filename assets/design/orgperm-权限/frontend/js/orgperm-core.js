/**
 * OrgPerm Core — 初始化、事件总线、Modal 辅助
 * 无依赖，纯原生 JS
 */
(function () {
  'use strict';

  var OP = window.OrgPerm = window.OrgPerm || {};

  // ==================== 配置 ====================
  OP.config = {
    apiBase: '/api',
    useApi: false,          // true = 真实 API，false = Mock 模式
    appTitle: '管理平台',
    onLogin: null,          // function(user)
    onLogout: null,         // function()
  };

  // ==================== 状态 ====================
  OP.state = {
    token: null,
    currentUser: null,
    isLoggedIn: false,
  };

  // ==================== 事件总线 ====================
  OP._events = {};
  OP.on = function (eventName, callback) {
    if (!OP._events[eventName]) OP._events[eventName] = [];
    OP._events[eventName].push(callback);
  };
  OP.emit = function (eventName, data) {
    var handlers = OP._events[eventName] || [];
    handlers.forEach(function (fn) { try { fn(data); } catch (e) { console.error('[OrgPerm] Event error:', e); } });
  };

  // ==================== 初始化 ====================
  OP.init = function (cfg) {
    if (cfg) {
      for (var k in cfg) { if (cfg.hasOwnProperty(k)) OP.config[k] = cfg[k]; }
    }

    // 恢复登录状态
    var saved = null;
    try { saved = sessionStorage.getItem('orgperm_login'); } catch (e) { }
    if (saved) {
      try {
        var data = JSON.parse(saved);
        OP.state.token = data.token;
        OP.state.currentUser = data.user;
        OP.state.isLoggedIn = true;
        OP.emit('login', data.user);
      } catch (e) { }
    }

    return OP;
  };

  // ==================== Modal ====================
  OP.showModal = function (html) {
    OP.closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'orgperm-modal-overlay';
    overlay.id = 'orgpermModal';
    overlay.innerHTML =
      '<div class="orgperm-modal-bg" onclick="OrgPerm.closeModal()"></div>' +
      '<div class="orgperm-modal-box">' + html + '</div>';
    document.body.appendChild(overlay);
  };

  OP.closeModal = function () {
    var el = document.getElementById('orgpermModal');
    if (el) el.remove();
  };

  // ==================== Toast ====================
  OP.toast = function (msg, type) {
    type = type || 'info';
    var t = document.createElement('div');
    t.className = 'orgperm-toast orgperm-toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  };

  // ==================== 工具函数 ====================
  OP.escapeHtml = function (str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // 显示确认对话框
  OP.confirm = function (msg, onOk) {
    if (confirm(msg)) onOk();
  };

})();
