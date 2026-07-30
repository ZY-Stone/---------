# UI 组件 — 图表 / 弹窗 / Toast / 顶栏 / KPI卡片

> 平台现有设计，从 `index.html` + `app.js` + `css/components.css` 提取。

---

## 1. 页面布局骨架

```html
<body>
  <!-- 登录遮罩（覆盖全屏） -->
  <div class="login-overlay" id="loginOverlay">...</div>

  <!-- 顶栏：Logo + 导航按钮 + 用户菜单 -->
  <div class="topbar">...</div>

  <div class="layout">
    <div class="main full">
      <!-- 4个页面，同时只有一个是 active -->
      <div class="page active" id="page-overview">...</div>
      <div class="page"        id="page-width">...</div>
      <div class="page"        id="page-potential">...</div>
      <div class="page"        id="page-admin">...</div>
    </div>
  </div>

  <!-- 通用模态框 -->
  <div class="modal-overlay" id="appModal">...</div>

  <!-- Toast 通知（动态创建） -->
  <div id="appToast"></div>
</body>
```

## 2. 顶栏 (Topbar)

```html
<div class="topbar">
  <div class="logo">产品分析一体化平台</div>

  <!-- 导航按钮 -->
  <div class="topbar-nav">
    <button class="topbar-nav-btn active" data-page="overview" onclick="App.showPage('overview')">
      📊 数据总览
    </button>
    <button class="topbar-nav-btn" data-page="width" onclick="App.showPage('width')">
      📐 产品宽度分析
    </button>
    <button class="topbar-nav-btn" data-page="potential" onclick="App.showPage('potential')">
      🚀 潜力产品分析
    </button>
    <button class="topbar-nav-btn" data-page="admin" onclick="App.showPage('admin')">
      ⚙ 账号管理
    </button>
  </div>

  <!-- 用户区域（右对齐） -->
  <div class="user-menu" onclick="App.toggleUserMenu()">
    <span class="name" id="topbar-name">用户名</span>
    <span class="role-badge" id="topbar-role">角色标签</span>
    <span>▼</span>
    <div class="user-menu-dropdown" id="userDropdown">
      <div class="um-item" onclick="App.showPwdModal()">🔑 修改密码</div>
      <div class="um-divider"></div>
      <div class="um-item" id="um-backup" onclick="App.showBackupModal()">💾 数据备份</div>
      <div class="um-item" onclick="App.doLogout()">⏻ 退出登录</div>
    </div>
  </div>
</div>
```

**导航高亮**: `showPage(p)` 切换时，按钮通过 `data-page` 属性匹配 → `classList.toggle('active')`

**用户菜单**: 点击整个 `user-menu` 区域打开下拉，点击外部自动关闭。备份项根据 `hasPerm('data_backup')` 显示/隐藏。

## 3. 登录页

```html
<div class="login-overlay" id="loginOverlay">
  <div class="login-box">
    <div class="login-logo"><span class="login-logo-dot"></span>产品分析一体化平台</div>
    <div class="login-sub">请输入账号密码登录</div>
    <div class="login-field"><label>账号</label><input id="loginUser" placeholder="请输入用户名"></div>
    <div class="login-field"><label>密码</label><input id="loginPwd" type="password" onkeydown="Enter→登录"></div>
    <div class="login-error" id="loginError" style="display:none"></div>
    <button class="login-btn" onclick="App.doLogin()">登 录</button>
    <div class="login-hint">初始密码 123456 · 首次登录需修改密码</div>
  </div>
</div>
```

**显示/隐藏**: `classList.add('hidden')` / `classList.remove('hidden')`

## 4. 模态框 (Modal)

```html
<div class="modal-overlay" id="appModal">
  <div class="modal-box" id="appModalBox">
    <div class="modal-header">
      <h3 id="appModalTitle">标题</h3>
      <button class="modal-close" onclick="App.closeModal()">×</button>
    </div>
    <div class="modal-body" id="appModalBody">内容（HTML字符串）</div>
  </div>
</div>
```

