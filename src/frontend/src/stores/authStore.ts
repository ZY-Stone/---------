import { create } from 'zustand';
import type { User, DeptItem, GroupItem, PersonItem } from '../types/common';

const DEPTS: DeptItem[] = [
  { n:'管理部',ld:'admin',cw:0,aw:0,mw:0,cov:0,yoy:'-' },{ n:'深圳业务中心',ld:'顾城成',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'运营部',ld:'江英',cw:0,aw:0,mw:0,cov:0,yoy:'-' },{ n:'客户销售一部',ld:'高巍',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售二部',ld:'吴正豪',cw:0,aw:0,mw:0,cov:0,yoy:'-' },{ n:'大客户销售部',ld:'韩杰',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'场景数字化销售部',ld:'明良斌',cw:0,aw:0,mw:0,cov:0,yoy:'-' },{ n:'行业一部',ld:'卫玉昌',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'行业二部',ld:'房伟建',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
];
const GROUPS: GroupItem[] = [
  { n:'客户销售一组',dept:'客户销售一部',ld:'张栋柱',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售二组',dept:'客户销售一部',ld:'陈刚',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售三组',dept:'客户销售一部',ld:'高巍(兼)',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售四组',dept:'客户销售一部',ld:'刘文宇',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售五组',dept:'客户销售一部',ld:'赵志强',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售六组',dept:'客户销售二部',ld:'吴正豪(兼)',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售七组',dept:'客户销售二部',ld:'朱迪',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售八组',dept:'客户销售二部',ld:'邓畅',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'客户销售九组',dept:'客户销售二部',ld:'李拥政',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'工业企业一组',dept:'行业一部',ld:'潘仲楠',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'工业企业二组',dept:'行业一部',ld:'未指定',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'智慧商贸组',dept:'行业一部',ld:'李耀东',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'智慧建筑组',dept:'行业一部',ld:'朱绪浩',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'交通行业组',dept:'行业二部',ld:'王魁',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'公安交警行业组',dept:'行业二部',ld:'房伟建(兼)',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'司法行业组',dept:'行业二部',ld:'刘冬',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'文教卫组',dept:'行业二部',ld:'王茜',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'政府行业组',dept:'行业二部',ld:'廖北宸',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
];
const PERSONS: PersonItem[] = [
  { n:'段金君',dept:'客户销售一部',grp:'-',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'彭威12',dept:'客户销售一部',grp:'客户销售一组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'张振德',dept:'客户销售一部',grp:'客户销售一组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'王嘉急5',dept:'客户销售一部',grp:'客户销售一组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'沙坤',dept:'客户销售一部',grp:'客户销售一组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'黄燕滨',dept:'客户销售一部',grp:'客户销售一组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'孙天6',dept:'客户销售一部',grp:'客户销售二组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'罗肖福',dept:'客户销售一部',grp:'客户销售二组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'陈伟添',dept:'客户销售一部',grp:'客户销售二组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'蔡均鑫',dept:'客户销售一部',grp:'客户销售二组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'罗兴华',dept:'客户销售一部',grp:'客户销售三组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'王鹏旭',dept:'客户销售一部',grp:'客户销售三组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'熊佳豪',dept:'客户销售一部',grp:'客户销售三组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'陈春11',dept:'客户销售一部',grp:'客户销售三组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
  { n:'赵鑫阳5',dept:'客户销售一部',grp:'客户销售三组',cw:0,aw:0,mw:0,cov:0,yoy:'-' },
];
export { DEPTS, GROUPS, PERSONS };

interface AuthState {
  user: User | null; isLoggedIn: boolean;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, isLoggedIn: false,
  login: async (username, password) => {
    if (username === 'admin' && password === 'admin123') {
      const u: User = { id: 210, username: 'admin', name: '管理员', role: 'admin', dept: '管理部', group: '-' };
      set({ user: u, isLoggedIn: true });
      sessionStorage.setItem('pa_login', JSON.stringify(u));
      return true;
    }
    throw new Error('账号或密码错误');
  },
  logout: () => { set({ user: null, isLoggedIn: false }); sessionStorage.removeItem('pa_login'); },
  restoreSession: () => {
    try { const s = sessionStorage.getItem('pa_login'); if (s) { const u = JSON.parse(s); set({ user: u, isLoggedIn: true }); return true; } } catch { /* */ }
    return false;
  },
}));
