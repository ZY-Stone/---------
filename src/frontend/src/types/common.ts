// ===== 通用类型定义 =====

export interface User {
  id: number; username: string; name: string; role: string;
  dept: string; group: string; dept_id?: number; group_id?: number;
}

export interface FilterState {
  dateStart: string; dateEnd: string;
  dept: string; group: string; person: string;
  compareType: 'yoy' | 'mom';
}

export interface DeptItem { n: string; ld: string; cw: number; aw: number; mw: number; cov: number; yoy: string; }
export interface GroupItem { n: string; dept: string; ld: string; cw: number; aw: number; mw: number; cov: number; yoy: string; }
export interface PersonItem { n: string; dept: string; grp: string; cw: number; aw: number; mw: number; cov: number; yoy: string; }

export interface OptionItem { label: string; value: string; dept?: string; grp?: string; }

// 产品宽度
export interface WidthRecord {
  user?: string; name?: string; siebel: string; industry?: string;
  sales: string; dept: string; guishang: string;
  width: number; prods: Record<string, number>; contact: string; level: string;
}

export interface WidthKpi {
  avgWidth: string; scaleUsers: number; scaleCustomers: number;
  coverage: string; widthYoY: string; customersMoM: number; coverageYoY: string;
}

export interface ProductCoverage { product: string; covered: number; rate: string; yoy: string; }
export interface TeamRank { dept: string; avgWidth: string; count: number; }
export interface CustomerItem { name: string; avgW: number; soldCnt: number; sold: string; }
export interface CrossSellItem { prods: string[]; matrix: Array<Array<{ rate: number; count: number }>>; bundles: unknown[]; }
export interface HeatmapItem { total: number; products: Array<{ name: string; rate: string; count: number }>; }

// 潜力产品
export interface PotentialRecord {
  dept2: string; dept3: string; dept4: string; dept5: string;
  sales: string; product: string; custName: string; userName: string;
  amount: number; amountPrev: number; yoy: string | null;
  qty: number; qtyPrev: number; qtyYoy: string | null;
  opps: number; oppsPrev: number; oppsYoy: string | null;
  users: number; usersPrev: number; usersYoy: string | null;
  contact: string; level: string;
}

export interface PotentialOverview {
  sales: number; salesPrev: number; productCount: number;
  customerCount: number; customerPrev: number; avgPrice: number; deptCount: number;
}

export interface PotProductRank {
  product: string; sales: number; prev: number; qty: number;
  yoy: string; type: string;
}

export interface DeptRank { name: string; sales: number; prev: number; yoy: string; }
export interface CustSegment { name: string; sales: number; products: number; }
