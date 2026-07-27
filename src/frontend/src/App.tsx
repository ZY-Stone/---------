import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import TopBar from './components/layout/TopBar';
import Login from './pages/Login';
import Overview from './pages/Overview';
import WidthPage from './pages/Width';
import PotentialPage from './pages/Potential';
import Admin from './pages/Admin';

type Page = 'overview' | 'width' | 'potential' | 'admin';

export default function App() {
  const auth = useAuthStore();
  const [page, setPage] = useState<Page>('overview');
  const [showLogin, setShowLogin] = useState(true);

  useEffect(() => {
    if (auth.restoreSession()) {
      setShowLogin(false);
    }
  }, []);

  function onLoginSuccess() { setShowLogin(false); }
  function onLogout() { setShowLogin(true); auth.logout(); }

  if (showLogin) return <Login onSuccess={onLoginSuccess} />;

  return (
    <div>
      <TopBar page={page} onNavigate={setPage} onLogout={onLogout} />
      <div className="layout">
        {page === 'overview' && <Overview />}
        {page === 'width' && <WidthPage />}
        {page === 'potential' && <PotentialPage />}
        {page === 'admin' && <Admin />}
      </div>
    </div>
  );
}
