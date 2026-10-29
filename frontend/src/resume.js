// Like MX Player, reopen a movie where the viewer stopped (kept per browser).
const resumeKey = (id) => `nightscreen:resume:${id}`;

export function readResume(id) {
  try {
    const value = Number(localStorage.getItem(resumeKey(id)));
    return Number.isFinite(value) && value > 15 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeResume(id, seconds) {
  try {
    if (seconds) localStorage.setItem(resumeKey(id), String(Math.floor(seconds)));
    else localStorage.removeItem(resumeKey(id));
  } catch { /* storage unavailable */ }
}
