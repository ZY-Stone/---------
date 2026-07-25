import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

type Page = 'overview' | 'width' | 'potential' | 'admin';
const nav: { p: Page; label: string }[] = [
  { p: 'overview', label: '📊 数据总览' }, { p: 'width', label: '📐 产品宽度分析' },
  { p: 'potential', label: '🚀 潜力产品分析' }, { p: 'admin', label: '⚙ 账号管理' },
];
const roles: Record<string, { badge: string; color: string }> = {
  admin: { badge: '管理员', color: '#2563eb' }, gm: { badge: '总经理', color: '#1e40af' },
  director: { badge: '总监', color: '#0891b2' }, manager: { badge: '主管', color: '#ea580c' },
};

export default function TopBar({ page, onNavigate, onLogout }: { page: Page; onNavigate: (p: Page) => void; onLogout: () => void }) {
  const auth = useAuthStore();
  const [show, setShow] = useState(false);
  const ri = roles[auth.user?.role || ''] || { badge: '用户', color: '#64748b' };

  return (
    <div className="topbar">
      <div className="logo">产品分析一体化平台</div>
      <div className="topbar-nav">
        {nav.map(n => <button key={n.p} className={`topbar-nav-btn${page === n.p ? ' active' : ''}`} onClick={() => onNavigate(n.p)}>{n.label}</button>)}
      </div>
      <div className="user-menu" onClick={() => setShow(!show)}>
        <span className="name">{auth.user?.name || '用户'}</span>
        <span className="role-badge" style={{ background: ri.color }}>{ri.badge}</span>
        <span style={{ opacity:.8, marginLeft:6, fontSize:16, fontWeight:700, color:'#333' }}>▼</span>
        {show && <div className="user-menu-dropdown"><div className="um-item" onClick={() => { setShow(false); onLogout(); }}>⏻ 退出登录</div></div>}
      </div>
    </div>
  );
}
