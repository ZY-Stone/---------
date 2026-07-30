# 数据导入与管理 — Excel 上传 + 本地持久化 + 后端同步

> 平台现有设计，从 `app.js` `ImportPotential` 模块 + `index.html` 导入 Tab 提取。

## 🗣 大白话

用户上传一个 Excel 文件（含客户 Sheet 和用户 Sheet），前端用 `xlsx.js` 解析 → 字段映射 → 合并去重 → 存 localStorage → 同步后端 → 刷新表格。导入后可在表格里筛选/搜索/批量删除。

---

## 导入流程

```
选择 Excel 文件
  → xlsx.js 解析 workbook
  → 识别客户Sheet + 用户Sheet
  → 字段映射（中文列名 → 英文字段名）
  → 按 key（客户: custName, 用户: userName）合并到已有数据
  → 更新 App.ImportPotential.CustRAW / UserRAW
  → persist() 写 localStorage
  → POST /api/import/potential-cust  同步后端
  → POST /api/import/potential-user  同步后端
  → render() 刷新表格
  → saveToHistory() 记录操作历史（支持回退）
```

## 字段映射配置

```javascript
// 客户维度映射（Excel列名 → 内部字段名）
App.ImportPotential.CUST_MAP = {
  '二级部门': 'dept2', '三级部门': 'dept3', '四级部门': 'dept4', '五级部门': 'dept5',
  '销售': 'sales', '对接人': 'contact', '产品': 'product',
  '售达方名称': 'custName', '最终用户': 'userName',
  '销售额(万)': 'amount', '同期销售额(万)': 'amountPrev', '同比': 'yoy',
  '数量': 'qty', '同期数量': 'qtyPrev', '数量同比': 'qtyYoy',
  '商机数': 'opps', '同期商机数': 'oppsPrev', '商机数同比': 'oppsYoy',
  '用户数': 'users', '同期用户数': 'usersPrev', '用户数同比': 'usersYoy',
};

// 用户维度映射
App.ImportPotential.USER_MAP = {
  '业务中心': 'center', '三级部门': 'dept3', '四级部门': 'dept4',
  '销售': 'sales', '对接人': 'contact', '最终用户名称': 'userName',
  '行业': 'industry', '产品': 'product',
  '产品出库额(万)': 'outAmt', '产品出库额同期': 'outAmtPrev', '产品出库额同比': 'outYoy',
  '销售数量': 'outQty', '销售数量同期': 'outQtyPrev', '销售数量同比': 'outQtyYoy',
  '商机数': 'opps', '商机数同期': 'oppsPrev', '商机数同比': 'oppsYoy',
  // ...
};
```

## 数据存储模式

```javascript
// 双写：localStorage 为主，后端为副本
App.ImportPotential.CustRAW = [];   // 客户维度数据数组
App.ImportPotential.UserRAW = [];   // 用户维度数据数组

// 持久化
App.ImportPotential.persist = function() {
  localStorage.setItem('pa_potential_cust', JSON.stringify(CustRAW));
  localStorage.setItem('pa_potential_user', JSON.stringify(UserRAW));
};

// 初始化：先读 localStorage，再拉后端
App.ImportPotential.init = function() {
  // 1. 读 localStorage
  CustRAW = JSON.parse(localStorage.getItem('pa_potential_cust')) || [];
  UserRAW = JSON.parse(localStorage.getItem('pa_potential_user')) || [];
  // 2. 后端覆盖（如果有新数据）
  fetch('/api/import/potential-cust').then(...)
  fetch('/api/import/potential-user').then(...)
  // 3. 渲染表格
  render();
};
```

## 导入历史与回退

```javascript
App.ImportPotential.history = [];
// 每次导入后保存快照
saveToHistory(fileName, custCount, userCount) → history.unshift({
  file, custCount, userCount, time,
  custSnap: JSON.parse(JSON.stringify(CustRAW)),   // 深拷贝当前数据
  userSnap: JSON.parse(JSON.stringify(UserRAW)),
});

// 回退：删除某个历史记录 → 恢复到上一个快照
deleteHistory(idx) → {
  history.splice(idx, 1);
  CustRAW = JSON.parse(history[0].custSnap);  // 恢复到最新的快照
  UserRAW = JSON.parse(history[0].userSnap);
  // 重新 POST 恢复后的数据到后端
}
```

## 表格渲染功能

- **Tab 切换**: 客户 / 用户两个视图
- **筛选**: 部门、小组、产品、月份下拉 + 搜索框
- **排序**: 点击表头排序
- **分页**: 每页 50 条
- **批量删除**: 勾选行 → 批量删除 → 同步后端 DELETE

## 后端去重逻辑

```python
# 按 售达方名称 + 产品 + 月份 去重
existing = db.query(PotentialCust).filter(
    PotentialCust.cust_name == cust_name,
    PotentialCust.product == product,
    PotentialCust.period == period_val,
).first()

if existing:
    # 更新已有记录
    existing.amount = new_amount
else:
    # 新增
    db.add(PotentialCust(...))
```
