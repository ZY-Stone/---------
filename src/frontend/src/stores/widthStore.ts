import { create } from 'zustand';
import * as XLSX from 'xlsx';
import { useFilterStore } from './filterStore';
import type { WidthRecord, WidthKpi, ProductCoverage, TeamRank, CustomerItem, CrossSellItem, HeatmapItem } from '../types/common';

const PRODS = ['IPC','球机','NVR','DVR','XVR','热成像','门禁','可视对讲','道闸','出入口停车','液晶拼接屏','LED屏','LCD','监视器','视频会议','会议平板','解码器','交换机','网桥','无线网桥','服务器','存储','平台软件','智能交通','执法记录仪','人员通道','安检'];

function mapCols(hd: string[], tp: string) {
  const m: Record<string, number> = {};
  hd.forEach((h, i) => { const s = String(h||'').trim();
    if (s.includes('siebel')) m.siebel = i;
    if (tp === 'user') { if (s.includes('最终用户')&&!s.includes('行业')) m.user = i; if (s.includes('行业')&&s.includes('用户')) m.industry = i; }
    else { if (s.includes('售达方')||s.includes('客户')) m.name = i; }
    if (s.includes('销售')&&!s.includes('部门')) m.sales = i;
    if (s.includes('部门')) m.dept = i; if (s.includes('规上')||s.includes('是否')) m.guishang = i;
    if (s.includes('合计')||s.includes('宽度')) m.width = i; if (s.includes('接口')||s.includes('对接')) m.contact = i;
    if (s.includes('等级')) m.level = i; if (s.includes('IPC')||s.includes('球机')) m.prodStart = i;
  });
  if (m.prodStart == null) m.prodStart = 6;
  return m;
}

interface WidthState {
  userGS: WidthRecord[]; custGS: WidthRecord[]; history: Array<{
    id: number; file: string; time: string; userCount: number; custCount: number;
    userSnap: WidthRecord[]; custSnap: WidthRecord[];
  }>;
  loading: boolean; currentView: 'user' | 'cust';
  // getters
  kpi: WidthKpi;
  productCoverage: ProductCoverage[];
  teamWidthRank: TeamRank[];
  customerAnalysis: { good: CustomerItem[]; bad: CustomerItem[] };
  userAnalysis: { good: CustomerItem[]; bad: CustomerItem[] };
  heatmapData: HeatmapItem;
  crossSell: CrossSellItem;
  // actions
  importExcel: (file: File) => Promise<{ nu: number; nc: number }>;
  resetAll: () => void;
  restoreLS: () => void;
  restoreHistory: (idx: number) => void;
  deleteHistory: (idx: number) => void;
}

function computeKpi(custGS: WidthRecord[]): WidthKpi {
  const c = custGS.filter(x => x.guishang === '是');
  const sc = c.length;
  const tw = c.reduce((s,x) => s + (x.width||0), 0);
  const cv = sc > 0 ? c.reduce((s,x) => s + Object.values(x.prods||{}).filter(v=>v>0).length, 0) / (sc * PRODS.length) * 100 : 0;
  return { avgWidth: sc > 0 ? (tw/sc).toFixed(2) : '0', scaleUsers: 0, scaleCustomers: sc, coverage: cv.toFixed(1), widthYoY: '-', customersMoM: 0, coverageYoY: '-' };
}

export const useWidthStore = create<WidthState>((set, get) => ({
  userGS: [], custGS: [], history: [], loading: false, currentView: 'user',
  kpi: { avgWidth:'0',scaleUsers:0,scaleCustomers:0,coverage:'0',widthYoY:'-',customersMoM:0,coverageYoY:'-' },
  productCoverage: [], teamWidthRank: [], customerAnalysis: { good: [], bad: [] },
  userAnalysis: { good: [], bad: [] }, heatmapData: { total: 0, products: [] },
  crossSell: { prods: [], matrix: [], bundles: [] },

  importExcel: (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        set({ loading: true });
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const u: WidthRecord[] = [], cu: WidthRecord[] = [];
        wb.SheetNames.forEach(sn => {
          if (!wb.Sheets[sn]) return;
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as unknown[][];
          if (!rows || rows.length < 2) return;
          const hd = rows[0].map(h => String(h||''));
          const hasU = hd.some(h => h.includes('最终用户') && !h.includes('行业'));
          if (hasU) {
            const col = mapCols(hd, 'user');
            rows.slice(1).forEach(row => {
              const nm = String(row[col.user]||'').trim(); if (!nm) return;
              const entry: WidthRecord = { user: nm, siebel: String(row[col.siebel]||''), industry: String(row[col.industry]||''), sales: String(row[col.sales]||''), dept: String(row[col.dept]||''), guishang: String(row[col.guishang]||'').includes('是')?'是':'否', width: parseInt(String(row[col.width]))||0, prods: {}, contact: String(row[col.contact]||''), level: String(row[col.level]||'') };
              PRODS.forEach((p, i) => { entry.prods[p] = (row[col.prodStart + i] === 1 || String(row[col.prodStart + i]).trim() === '1') ? 1 : 0; });
              u.push(entry);
            });
          }
        });
        const { userGS: prevU, custGS: prevC, history: prevH } = get();
        const newU = [...prevU]; u.forEach(r => { const ex = newU.find(x => x.user === r.user); if (ex) Object.assign(ex, r); else newU.push(r); });
        const newC = [...prevC];
        cu.forEach(r => { const ex = newC.find(x => x.name === r.name); if (ex) Object.assign(ex, r); else newC.push(r); });
        const now = new Date();
        const h = { id: Date.now(), file: file.name, time: now.toLocaleString('zh-CN'), userCount: newU.length, custCount: newC.length, userSnap: prevU, custSnap: prevC };
        set({ userGS: newU, custGS: newC, kpi: computeKpi(newC), history: [h, ...prevH].slice(0, 20), loading: false });
        try { localStorage.setItem('pa_width_cust', JSON.stringify(newC)); localStorage.setItem('pa_width_user', JSON.stringify(newU)); } catch {}
        resolve({ nu: u.length, nc: cu.length });
      } catch (err) { set({ loading: false }); reject(err); }
    };
    reader.readAsArrayBuffer(file);
  }),
  resetAll: () => { set({ userGS:[], custGS:[], history:[], kpi: computeKpi([]) }); ['pa_width_cust','pa_width_user'].forEach(k => { try { localStorage.removeItem(k); } catch {} }); },
  restoreLS: () => {
    try { const c = localStorage.getItem('pa_width_cust'), u = localStorage.getItem('pa_width_user'); const custGS = c ? JSON.parse(c) : []; const userGS = u ? JSON.parse(u) : []; set({ custGS, userGS, kpi: computeKpi(custGS) }); } catch {}
  },
  restoreHistory: (idx) => { const h = get().history[idx]; if (!h) return; set({ userGS: JSON.parse(JSON.stringify(h.userSnap)), custGS: JSON.parse(JSON.stringify(h.custSnap)) }); },
  deleteHistory: (idx) => { const h = [...get().history]; h.splice(idx, 1); set({ history: h }); },
}));
