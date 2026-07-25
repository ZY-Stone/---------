/**
 * 潜力产品 — TypeScript 类型定义
 * 字段与 Excel 导入模板严格对齐
 */

// ===== 客户维度 (Sheet: 潜力产品-客户, 21 字段) =====
export interface PotCustRow {
  dept2: string;           // 二级部门 / 业务中心
  dept3: string;           // 三级部门 / 大部门 → 平台「部门」
  dept4: string;           // 四级部门 / 团队小组（备用组）
  groupRaw: string;        // 五级部门 → 平台「组」（优先）
  group: string;           // 解析后的组名
  dept: string;            // 解析后的部门名
  sales: string;           // 销售雇员
  contact: string;         // 对接人 → 平台「接口人」
  product: string;         // 潜力产品
  product_id: number | null; // FK → products.id（可选）
  custName: string;        // 售达方名称 → 平台「客户名称」
  userName: string;        // 最终用户 (可为空)
  amount: number;          // 销售额(万)
  amountPrev: number;      // 同期销售额(万)
  yoy: string | number;    // 同比
  qty: number;             // 销售数量
  qtyPrev: number;         // 同期销售数量
  qtyYoy: string | number; // 销售数量同比
  opps: number;            // 交易商机数
  oppsPrev: number;        // 交易商机数同期
  oppsYoy: string | number;// 交易商机数同比
  users: number;           // 交易用户数
  usersPrev: number;       // 交易用户数-同期
  usersYoy: string | number;// 用户数同比
}

// ===== 用户维度 (Sheet: 潜力产品用户, 23 字段) =====
export interface PotUserRow {
  center: string;          // 业务中心
  dept3: string;           // 部门 (三级)
  dept4: string;           // 团队小组 (四级部门)
  dept5: string;           // 四级部门 (五级等效)
  contact: string;         // 对接人
  userName: string;        // 最终用户名称
  industry: string;        // 行业
  product: string;         // 潜力产品
  product_id: number | null; // FK → products.id（可选）
  outAmt: number;          // 产品出库额(万)
  outAmtPrev: number;      // 产品出库额同期
  outYoy: number;          // 产品出库额同比
  outQty: number;          // 销售数量
  outQtyPrev: number;      // 销售数量同期
  outQtyYoy: number;       // 销售数量同比
  opps: number;            // 交易商机数
  oppsPrev: number;        // 交易商机数同期
  oppsYoy: number;         // 交易商机数同比
  users: number;           // 交易用户数
  usersPrev: number;       // 交易用户数同期
  usersYoy: number;        // 交易用户数同比
  custs: number;           // 交易客户数
  custsPrev: number;       // 交易客户数同期
  custsYoy: number;        // 交易客户数同比
}

// ===== 聚合计算结果 =====
export interface PotKpi {
  totalSales: number;       // 潜力产品总销售额(万)
  totalPrev: number;        // 同期总销售额
  yoyGrowth: number;        // 同比增长率%
  productCount: number;     // 潜力产品品类数
  customerCount: number;    // 覆盖客户数
  avgPrice: number;         // 客均单价
  upCount: number;          // 同比增长产品数
  downCount: number;        // 同比下降产品数
  newCount: number;         // 新增产品数
}

export interface PotProductRank {
  product: string;
  sales: number;            // 本期销售额
  prev: number;             // 同期销售额
  yoy: number;              // 同比%
  type: string;             // 量价齐升 / 量价齐跌 / 量跌价增 / 量增价跌 / 新增
}

export interface PotDeptRank {
  name: string;             // 部门名称
  sales: number;
  prev: number;
  yoy: number;
  productCount: number;     // 覆盖产品数
}

export interface PotCustSegment {
  name: string;             // 客户名称
  sales: number;            // 总销售额(万)
  productCount: number;     // 覆盖产品线数
  contact: string;          // 对接销售
}

export interface PotQuadrantPoint {
  product: string;
  x: number;                // 数量同比%
  y: number;                // 金额同比%
  amount: number;           // 销售额(万)
  quadrant: string;         // 量价齐升/量跌价增/量价齐跌/量增价跌
}
