import { create } from 'zustand';
import * as XLSX from 'xlsx';
import { GROUPS } from './authStore';

// 小组名→部门名 映射表
const GROUP_DEPT_MAP: Record<string, string> = {};
GROUPS.forEach(g => { GROUP_DEPT_MAP[g.n] = g.dept; });

// 运营部门：不参与任何数据统计
const EXCLUDED_DEPTS = new Set(['管理部', '深圳业务中心', '运营部']);

// 判断是否属于被排除的部门
function isExcludedDept(deptName: string): boolean {
  return EXCLUDED_DEPTS.has(deptName);
}

// ===== 27 产品（对齐模板 cols 7-33）=====
const PRODS = [
  'IPC','球机','专用摄像机','服务器','网络产品','PC产品','NVR','存储',
  'LED拼控','LCD解码','智能交通','移动终端产品','出入口停车','门禁','对讲',
  '人员通道','报警','音频产品','传感产品','智慧屏与视频会议','通用软件',
  '行业软件','基础软件','新业务(热成像/睿影/消防等)','网络安全','综合布线与机柜机房','智能计算'
];

// ===== 客户维度 Sheet 表头映射 =====
const CUST_MAP: Record<string, string> = {
  'siebel编码': 'siebel', '售达方描述(客户)': 'name', '售达方描述': 'name',
  '销售': 'sales',
  '销售部门': 'group',   // 模板中实际存的是小组名，自动推导部门
  '部门': 'group',
  '是否规上': 'guishang', '产品线合计': 'width',
  '接口人': 'contact', '对接人': 'contact',
  '客户等级': 'level', '等级': 'level',
};

// ===== 用户维度 Sheet 表头映射 =====
const USER_MAP: Record<string, string> = {
  '最终用户-行业': 'industry',   // → 平台「用户行业」
  '最终用户': 'user',            // → 平台「用户名称」
  'siebel编码': 'siebel', '销售': 'sales',
  '销售部门': 'group',   // 模板中实际存的是小组名，自动推导部门
  '部门': 'group',
  '是否规上': 'guishang', '产品线合计': 'width',
  '接口人': 'contact', '对接人': 'contact',
  '用户等级': 'level', '等级': 'level',
};

// 根据小组名自动推导部门
function resolveDept(groupName: string): string {
  if (!groupName) return '';
  return GROUP_DEPT_MAP[groupName] || groupName;
}

// 规范化表头：全角括号 → 半角，统一空格，去除不可见字符
function normalizeHeader(h: string): string {
  return h
    .replace(/（/g, '(').replace(/）/g, ')')   // 全角括号 → 半角
    .replace(/：/g, ':').replace(/，/g, ',')   // 全角冒号/逗号
    .replace(/\s+/g, '')                        // 去除所有空白
    .trim();
}

function buildMap(headers: string[], mapping: Record<string, string>): Record<string, number> {
  // 同时建立原始键和规范化键的索引，方便双路查找
  const normKeys: Record<string, string> = {};
  Object.entries(mapping).forEach(([k, v]) => { normKeys[normalizeHeader(k)] = v; });

  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    const raw = String(h || '').trim();
    // 优先精确匹配，再尝试规范化匹配
    const key = mapping[raw] || normKeys[normalizeHeader(raw)];
    if (key) m[key] = i;
  });
  // Find prodStart = first product column index
  for (let i = 0; i < headers.length; i++) {
    const s = String(headers[i] || '').trim();
    if (PRODS.includes(s)) { m.prodStart = i; break; }
  }
  return m;
}

// ===== 数据行类型 =====
export interface WidthRow {
  user?: string; name?: string; siebel: string; industry: string;
  sales: string; group: string; dept: string; guishang: string;
  width: number; prods: Record<string, number>;
  contact: string; level: string;
}

interface HistoryEntry {
  id: number; file: string; time: string; userCount: number; custCount: number;
  userSnap: WidthRow[]; custSnap: WidthRow[];
}

interface WidthState {
  userGS: WidthRow[]; custGS: WidthRow[];
  history: HistoryEntry[]; loading: boolean; currentView: 'user' | 'cust';
  kpi: { avgWidth: string; scaleUsers: number; scaleCustomers: number; coverage: string; widthYoY: string; customersMoM: number; coverageYoY: string };
  widthDistribution: { labels: string[]; data: number[] };
  productCoverage: Array<{ product: string; covered: number; rate: string; yoy: string }>;
  teamWidthRank: Array<{ dept: string; avgWidth: string; count: number }>;
  customerAnalysis: { good: Array<{ name: string; avgW: number; soldCnt: number; sold: string }>; bad: Array<{ name: string; avgW: number; soldCnt: number; sold: string }> };
  userAnalysis: { good: Array<{ name: string; avgW: number; soldCnt: number }>; bad: Array<{ name: string; avgW: number; soldCnt: number }> };
  heatmapData: { total: number; products: Array<{ name: string; rate: string; count: number }> };
  coverageTable: Array<{ product: string; covered: number; rate: string; yoy: string }>;
  importExcel: (file: File) => Promise<{ nu: number; nc: number }>;
  resetAll: () => void; restoreLS: () => void;
  restoreHistory: (idx: number) => void; deleteHistory: (idx: number) => void;
}

