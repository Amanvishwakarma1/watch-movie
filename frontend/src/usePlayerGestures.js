import { useEffect, useState } from 'react';

// MX Player-style controls layered over the Mux player:
//  - double-tap the left / right side to skip 10 s; keep tapping to add 10 s more
//  - double-tap the middle: play/pause on touch, fullscreen with a mouse
//  - drag sideways across the picture to scrub, with a time preview
//  - ← / → (or J / L) skip 10 s from anywhere on the page
const SEEK_STEP = 10;
const DOUBLE_TAP_MS = 300;
const STREAK_MS = 700;
const DRAG_THRESHOLD = 16;

// Taps on these are on the picture itself, not on one of the player's buttons.
const SURFACES = new Set(['video', 'media-controller', 'mux-video']);
const TYPING = new Set(['input', 'textarea', 'select', 'media-time-range', 'media-volume-range']);

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function usePlayerGestures(shellRef) {
  const [feedback, setFeedback] = useState(null);
  const [scrub, setScrub] = useState(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const player = () => shell.querySelector('mux-player');
    const ready = (el) => el && Number.isFinite(el.duration) && el.duration > 0;

    let pointerType = 'mouse';
    let lastTap = null;
    let streak = null;
    let drag = null;
    let suppressClickUntil = 0;
    let hideTimer;

    const onSurface = (event) => SURFACES.has(event.composedPath()[0]?.localName);
    const zoneOf = (clientX) => {
      const { left, width } = shell.getBoundingClientRect();
      const at = (clientX - left) / width;
      return at < 0.35 ? 'left' : at > 0.65 ? 'right' : 'center';
    };

    function seekBy(side, byTap) {
      const el = player();
      if (!ready(el)) return;
      el.currentTime = clamp(el.currentTime + (side === 'left' ? -SEEK_STEP : SEEK_STEP), 0, el.duration - 0.5);
      const total = (streak?.side === side && Date.now() < streak.until ? streak.total : 0) + SEEK_STEP;
      streak = { side, total, byTap, until: Date.now() + STREAK_MS };
      setFeedback({ side, text: `${total} seconds`, id: Date.now() });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setFeedback(null), STREAK_MS);
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }

    // Capture phase: runs before the player's own click handling, so a
    // double-tap can stop the second click from toggling play/pause again.
    function onClick(event) {
      if (Date.now() < suppressClickUntil) {
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      if (!onSurface(event)) return;
      const el = player();
      const now = Date.now();
      const zone = zoneOf(event.clientX);

      if (zone !== 'center' && streak?.byTap && streak.side === zone && now < streak.until) {
        event.stopPropagation();
        seekBy(zone, true);
        return;
      }
      if (lastTap && lastTap.zone === zone && now - lastTap.at < DOUBLE_TAP_MS) {
        event.stopPropagation();
        // A mouse click toggles play/pause, so undo what the first click did.
        if (el && lastTap.wasPaused !== el.paused) {
          if (lastTap.wasPaused) el.pause(); else el.play().catch(() => {});
        }
        lastTap = null;
        if (zone !== 'center') seekBy(zone, true);
        else if (pointerType === 'mouse') toggleFullscreen();
        else if (el) {
          if (el.paused) el.play().catch(() => {}); else el.pause();
        }
        return;
      }
      lastTap = { at: now, zone, wasPaused: el ? el.paused : true };
    }

    function onPointerDown(event) {
      pointerType = event.pointerType || 'mouse';
      const el = player();
      if (!event.isPrimary || event.button > 0 || !onSurface(event) || !ready(el)) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: el.currentTime, to: el.currentTime, duration: el.duration, active: false };
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        drag.active = true;
      }
      // A full-width swipe covers 1-5 minutes depending on the movie's length.
      const span = clamp(drag.duration / 20, 60, 300);
      drag.to = clamp(drag.from + (dx / shell.getBoundingClientRect().width) * span, 0, drag.duration - 0.5);
      setScrub({ delta: drag.to - drag.from, to: drag.to, duration: drag.duration });
    }

    function onPointerUp(event) {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.active) {
        const el = player();
        if (el) el.currentTime = drag.to;
        suppressClickUntil = Date.now() + 400;
        setScrub(null);
      }
      drag = null;
    }

    function onPointerCancel() {
      drag = null;
      setScrub(null);
    }

    function onKeyDown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const path = event.composedPath();
      if (path.some(node => TYPING.has(node.localName) || node.isContentEditable)) return;
      const el = player();
      if (!el) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (key === 'ArrowLeft' || key === 'j' || key === 'ArrowRight' || key === 'l') {
        event.preventDefault();
        seekBy(key === 'ArrowLeft' || key === 'j' ? 'left' : 'right');
        return;
      }
      // Inside the player its own shortcuts handle the rest; only cover the
      // case where nothing on the page has focus.
      if (event.target !== document.body) return;
      if (key === ' ' || key === 'k') {
        event.preventDefault();
        if (el.paused) el.play().catch(() => {}); else el.pause();
      } else if (key === 'f') {
        toggleFullscreen();
      } else if (key === 'm') {
        el.muted = !el.muted;
      }
    }

    shell.addEventListener('click', onClick, true);
    shell.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(hideTimer);
      shell.removeEventListener('click', onClick, true);
      shell.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shellRef]);

  return { feedback, scrub };
}
