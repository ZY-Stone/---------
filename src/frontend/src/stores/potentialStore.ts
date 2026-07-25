import { create } from 'zustand';
import * as XLSX from 'xlsx';
import type { PotCustRow, PotUserRow, PotKpi, PotProductRank, PotDeptRank, PotCustSegment, PotQuadrantPoint } from '../types/potential';

// ===== 字段映射：Excel 表头 → 逻辑字段名 =====
const CUST_HEADERS: Record<string, string> = {
  '二级部门': 'dept2', '业务中心': 'dept2',
  '三级部门': 'dept3', '大部门': 'dept3',
  '四级部门': 'dept4', '团队小组': 'dept4',
  '五级部门': 'dept5',
  '销售雇员': 'sales', '负责销售': 'sales', '销售人员': 'sales',
  '对接人': 'contact',
  '潜力产品': 'product',
  '售达方名称': 'custName', '售达方': 'custName',
  '最终用户': 'userName', '最终用户名称': 'userName',
  '销售额(万)': 'amount',
  '同期销售额(万)': 'amountPrev',
  '同比': 'yoy',
  '销售数量': 'qty',
  '同期销售数量': 'qtyPrev',
  '销售数量同比': 'qtyYoy',
  '交易商机数': 'opps',
  '交易商机数同期': 'oppsPrev',
  '交易商机数同比': 'oppsYoy',
  '交易用户数': 'users',
  '交易用户数-同期': 'usersPrev',
  '用户数同比': 'usersYoy',
};

const USER_HEADERS: Record<string, string> = {
  '业务中心': 'center',
  '部门': 'dept3',
  '团队小组': 'dept4',
  '四级部门': 'dept5',
  '对接人': 'contact',
  '最终用户名称': 'userName',
  '行业': 'industry',
  '潜力产品': 'product',
  '产品出库额': 'outAmt',
  '产品出库额同期': 'outAmtPrev',
  '产品出库额同比': 'outYoy',
  '销售数量': 'outQty',
  '销售数量同期': 'outQtyPrev',
  '销售数量同比': 'outQtyYoy',
  '交易商机数': 'opps',
  '交易商机数同期': 'oppsPrev',
  '交易商机数同比': 'oppsYoy',
  '交易用户数': 'users',
  '交易用户数同期': 'usersPrev',
  '交易用户数同比': 'usersYoy',
  '交易客户数': 'custs',
  '交易客户数同期': 'custsPrev',
  '交易客户数同比': 'custsYoy',
};

// 按表头名称匹配列索引
function buildColMap(headers: string[], mapping: Record<string, string>): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = mapping[String(h || '').trim()];
    if (key) map[key] = i;
  });
  return map;
}

function parseNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// ===== 分类逻辑 =====
function classify(sales: number, prev: number): string {
  if (prev === 0 && sales > 0) return '新增';
  const a = prev > 0 ? ((sales - prev) / prev * 100) : 0;
  return a >= 0 ? '量价齐升' : '量价齐跌';
}

// ===== Store 类型 =====
interface PotentialState {
  custRAW: PotCustRow[];
  userRAW: PotUserRow[];
  history: Array<{ id: number; file: string; time: string; custCount: number; userCount: number; custSnap: PotCustRow[]; userSnap: PotUserRow[] }>;
  loading: boolean; currentView: 'cust' | 'user';
  // Computed
  kpi: PotKpi;
  productRanking: PotProductRank[];
  top10: PotProductRank[];
  deptRanking: PotDeptRank[];
  prodComposition: Array<{ name: string; amount: number }>;
  customerSegments: PotCustSegment[];
  quadrant: PotQuadrantPoint[];
  // Actions
  importExcel: (file: File) => Promise<{ custN: number; userN: number }>;
  resetAll: () => void;
  restoreLS: () => void;
  restoreHistory: (idx: number) => void;
  deleteHistory: (idx: number) => void;
}

