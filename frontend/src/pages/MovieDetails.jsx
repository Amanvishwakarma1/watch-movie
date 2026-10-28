import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Navbar from '../components/Navbar.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import useSlowHint from '../useSlowHint.js';

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const slow = useSlowHint(loading);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setMovie(null);
    api.getMovie(id)
      .then(data => { if (active) setMovie(data.movie); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (movie) document.title = `${movie.title} — NightScreen`;
    return () => { document.title = 'NightScreen — Movie Streaming'; };
  }, [movie]);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="detail-page section-wrap">
        <Link to="/" className="back-link">← Back to all movies</Link>
        {loading ? <div className="state-message">Loading movie…{slow && <p className="wake-hint">Waking up the server — this can take up to a minute after a quiet period.</p>}</div> :
          error ? <div className="state-message error-state">{error}</div> :
          movie && <>
            <div className="detail-heading">
              <div>
                <p className="eyebrow">NOW SHOWING</p>
                <h1>{movie.title}</h1>
                <p className="detail-meta">{[movie.release_year, movie.genre].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <VideoPlayer movie={movie} />
            {movie.description && <section className="description-block"><h2>About this movie</h2><p>{movie.description}</p></section>}
          </>
        }
      </main>
      <footer className="footer"><Link className="brand" to="/"><span className="brand-mark">N</span><span>Night<span className="brand-light">Screen</span></span></Link><span>Made for movie nights.</span></footer>
    </div>
  );
}
