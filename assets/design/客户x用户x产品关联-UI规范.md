# 客户 × 用户 × 产品关联 — UI 与表格样式规范

## 一、配色

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#2563EB` | 金额、链接、激活页码 |
| 排名金牌 | `#F59E0B` | 渐变 `#FBBF24 → #F59E0B` |
| 排名银牌 | `#94A3B8` | 渐变 `#CBD5E1 → #94A3B8` |
| 排名铜牌 | `#C2410C` | 渐变 `#FB923C → #C2410C` |
| 关联用户 chip | `#EFF6FF` 底 + `#2563EB` 字 + `1px #DBEAFE` 边框 | 蓝色 chip |
| 覆盖产品 chip | `#F0FDF4` 底 + `#16A34A` 字 + `1px #BBF7D0` 边框 | 绿色 chip |

| 卡片/表格背景 | `#FFFFFF` | 白底 |
| 表格外框 | `#E2E8F0` | 圆角 8px |
| 副文字 | `#64748B` | 表头、进度条数字 |
| 提示/占位 | `#94A3B8` | 无数据 dash |
| hover 背景 | `#F0F4FF` | 浅蓝高亮 |
| 分隔线 | `#F1F5F9` / `#E5E7EB` | 行间竖线、横线 |
| 分页条背景 | `#FAFBFC` | — |

---

## 二、表格结构（8 列）

| 列 | 表头 | 对齐 | 内容 |
|----|------|------|------|
| ① | `#` | 居中 | 24×24 圆形排名徽章 |
| ② | 客户名称 | 左对齐 | 主行：13px 加粗 · 副行：11px 灰色 |
| ③ | 关联用户 | 居中 | "X 人" 蓝色 chip，可点击下钻 |
| ④ | 覆盖产品 | 居中 | "X / 27" 绿色 chip，可点击下钻 |
| ⑤ | 销售额(万) | 居中 | `¥X.XX万` #2563EB 加粗 |
| ⑥ | 用户 | 左对齐 | 12px 加粗，无数据 "-" 斜体 |
| ⑦ | 用户贡献 | 居中 | `¥X.XX万` / "-" 斜体 |
| ⑧ | 产品数 | 居中 | 粗体数字 / "-" 斜体 |

---

## 三、CSS 类名速查

```css
/* 表格 */
.cu-table        -- width:100%; table-layout:auto; border:1px #e2e8f0; border-radius:8px
.cu-table thead th -- sticky top-0; bg #f8fafc; 11px; border-right #e5e7eb; border-bottom 2px #d1d5db
.cu-table td      -- padding 8px; border-right #f1f5f9; border-bottom #e5e7eb
.cu-table tr:hover td -- bg #f0f4ff
.left-dim         -- 子行灰底（bg #f8fafc）

/* 排名 */
.rn               -- 24px 圆形，bg #f1f5f9，默认
.rn.gold          -- 渐变金
.rn.silver        -- 渐变银
.rn.bronze        -- 渐变铜

/* 客户 */
.cust-name        -- 13px 加粗 #0f172a
.cust-sub         -- 11px #94a3b8
.tag              -- 类型标签：padding 1px 7px; border-radius 10px; font-size 10px
.tag-vip          -- #eff6ff / #2563eb
.tag-old          -- #fffbeb / #d97706
.tag-gov          -- #f5f3ff / #7c3aed
.tag-central      -- #ecfeff / #0e7490

/* Chip */
.chip             -- inline-flex; padding 3px 10px; border-radius 12px; 11px
.chip-blue        -- #eff6ff / #2563eb / border #dbeafe
.chip-green       -- #f0fdf4 / #16a34a / border #bbf7d0

/* 金额 / 占位 */
.amt              -- 13px 加粗 #2563eb
.dash             -- #94a3b8 斜体

/* 分页 */
.cu-bottom        -- flex; padding 10px 22px; border-top #e2e8f0; bg #fafbfc
.cu-pager         -- flex gap 6px
.cu-pgbtn         -- 28×28; border #e2e8f0; bg #fff; border-radius 4px
.cu-pgbtn:hover   -- border #cbd5e1
.cu-pgbtn.active  -- bg #2563eb; color #fff
.cu-pgbtn.nav     -- 14px (‹ › 箭头)
.cu-pgdot         -- "…" #94a3b8
```

---

## 四、完整 CSS

