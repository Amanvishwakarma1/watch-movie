import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { movieMeta } from '../media.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { BackIcon } from '../components/Icons.jsx';
import { SITE_NAME, SITE_TITLE } from '../components/Brand.jsx';
import useSlowHint from '../useSlowHint.js';

// True after `delay` ms without mouse, touch or keyboard activity.
function useIdle(delay = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delay);
    };
    const events = ['pointermove', 'pointerdown', 'keydown'];
    events.forEach(name => window.addEventListener(name, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(timer);
      events.forEach(name => window.removeEventListener(name, wake));
    };
  }, [delay]);
  return idle;
}

export default function Watch() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // A card click hands over the movie, so playback starts without another request.
  const handed = location.state?.movie?.id === id ? location.state.movie : null;
  const [autoPlay] = useState(() => Boolean(handed && location.state.autoplay));
  const [movie, setMovie] = useState(handed);
  const [error, setError] = useState('');
  const loading = !movie && !error;
  const slow = useSlowHint(loading);
  const idle = useIdle();

  useEffect(() => {
    // Drop the autoplay flag so a page reload doesn't start the movie on its own.
    if (location.state?.autoplay) navigate(location.pathname, { replace: true, state: { movie: handed } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (movie?.id === id) return undefined;
    let active = true;
    setMovie(null); setError('');
    api.getMovie(id)
      .then(data => { if (active) setMovie(data.movie); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (movie) document.title = `${movie.title} — ${SITE_NAME}`;
    return () => { document.title = SITE_TITLE; };
  }, [movie]);

  // Leaving the player leaves fullscreen too.
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  function goBack() {
    // Opened from a shared link there is no page of ours to go back to.
    if (location.key !== 'default') navigate(-1);
    else navigate('/');
  }

  const meta = movie ? movieMeta(movie) : '';

  return (
    <div className={`watch-page${idle && movie ? ' idle' : ''}`}>
      <header className="watch-top">
        <button type="button" className="watch-back" onClick={goBack} aria-label="Back to browse"><BackIcon /></button>
        {movie && (
          <div className="watch-title">
            <h1>{movie.title}</h1>
            {meta && <p>{meta}</p>}
          </div>
        )}
      </header>
      {loading ? (
        <div className="watch-state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Loading movie…</p>
          {slow && <p className="wake-hint">Waking up the server — this can take up to a minute after a quiet period.</p>}
        </div>
      ) : error ? (
        <div className="watch-state error-state">
          <p>{error}</p>
          <Link className="button button-quiet" to="/">Browse movies</Link>
        </div>
      ) : (
        <VideoPlayer movie={movie} autoPlay={autoPlay} />
      )}
    </div>
  );
}
