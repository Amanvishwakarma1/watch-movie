import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Navbar from '../components/Navbar.jsx';
import useSlowHint from '../useSlowHint.js';

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(username, password);
      await onLogin();
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main className="auth-page">
        <form className="admin-form auth-form" onSubmit={submit}>
          <p className="eyebrow">RESTRICTED ACCESS</p>
          <h1>Admin <span>sign in.</span></h1>
          <p className="muted">Sign in to manage your movie collection.</p>
          <label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <p className="form-error">{error}</p>}
          {slow && <p className="field-hint wake-hint">Waking up the server — this can take up to a minute after a quiet period.</p>}
          <button className="button button-primary full-width" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
          <Link className="back-link centered" to="/">← Back to movies</Link>
        </form>
      </main>
    </div>
  );
}
