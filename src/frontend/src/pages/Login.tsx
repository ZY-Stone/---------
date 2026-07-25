import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const auth = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim()) { setError('请输入账号'); return; }
    if (!password) { setError('请输入密码'); return; }
    setError(''); setLoading(true);
    try { await auth.login(username.trim(), password); onSuccess(); } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="login-overlay">
      <div className="login-box">
        <div className="login-logo"><span style={{ display:'inline-block',width:10,height:10,borderRadius:'50%',background:'#2563eb',marginRight:8 }} />产品分析一体化平台</div>
        <div className="login-sub">请输入账号密码登录</div>
        <div className="login-field"><label>账号</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
        <div className="login-field"><label>密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
        {error && <div className="login-error" style={{ display:'block' }}>{error}</div>}
        <button className="login-btn" onClick={handleLogin} disabled={loading}>{loading ? '登录中...' : '登 录'}</button>
        <div className="login-hint">Demo 演示 · admin / admin123</div>
      </div>
    </div>
  );
}