function compute(custGS: WidthRow[], userGS: WidthRow[]) {
  const c = custGS.filter(x => x.guishang === '是');
  const u = userGS.filter(x => x.guishang === '是');
  const sc = c.length, su = u.length;
  const tw = c.reduce((s, x) => s + (x.width || 0), 0);
  const cv = sc > 0 ? c.reduce((s, x) => s + Object.values(x.prods || {}).filter(v => v > 0).length, 0) / (sc * PRODS.length) * 100 : 0;
  // Product coverage
  const coverageTable = PRODS.map(prod => {
    const covered = c.filter(x => (x.prods || {})[prod] > 0).length;
    return { product: prod, covered, rate: sc > 0 ? (covered / sc * 100).toFixed(1) : '0', yoy: '-' };
  }).sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
  // Team rank
  const tm: Record<string, { total: number; count: number }> = {};
  c.forEach(x => { const d = x.dept || '未知'; if (!tm[d]) tm[d] = { total: 0, count: 0 }; tm[d].total += x.width || 0; tm[d].count++; });
  const teamWidthRank = Object.entries(tm).map(([dept, v]) => ({ dept, avgWidth: (v.total / v.count).toFixed(2), count: v.count })).sort((a, b) => parseFloat(b.avgWidth) - parseFloat(a.avgWidth));
  // Width distribution
  const buckets = [0, 0, 0, 0, 0, 0];
  const all = [...c, ...u];
  all.forEach(x => { const w = x.width || 0; if (w === 0) buckets[0]++; else if (w <= 3) buckets[1]++; else if (w <= 6) buckets[2]++; else if (w <= 10) buckets[3]++; else if (w <= 15) buckets[4]++; else buckets[5]++; });
  // Customer analysis
  const cs = [...c].sort((a, b) => (b.width || 0) - (a.width || 0));
  const custGood = cs.slice(0, 20).map(x => ({ name: x.name || '', avgW: x.width || 0, soldCnt: Object.values(x.prods || {}).filter(v => v > 0).length, sold: x.sales || '-' }));
  const custBad = [...cs].reverse().slice(0, 20).map(x => ({ name: x.name || '', avgW: x.width || 0, soldCnt: Object.values(x.prods || {}).filter(v => v > 0).length, sold: x.sales || '-' }));
  // User analysis
  const us = [...u].sort((a, b) => (b.width || 0) - (a.width || 0));
  const userGood = us.slice(0, 10).map(x => ({ name: x.user || '', avgW: x.width || 0, soldCnt: Object.values(x.prods || {}).filter(v => v > 0).length }));
  const userBad = [...us].reverse().slice(0, 10).map(x => ({ name: x.user || '', avgW: x.width || 0, soldCnt: Object.values(x.prods || {}).filter(v => v > 0).length }));
  // Heatmap
  const heatmapData = { total: sc, products: PRODS.map(prod => ({ name: prod, rate: sc > 0 ? (c.filter(x => (x.prods || {})[prod] > 0).length / sc * 100).toFixed(1) : '0', count: c.filter(x => (x.prods || {})[prod] > 0).length })) };

  return {
    kpi: { avgWidth: sc > 0 ? (tw / sc).toFixed(2) : '0', scaleUsers: su, scaleCustomers: sc, coverage: cv.toFixed(1), widthYoY: '-', customersMoM: 0, coverageYoY: '-' },
    widthDistribution: { labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'], data: buckets },
    productCoverage: coverageTable, teamWidthRank, heatmapData, coverageTable,
    customerAnalysis: { good: custGood, bad: custBad },
    userAnalysis: { good: userGood, bad: userBad },
  };
}

export const useWidthStore = create<WidthState>((set, get) => ({
  userGS: [], custGS: [], history: [], loading: false, currentView: 'user',
  kpi: { avgWidth: '0', scaleUsers: 0, scaleCustomers: 0, coverage: '0', widthYoY: '-', customersMoM: 0, coverageYoY: '-' },
  widthDistribution: { labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'], data: [0, 0, 0, 0, 0, 0] },
  productCoverage: [], teamWidthRank: [], heatmapData: { total: 0, products: [] }, coverageTable: [],
  customerAnalysis: { good: [], bad: [] }, userAnalysis: { good: [], bad: [] },

  importExcel: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        set({ loading: true });
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const users: WidthRow[] = [], custs: WidthRow[] = [];

        wb.SheetNames.forEach(sn => {
          if (!wb.Sheets[sn]) return;
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as unknown[][];
          if (!rows || rows.length < 2) return;
          const headers = rows[0].map(h => String(h || ''));

          const isUser = headers.some(h => h.includes('最终用户') && !h.includes('行业'));
          const isCust = headers.some(h => h.includes('售达方'));

          if (isUser) {
            const cm = buildMap(headers, USER_MAP);
            const ps = cm.prodStart || 7;
            rows.slice(1).forEach(row => {
              const nm = String(row[cm.user] || '').trim(); if (!nm) return;
              const sw = parseInt(String(row[cm.width])) || 0;
              const prods: Record<string, number> = {};
              let actualW = 0;
              PRODS.forEach((p, i) => {
                const v = row[ps + i] === 1 || String(row[ps + i]).trim() === '1' ? 1 : 0;
                prods[p] = v; actualW += v;
              });
              const groupName = String(row[cm.group] || '');
              const deptName = resolveDept(groupName);
              if (isExcludedDept(deptName)) return;
            users.push({
                user: nm, siebel: String(row[cm.siebel] || ''), industry: String(row[cm.industry] || ''),
                sales: String(row[cm.sales] || ''), group: groupName, dept: deptName,
                guishang: String(row[cm.guishang] || '').includes('是') ? '是' : '否',
                width: sw || actualW, prods,
                contact: String(row[cm.contact] || ''), level: String(row[cm.level] || ''),
              });
            });
          }
          if (isCust) {
            const cm = buildMap(headers, CUST_MAP);
            const ps = cm.prodStart || 6;
            rows.slice(1).forEach(row => {
              const nm = String(row[cm.name] || '').trim(); if (!nm) return;
              const sw = parseInt(String(row[cm.width])) || 0;
              const prods: Record<string, number> = {};
              let actualW = 0;
              PRODS.forEach((p, i) => {
                const v = row[ps + i] === 1 || String(row[ps + i]).trim() === '1' ? 1 : 0;
                prods[p] = v; actualW += v;
              });
              const groupName = String(row[cm.group] || '');
              const deptName2 = resolveDept(groupName);
              if (isExcludedDept(deptName2)) return;
            custs.push({
                name: nm, siebel: String(row[cm.siebel] || ''), industry: '',
                sales: String(row[cm.sales] || ''), group: groupName, dept: deptName2,
                guishang: String(row[cm.guishang] || '').includes('是') ? '是' : (row[cm.guishang] == null ? '否' : '否'),
                width: sw || actualW, prods,
                contact: String(row[cm.contact] || ''), level: String(row[cm.level] || ''),
              });
            });
          }
        });

        const { history: ph } = get();
        const pu: WidthRow[] = []; users.forEach(r => { pu.push(r); });
        const pc: WidthRow[] = []; custs.forEach(r => { pc.push(r); });
        const nu = users.length, nc = custs.length;

        const computed = compute(pc, pu);
        const now = new Date(); const ts = now.toLocaleString('zh-CN');
        set({ userGS: pu, custGS: pc, ...computed, history: [{ id: Date.now(), file: file.name, time: ts, userCount: pu.length, custCount: pc.length, userSnap: JSON.parse(JSON.stringify(pu)), custSnap: JSON.parse(JSON.stringify(pc)) }, ...ph].slice(0, 20), loading: false });
        try { localStorage.setItem('pa_width_cust', JSON.stringify(pc)); localStorage.setItem('pa_width_user', JSON.stringify(pu)); } catch { /* */ }
        resolve({ nu, nc });
      } catch (err) { set({ loading: false }); reject(err); }
    };
    reader.readAsArrayBuffer(file);
  }),

  resetAll: () => { set({ userGS: [], custGS: [], history: [], ...compute([], []) }); ['pa_width_cust', 'pa_width_user'].forEach(k => { try { localStorage.removeItem(k); } catch { /* */ } }); },
  restoreLS: () => { try { const c = localStorage.getItem('pa_width_cust'), u = localStorage.getItem('pa_width_user'); if (c || u) { const custGS = c ? JSON.parse(c) : []; const userGS = u ? JSON.parse(u) : []; set({ custGS, userGS, ...compute(custGS, userGS) }); } } catch { /* */ } },
  restoreHistory: (idx) => { const h = get().history[idx]; if (!h) return; const userGS = JSON.parse(JSON.stringify(h.userSnap || [])); const custGS = JSON.parse(JSON.stringify(h.custSnap || [])); set({ userGS, custGS, ...compute(custGS, userGS) }); },
  deleteHistory: (idx) => { const h = [...get().history]; h.splice(idx, 1); set({ history: h }); },
}));
