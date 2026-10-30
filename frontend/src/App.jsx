import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, session } from './api.js';
import Home from './pages/Home.jsx';
import Watch from './pages/Watch.jsx';
import { Logo } from './components/Brand.jsx';
import Account from './pages/Account.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function ProtectedAdmin({ admin, checked, children }) {
  if (!checked) return <div className="initial-loader"><Logo className="initial-loader-logo" /></div>;
  return admin ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const [admin, setAdmin] = useState(null);
  // Without a stored token there is nothing to verify, so public pages never wait on the API.
  const [checked, setChecked] = useState(() => !session.get());

  async function refreshAdmin() {
    try {
      const data = await api.me();
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setChecked(true);
    }
  }

  useEffect(() => { if (session.get()) refreshAdmin(); }, []);

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
        <ProtectedAdmin admin={admin} checked={checked}>
          <AdminDashboard onLogout={logout} />
        </ProtectedAdmin>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
