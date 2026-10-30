import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, session } from './api.js';
import Home from './pages/Home.jsx';
import Watch from './pages/Watch.jsx';
import { Logo } from './components/Brand.jsx';
import Account from './pages/Account.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function ProtectedAdmin({ admin, checked, verify, children }) {
  // An admin viewer's sign-in stores the dashboard token after this page first loaded,
  // so the first visit here checks it. While the startup check is still running
  // (`checked` false) App is already doing that.
  const [settled, setSettled] = useState(() => Boolean(admin) || !session.get() || !checked);
  useEffect(() => {
    if (settled) return undefined;
    let active = true;
    verify().finally(() => { if (active) setSettled(true); });
    return () => { active = false; };
  }, [settled, verify]);

  if (!checked || !settled) return <div className="initial-loader"><Logo className="initial-loader-logo" /></div>;
  return admin ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const [admin, setAdmin] = useState(null);
  // Without a stored token there is nothing to verify, so public pages never wait on the API.
  const [checked, setChecked] = useState(() => !session.get());

  const refreshAdmin = useCallback(async () => {
    try {
      const data = await api.me();
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => { if (session.get()) refreshAdmin(); }, [refreshAdmin]);

  // The token can be removed from elsewhere (an expired session, or an admin viewer signing out).
  useEffect(() => session.subscribe(() => { if (!session.get()) setAdmin(null); }), []);

  function logout() {
    api.logout();
    setAdmin(null);
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movie/:id" element={<Watch />} />
      <Route path="/login" element={<Account />} />
      <Route path="/admin/login" element={
        admin ? <Navigate to="/admin" replace /> : <AdminLogin onLogin={refreshAdmin} />
      } />
      <Route path="/admin" element={
        <ProtectedAdmin admin={admin} checked={checked} verify={refreshAdmin}>
          <AdminDashboard onLogout={logout} />
        </ProtectedAdmin>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
