import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, viewerSession } from './api.js';

// Who is watching, and where each person stopped. Progress lives on the server
// per account; guests are not remembered. Mirrors the server's rules, so what
// the screen shows matches what was stored.
export const RESUME_MIN = 15;
export const FINISHED_WITHIN = 60;
export const isResumable = (position, duration) =>
  position > RESUME_MIN && !(duration > 0 && position >= duration - FINISHED_WITHIN);

const ViewerContext = createContext(null);

export function ViewerProvider({ children }) {
  const hasToken = Boolean(viewerSession.get());
  const [user, setUser] = useState(null);
  // Public pages never wait for an account check when nobody is signed in.
  const [ready, setReady] = useState(!hasToken);
  const [progress, setProgress] = useState({}); // movieId -> { position, duration, updatedAt }
  const userRef = useRef(null);
  userRef.current = user;

  const loadProgress = useCallback(async () => {
    const data = await api.getProgress();
    const map = {};
    for (const row of data.progress) {
      map[row.movie_id] = { position: row.position_seconds, duration: row.duration_seconds, updatedAt: row.updated_at };
    }
    setProgress(map);
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    let active = true;
    Promise.all([api.viewerMe(), api.getProgress()])
      .then(([me, prog]) => {
        if (!active) return;
        setUser(me.user);
        const map = {};
        for (const row of prog.progress) {
          map[row.movie_id] = { position: row.position_seconds, duration: row.duration_seconds, updatedAt: row.updated_at };
        }
        setProgress(map);
      })
      .catch(() => { /* a 401 already cleared the token; other errors leave the viewer signed out for now */ })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [hasToken]);

  const authenticate = useCallback(async (request) => {
    const data = await request();
    setUser(data.user);
    try { await loadProgress(); } catch { setProgress({}); }
    setReady(true);
  }, [loadProgress]);

  const login = useCallback((username, password) => authenticate(() => api.viewerLogin(username, password)), [authenticate]);
  const signup = useCallback((username, password) => authenticate(() => api.signup(username, password)), [authenticate]);
  const resetPassword = useCallback((username, password) => authenticate(() => api.resetPassword(username, password)), [authenticate]);

  const logout = useCallback(() => {
    // An admin account's dashboard session ends with its viewer sign-in.
    if (userRef.current?.is_admin) api.logout();
    api.viewerLogout();
    setUser(null);
    setProgress({});
  }, []);

  const saveProgress = useCallback((movieId, position, duration, options) => {
    if (!userRef.current) return;
    setProgress(current => {
      const next = { ...current };
      if (isResumable(position, duration)) next[movieId] = { position, duration, updatedAt: new Date().toISOString() };
      else delete next[movieId];
      return next;
    });
    api.saveProgress(movieId, position, duration, options).catch(err => {
      if (err.status === 401) logout();
    });
  }, [logout]);

  const clearProgress = useCallback((movieId) => {
    if (!userRef.current) return;
    setProgress(current => {
      const next = { ...current };
      delete next[movieId];
      return next;
    });
    api.clearProgress(movieId).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ user, ready, progress, login, signup, resetPassword, logout, saveProgress, clearProgress }),
    [user, ready, progress, login, signup, resetPassword, logout, saveProgress, clearProgress]
  );
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}