**调用方式**:
```javascript
// 打开
App.showModal('标题', 'HTML内容', '底部按钮HTML（可选）');
// 关闭
App.closeModal();
// 点击遮罩自动关闭
```

**使用场景**:
- 修改密码弹窗 (强制模式时不可关闭 → `App.showModal(title, html, '', true)`)
- 新增/编辑用户弹窗
- 数据备份弹窗
- 用户权限设置弹窗

## 5. Toast 通知

```javascript
// 动态创建（如果不存在）
App.showToast('✅ 权限已保存', 3000);  // 3秒后消失

// DOM 结构
<div id="appToast" style="
  position:fixed; top:16px; right:20px; z-index:10000;
  background:#1e293b; color:#fff; padding:12px 20px;
  border-radius:8px; font-size:14px; font-weight:600;
  box-shadow:0 4px 16px rgba(0,0,0,.25);
  opacity:0; transform:translateY(-10px);
  transition:opacity .3s,transform .3s;
">消息内容</div>
```

**动画**: 透明度 0→1 + 向上滑动，消失时反向。

**常见消息**:
```
✅ 权限已保存          → 绿色
⚠️ 后端不可用          → 警告
🚫 无权访问此页面       → 错误
```

## 6. KPI 卡片

```html
<div class="kpi-row" style="grid-template-columns:repeat(6,1fr)">
  <div class="kpi-card k-blue">
    <div class="kpi-label">📐 产品宽度</div>
    <div class="kpi-value">3.96</div>
    <div class="kpi-sub">平均宽度</div>
  </div>
  <!-- 6个并列卡片 -->
</div>
```

**颜色类**: `k-blue` (蓝) `k-green` (绿) `k-orange` (橙) `k-purple` (紫)

## 7. 子标签 (Sub-tab)

```html
<div class="subtabs-inline">
  <button class="subtab active" data-tab="a-users">👥 用户管理</button>
  <button class="subtab" data-tab="a-roles">🔐 角色权限</button>
  <button class="subtab" data-tab="a-audit">📋 审计日志</button>
</div>

<!-- 对应内容区，同时只有一个可见 -->
<div data-tab-content="a-users" style="display:block">...</div>
<div data-tab-content="a-roles" style="display:none">...</div>
<div data-tab-content="a-audit" style="display:none">...</div>
```

**切换逻辑** (全局事件委托):
```javascript
// 点击 .subtab 按钮 → 切换 active 样式 → 显示对应 data-tab-content 区块
```

## 8. 表格通用样式

```html
<div class="card">
  <div class="card-title">标题</div>
  <div class="table-wrap" style="max-height:520px">  ← 超出滚动
    <table class="table"> / <table class="cu-table">  ← 两种表格样式
      <thead><tr>...</tr></thead>
      <tbody id="xxxBody"></tbody>
    </table>
  </div>
</div>
```

## 9. 按钮样式

```html
<!-- 主按钮 -->
<button style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:500">
  💾 保存
</button>

<!-- 幽灵按钮 -->
<button class="btn-ghost" onclick="App.resetFilters()">🔄 重置</button>

<!-- 危险按钮 -->
<button style="padding:3px 7px;border:1px solid #fee2e2;color:#dc2626">✕ 删除</button>

<!-- 编辑按钮 -->
<button style="padding:3px 7px;border:1px solid #e2e8f0;color:#2563eb">✎ 编辑</button>
```

## 10. 颜色系统

| 用途 | 色值 |
|------|------|
| 主色（按钮/链接） | `#2563eb` |
| 成功/全部数据 | `#059669` |
| 本部门 | `#2563eb` |
| 本小组/警告 | `#ea580c` |
| 本人/次要 | `#64748b` |
| 文字主色 | `#1e293b` |
| 文字次要 | `#64748b` |
| 边框 | `#e2e8f0` |
| 背景灰 | `#f8fafc` |
