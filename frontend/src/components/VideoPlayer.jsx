import { useCallback, useEffect, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react/lazy';
import { coverUrl } from '../media.js';
import usePlayerGestures, { formatTime } from '../usePlayerGestures.js';
import { useViewer } from '../viewer.jsx';

// Mux streams in ~2 s HLS chunks. hls.js would otherwise keep buffering up to
// 10 minutes ahead on low-bitrate movies; stay 30-60 s ahead to save viewers' data.
const hlsConfig = { maxBufferLength: 30, maxMaxBufferLength: 60 };
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SAVE_EVERY = 15; // seconds of playback between saves to the viewer's account

export default function VideoPlayer({ movie, autoPlay = false }) {
  const shellRef = useRef(null);
  const viewer = useViewer();
  // Where this viewer stopped last time (nothing for guests). Read once, on open.
  const [resumeAt] = useState(() => viewer.progress[movie.id]?.position || 0);
  const [showResume, setShowResume] = useState(resumeAt > 0);
  const { feedback, scrub } = usePlayerGestures(shellRef);

  // The latest values, readable from event handlers and cleanup without re-subscribing.
  const latest = useRef({ time: 0, duration: 0, played: false, sentAt: 0 });
  const save = useRef(viewer.saveProgress);
  save.current = viewer.saveProgress;
  const signedIn = Boolean(viewer.user);

  const flush = useCallback((options) => {
    const state = latest.current;
    // Until playback really started, currentTime is 0 and must not overwrite a saved position.
    if (!signedIn || !state.played || !state.duration) return;
    state.sentAt = state.time;
    save.current(movie.id, state.time, state.duration, options);
  }, [signedIn, movie.id]);

  // Leaving the page or the player stores the final position.
  useEffect(() => {
    const onHide = () => flush({ keepalive: true });
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush({ keepalive: true });
    };
  }, [flush]);

  // The player fills the page, so the page is what goes fullscreen. That is also
  // what a card click fullscreens, so the player's button shows the right state
  // and the back button and skip indicators stay visible.
  const playerRef = useCallback((el) => {
    if (!el) return;
    let tries = 0;
    const link = () => {
      if (el.mediaController) el.mediaController.fullscreenElement = document.documentElement;
      else if (tries++ < 60) requestAnimationFrame(link);
    };
    link();
  }, []);

  function onTimeUpdate(event) {
    const { currentTime, duration } = event.target;
    const state = latest.current;
    state.time = currentTime;
    state.duration = Number.isFinite(duration) ? duration : 0;
    if (Math.abs(currentTime - state.sentAt) >= SAVE_EVERY) flush();
  }

  function startOver() {
    const el = shellRef.current?.querySelector('mux-player');
    if (el) el.currentTime = 0;
    latest.current.sentAt = 0;
    viewer.clearProgress(movie.id);
    setShowResume(false);
  }

  return (
    <div className="player-shell" ref={shellRef}>
      <MuxPlayer
        ref={playerRef}
        key={movie.mux_playback_id}
        playbackId={movie.mux_playback_id}
        poster={coverUrl(movie, 1920)}
        metadata={{ video_title: movie.title }}
        accentColor="#e50914"
        streamType="on-demand"
        preload="metadata"
        // "any" falls back to muted autoplay where the browser blocks sound.
        autoPlay={autoPlay ? 'any' : undefined}
        startTime={resumeAt || undefined}
        forwardSeekOffset={10}
        backwardSeekOffset={10}
        playbackRates={playbackRates}
        // ← / → are handled by usePlayerGestures so they work page-wide and show the skip indicator.
        hotkeys="noarrowleft noarrowright noj nol"
        _hlsConfig={hlsConfig}
        onTimeUpdate={onTimeUpdate}
        onPlaying={() => {
          latest.current.played = true;
          if (showResume) setTimeout(() => setShowResume(false), 6000);
        }}
        onPause={() => flush()}
        onEnded={() => flush()}
      />
      {feedback && (
        <div key={feedback.id} className={`seek-ripple ${feedback.side}`} aria-hidden="true">
          <span>{feedback.side === 'left' ? '◀◀' : '▶▶'}</span>{feedback.text}
        </div>
      )}
      {scrub && (
        <div className="scrub-bubble" aria-hidden="true">
          <strong>{scrub.delta < 0 ? '−' : '+'}{formatTime(Math.abs(scrub.delta))}</strong>
          <span>{formatTime(scrub.to)} / {formatTime(scrub.duration)}</span>
        </div>
      )}
      {showResume && (
        <div className="resume-chip">
          <span>Resuming at {formatTime(resumeAt)}</span>
          <button type="button" onClick={startOver}>Start over</button>
        </div>
      )}
    </div>
  );
}
