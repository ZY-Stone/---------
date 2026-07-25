import { create } from 'zustand';
import type { FilterState, OptionItem } from '../types/common';
import { DEPTS, GROUPS } from './authStore';

interface FilterStore extends FilterState {
  deptOptions: OptionItem[];
  groupOptions: OptionItem[];
  setDept: (v: string) => void;
  setGroup: (v: string) => void;
  setPerson: (v: string) => void;
  setDateRange: (s: string, e: string) => void;
  resetAll: () => void;
}

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

export const useFilterStore = create<FilterStore>((set, get) => ({
  dateStart: '2026-07-01', dateEnd: '2026-07-16',
  dept: 'all', group: 'all', person: 'all', compareType: 'yoy',
  deptOptions: DEPTS.filter(d => !['管理部','深圳业务中心','运营部'].includes(d.n)).map(d => ({ label: d.n, value: d.n })),
  get groupOptions() {
    const { dept } = get();
    let list = GROUPS.map(g => ({ label: g.n, value: g.n, dept: g.dept }));
    if (dept !== 'all') list = list.filter(g => g.dept === dept);
    return list;
  },
  setDept: (v) => set({ dept: v, group: 'all', person: 'all' }),
  setGroup: (v) => set({ group: v, person: 'all' }),
  setPerson: (v) => set({ person: v }),
  setDateRange: (s, e) => set({ dateStart: s, dateEnd: e }),
  resetAll: () => set({ dateStart: '2026-07-01', dateEnd: '2026-07-16', dept: 'all', group: 'all', person: 'all' }),
}));
