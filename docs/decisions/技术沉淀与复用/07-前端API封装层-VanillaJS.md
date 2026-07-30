# 前端 API 封装层 — Vanilla JS

> IIFE 闭包模式的自包含 API 层，自动管理 token、统一错误处理、后端不可用时 fallback。
> 来源：`src/frontend/js/core/api.js`

---

## 🗣 大白话

### 这是什么？

一个"传话员"。你点页面上的按钮，背后要发网络请求到后端。这个模块把所有的请求方式（GET查数据、POST新建、PUT修改、DELETE删除）封装好，你只需要写 `App.API.getUsers()` 就能拿到用户列表。它还会自动带上登录 token、自动处理错误、自动识别后端在不在线。

### 什么时候用？

- 前端需要跟后端 API 通信
- 需要自动在请求头里带 token（不然每个请求都要手写 Authorization）
- 后端偶尔不可用时，前端需要能兜底继续工作

### 怎么用

```javascript
// 查数据 → 直接调用
App.API.getUsers().then(function(users) { console.log(users); });

// 新增 → 传一个对象
App.API.createUser({ username: 'test', password: '123', name: '小张' });

// 修改 → 传 id + 要改的字段
App.API.updateUser(101, { role: 'manager' });

// 删除 → 传 id
App.API.deleteUser(101);
```

---

## 代码

```javascript
window.App = window.App || {};

App.API = (function() {
  var BASE = (window.location.protocol === 'file:')
    ? 'http://localhost:8800'
    : window.location.origin;
  var TOKEN = null;

  // 发请求（所有接口共用）
  function request(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';

    // token 双重保障
    var authToken = TOKEN || sessionStorage.getItem('pa_token');
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

    return fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      if (!r.ok) {
        return r.text().then(function(text) {
          try { var err = JSON.parse(text); throw new Error(err.detail || '失败 ' + r.status); }
          catch(e) { throw new Error(text.slice(0, 200) || '失败 ' + r.status); }
        });
      }
      return r.headers.get('content-type').indexOf('application/json') !== -1 ? r.json() : r.blob();
    });
  }

  // 登录（成功后保存 token）
  function login(username, password) {
    return request('/api/auth/login', { method: 'POST', body: { username, password } })
      .then(function(data) { TOKEN = data.token; sessionStorage.setItem('pa_token', TOKEN); return data; });
  }

  function logout() { TOKEN = null; sessionStorage.removeItem('pa_token'); }
  function restoreToken() { var t = sessionStorage.getItem('pa_token'); if (t) TOKEN = t; return !!t; }

  // ── 按你的项目添加 CRUD 函数 ──
  function getUsers()    { return request('/api/admin/users'); }
  function createUser(d) { return request('/api/admin/users', { method: 'POST', body: d }); }
  function updateUser(id, d) { return request('/api/admin/users/' + id, { method: 'PUT', body: d }); }
  function deleteUser(id) { return request('/api/admin/users/' + id, { method: 'DELETE' }); }
  function getDepts()    { return request('/api/admin/departments'); }
  function getGroups(did){ return request('/api/admin/groups' + (did ? '?dept_id=' + did : '')); }

  return {
    request: request, login: login, logout: logout, restoreToken: restoreToken,
    getUsers: getUsers, createUser: createUser, updateUser: updateUser, deleteUser: deleteUser,
    getDepts: getDepts, getGroups: getGroups,
  };
})();
```

## 关键设计

| 点 | 为什么 |
|----|--------|
| IIFE 闭包 | `TOKEN` 变量藏在内部，外部改不了 |
| token 双保险 | 先读内存 `TOKEN`，没有就读 `sessionStorage`，防止刷新后 token 丢失 |
| BASE 自适应 | `file://` 协议走 localhost，`http://` 走同源 |
| 非 2xx 抛 Error | 调用方统一 `.catch()` 处理，不用每个地方判断返回码 |