function recompute(custRAW: PotCustRecord[], userRAW: PotUserRecord[]) {
  const sales = custRAW.reduce((s, r) => s + (r.amount || 0), 0);
  const prev = custRAW.reduce((s, r) => s + (r.amountPrev || 0), 0);
  const yoyGrowth = prev > 0 ? ((sales - prev) / prev * 100) : 0;

  // Product ranking
  const prodMap: Record<string, { sales: number; prev: number; qty: number }> = {};
  custRAW.forEach(r => {
    const p = r.product || '未知';
    if (!prodMap[p]) prodMap[p] = { sales: 0, prev: 0, qty: 0 };
    prodMap[p].sales += r.amount || 0;
    prodMap[p].prev += r.amountPrev || 0;
    prodMap[p].qty += r.qty || 0;
  });
  const productRanking: PotProductRank[] = Object.entries(prodMap).map(([product, v]) => ({
    product,
    sales: v.sales,
    prev: v.prev,
    yoy: v.prev > 0 ? ((v.sales - v.prev) / v.prev * 100) : (v.sales > 0 ? 999 : 0),
    type: classify(v.sales, v.prev),
  })).sort((a, b) => b.sales - a.sales);

  // Department ranking
  const deptMap: Record<string, { sales: number; prev: number; products: Set<string> }> = {};
  custRAW.forEach(r => {
    const d = r.dept3 || r.dept2 || '未知';
    if (!deptMap[d]) deptMap[d] = { sales: 0, prev: 0, products: new Set() };
    deptMap[d].sales += r.amount || 0;
    deptMap[d].prev += r.amountPrev || 0;
    if (r.product) deptMap[d].products.add(r.product);
  });
  const deptRanking: PotDeptRank[] = Object.entries(deptMap).map(([name, v]) => ({
    name,
    sales: v.sales,
    prev: v.prev,
    yoy: v.prev > 0 ? ((v.sales - v.prev) / v.prev * 100) : 0,
    productCount: v.products.size,
  })).sort((a, b) => b.sales - a.sales);

  // Product composition (pie chart)
  const compMap: Record<string, number> = {};
  custRAW.forEach(r => { compMap[r.product] = (compMap[r.product] || 0) + (r.amount || 0); });
  const prodComposition = Object.entries(compMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  // Customer segments
  const custMap: Record<string, { sales: number; products: Set<string>; contact: string }> = {};
  custRAW.forEach(r => {
    const cn = r.custName || r.userName || '未知';
    if (!custMap[cn]) custMap[cn] = { sales: 0, products: new Set(), contact: r.contact || '' };
    custMap[cn].sales += r.amount || 0;
    if (r.product) custMap[cn].products.add(r.product);
  });
  const customerSegments: PotCustSegment[] = Object.values(custMap).map(c => ({
    name: c.contact || '', sales: c.sales, productCount: c.products.size, contact: c.contact,
  })).sort((a, b) => b.sales - a.sales);

  // Quadrant
  const quadrant: PotQuadrantPoint[] = productRanking.slice(0, 11).map(p => ({
    product: p.product,
    x: p.prev > 0 ? ((p.qty || 100) / Math.max(1, p.prev) * 100) : 100,
    y: p.yoy,
    amount: p.sales,
    quadrant: p.type,
  }));

  const kpi: PotKpi = {
    totalSales: sales, totalPrev: prev, yoyGrowth,
    productCount: Object.keys(prodMap).length,
    customerCount: Object.keys(custMap).length,
    avgPrice: custRAW.length > 0 ? sales / Math.max(1, Object.keys(custMap).length) : 0,
    upCount: 0, downCount: 0, newCount: 0,
  };

  // Count up/down/new
  productRanking.forEach(p => {
    if (p.type === '新增') kpi.newCount++;
    else if (p.yoy >= 0) kpi.upCount++;
    else kpi.downCount++;
  });

  return { kpi, productRanking, top10: productRanking.slice(0, 10), deptRanking, prodComposition, customerSegments, quadrant };
}

export const usePotentialStore = create<PotentialState>((set, get) => ({
  custRAW: [], userRAW: [], history: [], loading: false, currentView: 'cust',
  kpi: { totalSales: 0, totalPrev: 0, yoyGrowth: 0, productCount: 0, customerCount: 0, avgPrice: 0, upCount: 0, downCount: 0, newCount: 0 },
  productRanking: [], top10: [], deptRanking: [], prodComposition: [], customerSegments: [], quadrant: [],

  importExcel: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        set({ loading: true });
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const custRows: PotCustRow[] = [];
        const userRows: PotUserRow[] = [];

        wb.SheetNames.forEach(sn => {
          if (!wb.Sheets[sn]) return;
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as unknown[][];
          if (!rows || rows.length < 2) return;
          const headers = rows[0].map(h => String(h || ''));

          // 检测 sheet 类型
          const isCust = headers.some(h => h.includes('售达方'));
          const isUser = headers.some(h => h.includes('产品出库额'));

          if (isCust) {
            const cm = buildColMap(headers, CUST_HEADERS);
            rows.slice(1).forEach(row => {
              const product = String(row[cm.product] || '').trim();
              if (!product) return;
              custRows.push({
                dept2: String(row[cm.dept2] || ''),
                dept3: String(row[cm.dept3] || ''),
                dept4: String(row[cm.dept4] || ''),
                dept5: String(row[cm.dept5] || ''),
                sales: String(row[cm.sales] || ''),
                contact: String(row[cm.contact] || ''),
                product,
                custName: String(row[cm.custName] || ''),
                userName: String(row[cm.userName] || ''),
                amount: parseNum(row[cm.amount]),
                amountPrev: parseNum(row[cm.amountPrev]),
                yoy: row[cm.yoy] ?? '',
                qty: parseNum(row[cm.qty]),
                qtyPrev: parseNum(row[cm.qtyPrev]),
                qtyYoy: row[cm.qtyYoy] ?? '',
                opps: parseNum(row[cm.opps]),
                oppsPrev: parseNum(row[cm.oppsPrev]),
                oppsYoy: row[cm.oppsYoy] ?? '',
                users: parseNum(row[cm.users]),
                usersPrev: parseNum(row[cm.usersPrev]),
                usersYoy: row[cm.usersYoy] ?? '',
              });
            });
          }

          if (isUser) {
            const cm = buildColMap(headers, USER_HEADERS);
            rows.slice(1).forEach(row => {
              const product = String(row[cm.product] || '').trim();
              if (!product) return;
              userRows.push({
                center: String(row[cm.center] || ''),
                dept3: String(row[cm.dept3] || ''),
                dept4: String(row[cm.dept4] || ''),
                dept5: String(row[cm.dept5] || ''),
                contact: String(row[cm.contact] || ''),
                userName: String(row[cm.userName] || ''),
                industry: String(row[cm.industry] || ''),
                product,
                outAmt: parseNum(row[cm.outAmt]),
                outAmtPrev: parseNum(row[cm.outAmtPrev]),
                outYoy: parseNum(row[cm.outYoy]),
                outQty: parseNum(row[cm.outQty]),
                outQtyPrev: parseNum(row[cm.outQtyPrev]),
                outQtyYoy: parseNum(row[cm.outQtyYoy]),
                opps: parseNum(row[cm.opps]),
                oppsPrev: parseNum(row[cm.oppsPrev]),
                oppsYoy: parseNum(row[cm.oppsYoy]),
                users: parseNum(row[cm.users]),
                usersPrev: parseNum(row[cm.usersPrev]),
                usersYoy: parseNum(row[cm.usersYoy]),
                custs: parseNum(row[cm.custs]),
                custsPrev: parseNum(row[cm.custsPrev]),
                custsYoy: parseNum(row[cm.custsYoy]),
              });
            });
          }
        });

        // Merge with existing data
        const { custRAW: prevC, userRAW: prevU, history: prevH } = get();
        const custIdx: Record<string, number> = {};
        prevC.forEach((r, i) => { custIdx[r.custName + '|' + r.product] = i; });
        let custN = 0, custU = 0;
        custRows.forEach(r => {
          const key = r.custName + '|' + r.product;
          if (custIdx[key] !== undefined) { Object.assign(prevC[custIdx[key]], r); custU++; }
          else { prevC.push(r); custN++; custIdx[key] = prevC.length - 1; }
        });
        userRows.forEach(r => { prevU.push(r); });

        const computed = recompute(prevC, prevU);
        const now = new Date();
        const h = { id: Date.now(), file: file.name, time: now.toLocaleString('zh-CN'), custCount: prevC.length, userCount: prevU.length, custSnap: JSON.parse(JSON.stringify(get().custRAW)), userSnap: JSON.parse(JSON.stringify(get().userRAW)) };

        set({ custRAW: prevC, userRAW: prevU, ...computed, history: [h, ...prevH].slice(0, 20), loading: false });
        try { localStorage.setItem('pa_import_pot_cust', JSON.stringify(prevC)); localStorage.setItem('pa_import_pot_user', JSON.stringify(prevU)); } catch { /* quota */ }
        resolve({ custN, userN: userRows.length });
      } catch (err) { set({ loading: false }); reject(err); }
    };
    reader.readAsArrayBuffer(file);
  }),

  resetAll: () => {
    const empty = recompute([], []);
    set({ custRAW: [], userRAW: [], history: [], ...empty });
    ['pa_import_pot_cust', 'pa_import_pot_user'].forEach(k => { try { localStorage.removeItem(k); } catch { /* */ } });
  },

  restoreLS: () => {
    try {
      const c = localStorage.getItem('pa_import_pot_cust'), u = localStorage.getItem('pa_import_pot_user');
      if (c || u) {
        const custRAW: PotCustRow[] = c ? JSON.parse(c) : [];
        const userRAW: PotUserRow[] = u ? JSON.parse(u) : [];
        set({ custRAW, userRAW, ...recompute(custRAW, userRAW) });
      }
    } catch { /* corrupted */ }
  },

  restoreHistory: (idx) => {
    const h = get().history[idx];
    if (!h) return;
    const custRAW = JSON.parse(JSON.stringify(h.custSnap || []));
    const userRAW = JSON.parse(JSON.stringify(h.userSnap || []));
    set({ custRAW, userRAW, ...recompute(custRAW, userRAW) });
  },

  deleteHistory: (idx) => {
    const h = [...get().history];
    h.splice(idx, 1);
    set({ history: h });
  },
}));
