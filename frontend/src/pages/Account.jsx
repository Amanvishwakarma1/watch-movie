import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { SITE_NAME } from '../components/Brand.jsx';
import useSlowHint from '../useSlowHint.js';
import { useViewer } from '../viewer.jsx';

// One page, three modes: sign in (returning viewers), sign up (new ones) and
// reset (forgot the password: username + a new password, no email or code).
const COPY = {
  signin: {
    eyebrow: 'WELCOME BACK',
    title: <>Sign <span>in.</span></>,
    intro: 'Pick up where you left off.',
    button: 'Sign in',
    busy: 'Signing in…'
  },
  signup: {
    eyebrow: 'JOIN',
    title: <>Create your <span>account.</span></>,
    intro: `Pick a username and password. ${SITE_NAME} will remember where you stopped in each movie, on any device.`,
    button: 'Create account',
    busy: 'Creating account…'
  },
  reset: {
    eyebrow: 'FORGOT YOUR PASSWORD?',
    title: <>Set a new <span>password.</span></>,
    intro: 'Enter your username and choose a new password. Your watch history stays with your account.',
    button: 'Save new password',
    busy: 'Saving…'
  }
};

export default function Account() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(location.state?.mode === 'signup' ? 'signup' : 'signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);
  const copy = COPY[mode];
  const choosing = mode !== 'signin'; // sign up and reset both pick a new password

  if (viewer.user && !busy) return <Navigate to="/" replace />;

  function go(next) {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    // Nothing verifies a reset, so a typo would lock the person out of their own account.
    if (mode === 'reset' && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const action = { signin: viewer.login, signup: viewer.signup, reset: viewer.resetPassword }[mode];
      await action(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar hideAccount />
      <main className="auth-page">
        <form className="admin-form auth-form" onSubmit={submit}>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.intro}</p>
          <label>Username
            <input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength="30"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </label>
          {mode === 'signup' && <p className="field-hint">3-30 characters: letters, numbers, dot, dash or underscore.</p>}
          <label>{mode === 'reset' ? 'New password' : 'Password'}
            <input
              type="password"
              autoComplete={choosing ? 'new-password' : 'current-password'}
              minLength={choosing ? 8 : undefined}
              maxLength="72"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          {choosing && <p className="field-hint">At least 8 characters.</p>}
          {mode === 'reset' && (
            <label>Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                maxLength="72"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {slow && <p className="field-hint wake-hint">Waking up the server — this can take up to a minute after a quiet period.</p>}
          <button className="button button-primary full-width" disabled={busy}>{busy ? copy.busy : copy.button}</button>
          {mode === 'signin' && (
            <p className="auth-switch"><button type="button" className="link-button" onClick={() => go('reset')}>Forgot password?</button></p>
          )}
          <p className="auth-switch">
            {mode === 'signup' ? 'Already have an account?' : mode === 'reset' ? 'Remembered it?' : `New to ${SITE_NAME}?`}{' '}
            <button type="button" className="link-button" onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <Link className="back-link centered" to="/">← Back to movies</Link>
        </form>
      </main>
    </div>
  );
}
