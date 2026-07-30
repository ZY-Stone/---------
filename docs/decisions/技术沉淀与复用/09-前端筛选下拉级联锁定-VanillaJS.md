# 前端筛选下拉级联 + 角色锁定 — Vanilla JS

> 部门→小组→人员 三级级联下拉，内置角色权限自动锁定。
> 来源：`src/frontend/js/app.js` `populateDeptDropdown` 等

---

## 🗣 大白话

### 这是什么？

数据看板顶部的筛选栏。有三个下拉框：部门、小组、人员。它们会联动：你选了"客户销售一部"，小组下拉就只显示这个部门下的小组；你选了某个小组，人员就只显示这个小组里的人。

更关键的是：不同角色登录后，下拉框会自动锁定。总监只能看自己部门（部门下拉锁死、不能选别的），销售只能看自己（三个下拉全锁死）。

### 什么时候用？

- 数据看板页面顶部需要筛选栏
- 筛选维度有层级关系（部门 → 小组 → 人员）
- 不同角色能看的范围不同，需要自动锁定

### 效果演示

| 角色 | 部门下拉 | 小组下拉 | 人员下拉 |
|------|---------|---------|---------|
| 管理员 | 全部可选 | 全部可选 | 全部可选 |
| 总监 | 🔒锁死自己部门 | 本部门内可选 | 可选 |
| 主管 | 🔒锁死自己部门 | 🔒锁死自己组 | 组内人员可选 |
| 销售 | 🔒锁死 | 🔒锁死 | 🔒锁死自己 |

---

## 代码

### 1. 数据源

```javascript
App.DEPTS  = [{ n: '客户销售一部', ld: '高巍' }, ...];
App.GROUPS = [{ n: '客户销售一组', dept: '客户销售一部', ld: '张栋柱' }, ...];
App.PERSONS = [{ n: '段金君', dept: '客户销售一部', grp: '客户销售一组' }, ...];
```

### 2. 角色过滤函数

```javascript
App.getFilteredDepts = function() {
  var u = App.loggedInUser, depts = App.DEPTS;
  if (!u || u.role === 'admin' || u.role === 'gm' || u.role === 'operation') return depts;
  return depts.filter(function(d) { return d.n === u.dept; });  // 只看自己的部门
};

App.getFilteredGroups = function(deptVal) {
  var u = App.loggedInUser, groups = App.GROUPS;
  if (u && u.role === 'manager') groups = groups.filter(function(g) { return g.dept === u.dept && g.n === u.group; });
  else if (u && (u.role === 'director' || u.role === 'interface')) groups = groups.filter(function(g) { return g.dept === u.dept; });
  else if (u && u.role === 'sales') groups = groups.filter(function(g) { return g.dept === u.dept && g.n === u.group; });
  if (deptVal) groups = groups.filter(function(g) { return g.dept === deptVal; });
  return groups;
};

App.getFilteredPersons = function(deptVal, grpVal) {
  var u = App.loggedInUser, persons = App.PERSONS;
  if (u && u.role === 'manager') persons = persons.filter(function(p) { return p.dept === u.dept && p.grp === u.group; });
  else if (u && u.role === 'director' || u.role === 'interface') persons = persons.filter(function(p) { return p.dept === u.dept; });
  else if (u && u.role === 'sales') persons = persons.filter(function(p) { return p.n === u.username; });
  if (deptVal) persons = persons.filter(function(p) { return p.dept === deptVal; });
  if (grpVal) persons = persons.filter(function(p) { return p.grp === grpVal; });
  return persons;
};
```

### 3. 下拉填充（内置锁定）

```javascript
App.populateDeptDropdown = function(pageId) {
  var sel = document.querySelector('#' + pageId + ' .filter-dept');
  if (!sel) return;
  var u = App.loggedInUser || {}, role = u.role || '';
  var depts = App.getFilteredDepts();

  if (role && role !== 'admin' && role !== 'gm' && role !== 'operation') {
    // 受限角色：不显示"全部"，自动选中并锁定
    sel.innerHTML = depts.map(function(d) { return '<option value="' + d.n + '">' + d.n + '</option>'; }).join('');
    if (depts.length === 1) { sel.value = depts[0].n; sel.disabled = true; }
    return;
  }
  // 全量角色：显示"全部部门"
  sel.innerHTML = '<option value="all">全部部门</option>' + depts.map(function(d) { return '<option value="' + d.n + '">' + d.n + '</option>'; }).join('');
};

App.populateGrpDropdown = function(pageId) {
  var sel = document.querySelector('#' + pageId + ' .filter-group-sel');
  if (!sel) return;
  var deptVal = (document.querySelector('#' + pageId + ' .filter-dept') || {}).value || 'all';
  var groups = App.getFilteredGroups(deptVal !== 'all' ? deptVal : null);
  var role = (App.loggedInUser || {}).role || '';

  if (role === 'manager') {
    sel.innerHTML = groups.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
    if (groups.length === 1) { sel.value = groups[0].n; sel.disabled = true; }
    return;
  }
  if (role === 'sales') {
    sel.innerHTML = groups.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
    sel.disabled = true; return;
  }
  sel.innerHTML = '<option value="all">全部小组</option>' + groups.map(function(g) { return '<option value="' + g.n + '">' + g.n + '</option>'; }).join('');
};
```

### 4. 级联回调（反向回填）

```javascript
App.onDeptChange = function(pageId) {
  // 换部门 → 重置小组和人员
  var grp = document.querySelector('#' + pageId + ' .filter-group-sel');
  var per = document.querySelector('#' + pageId + ' .filter-person');
  if (grp) grp.value = 'all';
  if (per) per.value = 'all';
  App.populateGrpDropdown(pageId);
  App.populatePersonDropdown(pageId);
  App.refreshPageData(pageId);
};

App.onGrpChange = function(pageId) {
  // 选小组 → 自动回填所属部门
  var grpSel = document.querySelector('#' + pageId + ' .filter-group-sel');
  var val = grpSel ? grpSel.value : 'all';
  if (val !== 'all') {
    var info = App.GROUPS.find(function(g) { return g.n === val; });
    if (info) { var dept = document.querySelector('#' + pageId + ' .filter-dept'); if (dept) dept.value = info.dept; }
  }
  App.populatePersonDropdown(pageId);
  App.refreshPageData(pageId);
};
```

### 5. HTML 模板

```html
<div class="filter-bar">
  <div class="filter-group"><label>部门</label>
    <select class="filter-dept" onchange="App.onDeptChange('page-overview')"></select></div>
  <div class="filter-group"><label>小组</label>
    <select class="filter-group-sel" onchange="App.onGrpChange('page-overview')"></select></div>
  <div class="filter-group"><label>个人</label>
    <select class="filter-person" onchange="App.onPersonChange('page-overview')"></select></div>
</div>
```
