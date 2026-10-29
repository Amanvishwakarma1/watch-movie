import { useCallback, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react/lazy';
import { posterUrl } from '../media.js';
import usePlayerGestures, { formatTime } from '../usePlayerGestures.js';

// Mux streams in ~2 s HLS chunks. hls.js would otherwise keep buffering up to
// 10 minutes ahead on low-bitrate movies; stay 30-60 s ahead to save viewers' data.
const hlsConfig = { maxBufferLength: 30, maxMaxBufferLength: 60 };
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Like MX Player, reopen a movie where the viewer stopped (kept per browser).
const resumeKey = (id) => `nightscreen:resume:${id}`;
function readResume(id) {
  try {
    const value = Number(localStorage.getItem(resumeKey(id)));
    return Number.isFinite(value) && value > 15 ? value : 0;
  } catch {
    return 0;
  }
}
function writeResume(id, seconds) {
  try {
    if (seconds) localStorage.setItem(resumeKey(id), String(Math.floor(seconds)));
    else localStorage.removeItem(resumeKey(id));
  } catch { /* storage unavailable */ }
}

export default function VideoPlayer({ movie }) {
  const shellRef = useRef(null);
  const savedAt = useRef(0);
  const [resumeAt] = useState(() => readResume(movie.id));
  const [showResume, setShowResume] = useState(resumeAt > 0);
  const { feedback, scrub } = usePlayerGestures(shellRef);
  const shellId = `player-${movie.id}`;

  // Fullscreen the wrapper (not just the player) so the skip indicators stay visible.
  const playerRef = useCallback((el) => {
    if (!el) return;
    let tries = 0;
    const link = () => {
      if (el.mediaController) el.mediaController.fullscreenElement = shellRef.current;
      else if (tries++ < 60) requestAnimationFrame(link);
    };
    link();
  }, []);

  function onTimeUpdate(event) {
    const { currentTime, duration } = event.target;
    if (Math.abs(currentTime - savedAt.current) < 5) return;
    savedAt.current = currentTime;
    // Within the last minute counts as finished (credits), so start fresh next time.
    writeResume(movie.id, duration && currentTime < duration - 60 ? currentTime : 0);
  }

  function startOver() {
    const el = shellRef.current?.querySelector('mux-player');
    if (el) el.currentTime = 0;
    writeResume(movie.id, 0);
    setShowResume(false);
  }

  return (
    <>
      <div className="player-frame">
        <div className="player-shell" id={shellId} ref={shellRef}>
          <MuxPlayer
            ref={playerRef}
            key={movie.mux_playback_id}
            playbackId={movie.mux_playback_id}
            poster={posterUrl(movie.mux_playback_id, 1280)}
            metadata={{ video_title: movie.title }}
            accentColor="#e50914"
            streamType="on-demand"
            preload="metadata"
            startTime={resumeAt || undefined}
            forwardSeekOffset={10}
            backwardSeekOffset={10}
            playbackRates={playbackRates}
            // ← / → are handled by usePlayerGestures so they work page-wide and show the skip indicator.
            hotkeys="noarrowleft noarrowright noj nol"
            _hlsConfig={hlsConfig}
            onTimeUpdate={onTimeUpdate}
            onPlaying={() => showResume && setTimeout(() => setShowResume(false), 6000)}
            onEnded={() => writeResume(movie.id, 0)}
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
      </div>
      <p className="player-hint">
        Double-tap the left or right side to skip 10 s (keep tapping to skip more) · drag sideways across the picture to scrub · ← / → keys skip 10 s
      </p>
    </>
  );
}
