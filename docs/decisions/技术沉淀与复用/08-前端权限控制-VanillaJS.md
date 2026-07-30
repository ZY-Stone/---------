# 前端权限控制 — Vanilla JS

> `hasPerm` + `bootstrapPermissions` + 路由守卫 + 菜单/按钮显隐。
> 来源：`src/frontend/js/data/models.js`

---

## 🗣 大白话

### 这是什么？

一个"看门大爷"。你登录后，它自动去后端问：这个人能看哪些页面？能点哪些按钮？然后自动把没权限的菜单藏起来、没权限的按钮灰掉。

比如销售登录后看不到"账号管理"菜单，主管看得到"用户管理"但看不到"角色权限"。这些都由这个模块自动处理。

### 什么时候用？

- 不同角色登录后看到的菜单不一样
- 需要在前端就挡住没权限的人（不能等点了才弹403）
- 需要前端兜底：后端挂了也能用本地存着的权限矩阵

### 怎么用

```javascript
// 判断权限
if (App.hasPerm('user_manage')) {
    // 显示用户管理按钮
}

// 路由守卫（在 showPage 里调用）
App.showPage = function(p) {
    if (!App.guardRoute('page-' + p)) return;  // 无权限直接拦
    // ... 显示页面
};

// 登录后初始化
App.bootstrapPermissions();  // 异步拉取权限 → 自动隐藏菜单 → 锁定筛选下拉
```

---

## 代码

```javascript
// 前后端权限键名映射（前端用中文习惯，后端用英文字段名）
App.PERM_KEY_MAP = {
  'data_backup': 'backup', 'user_manage': 'users_mgmt', 'role_manage': 'roles_mgmt',
  'audit_log': 'audit_log', 'data_import': 'import_data', 'data_export': 'export_data',
  'overview': 'overview', 'product_width': 'width', 'potential_product': 'potential',
};

App.myPerms = null;         // 后端加载的权限数据 { overview: true, ... }
App.myDataScope = 'all';    // 数据范围 all/dept/group/self

// 前端兜底矩阵（后端不可用时用这个）
App.PERM_MATRIX = {
  admin:     ['user_manage','role_manage','audit_log','data_backup','data_export','data_import','overview','product_width','potential_product'],
  gm:        ['audit_log','data_export','data_import','overview','product_width','potential_product'],
  operation: ['audit_log','data_backup','data_export','data_import','overview','product_width','potential_product'],
  director:  ['data_export','overview','product_width','potential_product'],
  manager:   ['user_manage','data_export','overview','product_width','potential_product'],
  interface: ['overview','product_width','potential_product'],
  sales:     ['overview','product_width']
};

// 检查权限：优先后端数据，后端不可用时用本地矩阵
App.hasPerm = function(perm) {
  if (App.myPerms) {
    var bk = App.PERM_KEY_MAP[perm] || perm;
    return App.myPerms[bk] === true;
  }
  var role = (App.loggedInUser || {}).role || 'admin';
  return (App.PERM_MATRIX[role] || []).indexOf(perm) >= 0;
};

// 路由守卫
App.guardRoute = function(pageId) {
  var required = { 'a-users': 'user_manage', 'a-roles': 'role_manage', 'a-audit': 'audit_log', 'page-admin': 'user_manage' };
  var perm = required[pageId];
  if (perm && !App.hasPerm(perm)) return false;
  return true;
};

// 登录后调用：从后端异步拉取权限，然后自动隐藏无权限菜单
App.bootstrapPermissions = function() {
  var user = App.loggedInUser || {};
  App.API.getMyPerms().then(function(d) {
    App.myPerms = d.perms || {};
    App.myDataScope = d.data_scope || 'all';
    _applyPermissionUI(user);
  }).catch(function() {
    App.myPerms = null;       // 后端不可用，用本地矩阵兜底
    App.myDataScope = 'all';
    _applyPermissionUI(user);
  });
};

// 自动隐藏无权限的菜单和按钮
function _applyPermissionUI(user) {
  // 隐藏 Admin 子标签
  var tabs = {'a-users':'user_manage','a-roles':'role_manage','a-audit':'audit_log'};
  Object.keys(tabs).forEach(function(id) {
    if (!App.hasPerm(tabs[id])) {
      var el = document.querySelector('[data-tab="' + id + '"]');
      if (el) el.style.display = 'none';
    }
  });
  // 隐藏顶级 Admin 导航
  if (!App.hasPerm('user_manage') && !App.hasPerm('role_manage')) {
    var nav = document.querySelector('[data-page="admin"]');
    if (nav) nav.style.display = 'none';
  }
}
```

## 权限判断流程

```
hasPerm('user_manage')
  ├─ 后端权限已加载 → 查 App.myPerms['users_mgmt'] 是否为 true
  └─ 后端挂了      → 查 App.PERM_MATRIX[role] 里有没有 'user_manage'
```