```css
/* ===== 客户×用户×产品关联表格 (cu-table) ===== */
.cu-table { width:100%; table-layout:auto; border-collapse:collapse; font-size:13px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.cu-table thead th { background:#f8fafc; text-align:left; padding:8px 8px; font-weight:600; color:#475569; border-bottom:2px solid #d1d5db; border-right:1px solid #e5e7eb; position:sticky; top:0; z-index:2; font-size:11px; }
.cu-table thead th:last-child { border-right:none; }
.cu-table thead th.cu-c { text-align:center; }
.cu-table td { padding:8px 8px; border-bottom:1px solid #e5e7eb; border-right:1px solid #f1f5f9; vertical-align:middle; }
.cu-table td:last-child { border-right:none; }
.cu-table tbody tr:last-child td { border-bottom:1px solid #e2e8f0; }
.cu-table tbody tr:hover td { background:#f0f4ff; }
.cu-table .sub-row td.left-dim { background:#f8fafc; }

.rn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; font-size:11px; font-weight:600; background:#f1f5f9; color:#64748b; }
.rn.gold { background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#fff; }
.rn.silver { background:linear-gradient(135deg,#cbd5e1,#94a3b8); color:#fff; }
.rn.bronze { background:linear-gradient(135deg,#fb923c,#c2410c); color:#fff; }

.cust-name { font-weight:600; font-size:13px; color:#0f172a; }
.cust-sub { font-size:11px; color:#94a3b8; margin-top:2px; }

.tag { display:inline-block; margin-left:6px; padding:1px 7px; border-radius:10px; font-size:10px; font-weight:500; vertical-align:middle; }
.tag-vip { background:#eff6ff; color:#2563eb; }
.tag-old { background:#fffbeb; color:#d97706; }
.tag-gov { background:#f5f3ff; color:#7c3aed; }
.tag-central { background:#ecfeff; color:#0e7490; }

.chip { display:inline-flex; align-items:center; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:500; }
.chip-blue { background:#eff6ff; color:#2563eb; border:1px solid #dbeafe; }
.chip-green { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }

.amt { font-weight:600; font-size:13px; color:#2563eb; }
.dash { color:#94a3b8; font-style:italic; }

.cu-bottom { display:flex; justify-content:space-between; align-items:center; padding:10px 22px; border-top:1px solid #e2e8f0; background:#fafbfc; font-size:11px; color:#94a3b8; }
.cu-bottom select { border:1px solid #e2e8f0; border-radius:4px; padding:2px 6px; font-size:11px; margin:0 4px; }
.cu-pager { display:flex; gap:6px; align-items:center; }
.cu-pgbtn { min-width:28px; height:28px; border:1px solid #e2e8f0; background:#fff; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:12px; color:#374151; }
.cu-pgbtn:hover { border-color:#cbd5e1; }
.cu-pgbtn.active { background:#2563eb; color:#fff; border-color:#2563eb; font-weight:600; }
.cu-pgbtn.nav { font-size:14px; font-weight:500; }
.cu-pgdot { padding:0 6px; color:#94a3b8; }
```

---

## 五、HTML 结构

```html
<table class="cu-table">
  <thead id="pCustUserHead">
    <tr>
      <th class="cu-c">#</th>
      <th>客户名称</th>
      <th class="cu-c">关联用户</th>
      <th class="cu-c">覆盖产品</th>
      <th class="cu-c">销售额(万)</th>
      <th>用户</th>
      <th class="cu-c">用户贡献</th>
      <th class="cu-c">产品数</th>
    </tr>
  </thead>
  <tbody id="pCustUserBody">
    <!-- 主行 -->
    <tr>
      <td rowspan="N"><span class="rn gold">1</span></td>
      <td rowspan="N">
        <div class="cust-name">客户名称</div>
        <div class="cust-sub">深圳 · 央国企</div>
      </td>
      <td rowspan="N" class="cu-c"><span class="chip chip-blue">2 人</span></td>
      <td rowspan="N" class="cu-c"><span class="chip chip-green">5 / 27</span></td>
      <td rowspan="N" class="cu-c"><span class="amt">¥12.50万</span></td>
      <td><span style="font-size:12px;font-weight:600">用户名</span></td>
      <td class="cu-c"><span class="amt">¥8.20万</span></td>
      <td class="cu-c"><span style="font-weight:600;color:#2563eb">3</span></td>
    </tr>
    <!-- 子行（同客户其他用户） -->
    <tr>
      <td class="left-dim"></td><td class="left-dim"></td>
      <td class="left-dim cu-c"></td><td class="left-dim cu-c"></td>
      <td class="left-dim cu-c"></td>
      <td>用户2</td>
      <td class="cu-c"><span class="dash">-</span></td>
      <td class="cu-c"><span class="dash">-</span></td>
    </tr>
  </tbody>
</table>

<!-- 分页 -->
<div class="cu-bottom">
  <span>每页 10▼ 条 · 显示 1-10 / 1396</span>
  <div class="cu-pager">
    <button class="cu-pgbtn nav">‹</button>
    <button class="cu-pgbtn active">1</button>
    <button class="cu-pgbtn">2</button>
    <button class="cu-pgbtn">3</button>
    <span class="cu-pgdot">…</span>
    <button class="cu-pgbtn">140</button>
    <button class="cu-pgbtn nav">›</button>
  </div>
</div>
```

---

## 六、行格式规则

| 行类型 | 列①②③④⑤ | 列⑥⑦⑧ |
|--------|----------|--------|
| 主行（每客户第1行） | rowspan 跨行，实际数据 | 第1个用户数据 |
| 子行（同客户第2+行） | `left-dim` 灰底空单元格 | 第N个用户数据 |

- 无匹配数据：单行 `colspan="8"` 居中显示 "无匹配数据"
- hover 整行 td 背景 `#F0F4FF`

---

## 七、数据源

- 仅使用客户 sheet：`App.getFilteredPotData('cust')`
- 按 `custName` 聚合 → 按 `userName` 分子行
- 排序：按客户总销售额降序
- 分页：每页 10/20/50 可选，最多显示 5 个页码按钮
- 筛选：跟随顶部筛选器（部门→小组→个人）级联过滤
