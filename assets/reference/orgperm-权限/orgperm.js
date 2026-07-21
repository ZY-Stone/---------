/**
 * OrgPerm 入口加载器
 *
 * 使用方法：
 *   <link rel="stylesheet" href="orgperm/frontend/css/orgperm.css">
 *   <script src="orgperm/orgperm.js"></script>
 *
 * 按顺序自动加载所有子模块。
 * 如需单文件打包，将所有 JS 文件内容合并到此文件即可。
 */
(function () {
  'use strict';

  // 脚本列表（按依赖顺序）
  var SCRIPTS = [
    'frontend/js/orgperm-core.js',
    'frontend/js/orgperm-api.js',
    'frontend/js/orgperm-auth.js',
    'frontend/js/orgperm-filter.js',
    'frontend/js/orgperm-users.js',
    'frontend/js/orgperm-orgs.js',
    'frontend/js/orgperm-roles.js',
  ];

  // 获取当前脚本所在目录
  function getBasePath() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('orgperm.js') >= 0) {
        return src.substring(0, src.lastIndexOf('/') + 1);
      }
    }
    return './';
  }

  var basePath = getBasePath();

  // 按顺序加载脚本
  function loadScripts(index) {
    if (index >= SCRIPTS.length) {
      // 全部加载完成
      if (typeof OrgPerm !== 'undefined') {
        OrgPerm.emit('loaded', {});
      }
      return;
    }
    var script = document.createElement('script');
    script.src = basePath + SCRIPTS[index];
    script.onload = function () { loadScripts(index + 1); };
    script.onerror = function () {
      console.warn('[OrgPerm] Failed to load: ' + SCRIPTS[index] + ', continuing...');
      loadScripts(index + 1);
    };
    document.head.appendChild(script);
  }

  loadScripts(0);

})();
