import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Navbar from '../components/Navbar.jsx';
import MovieCard from '../components/MovieCard.jsx';
import useSlowHint from '../useSlowHint.js';

const PAGE_SIZE = 30;

export default function Home() {
  const [search, setSearch] = useState('');
  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const slow = useSlowHint(loading);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api.listMovies({ search, limit: PAGE_SIZE })
        .then(data => {
          if (!active) return;
          setMovies(data.movies); setTotal(data.pagination.total); setPage(1); setError('');
        })
        .catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await api.listMovies({ search, limit: PAGE_SIZE, page: page + 1 });
      setMovies(current => [...current, ...data.movies.filter(m => !current.some(c => c.id === m.id))]);
      setTotal(data.pagination.total);
      setPage(page + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <section className="hero">
          <div className="hero-glow" />
          <p className="eyebrow"><span /> YOUR NEXT MOVIE NIGHT</p>
          <h1>Stories worth<br /><span>staying up for.</span></h1>
          <p className="hero-copy">Find your next favorite film. Pick a title, press play, and settle in.</p>
          <a className="button button-primary" href="#movies">Explore movies <span>↘</span></a>
          <div className="hero-art" aria-hidden="true">
            <div className="art-card art-card-one"><span>THE</span><b>UNKNOWN</b><small>A STORY BEGINS</small></div>
            <div className="art-card art-card-two"><span>AFTER</span><b>HOURS</b><small>WHEN THE CITY SLEEPS</small></div>
            <div className="art-card art-card-three"><span>THE LAST</span><b>ORBIT</b><small>BEYOND THE STARS</small></div>
          </div>
          <div className="hero-bottom-label">INDEPENDENT STORIES. ENDLESS WORLDS.</div>
        </section>

        <section className="catalog section-wrap" id="movies">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE COLLECTION</p>
              <h2>Find your <span>next watch.</span></h2>
            </div>
            <label className="search-box">
              <span>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search movies..." aria-label="Search movies" />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}
            </label>
          </div>

          {loading ? <div className="state-message">Loading the collection…{slow && <p className="wake-hint">Waking up the server — this can take up to a minute after a quiet period.</p>}</div> :
            error && !movies.length ? <div className="state-message error-state">{error}<p>Please refresh the page in a moment.</p></div> :
            movies.length ? <>
              <div className="movie-grid">{movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}</div>
              {movies.length < total && (
                <div className="load-more">
                  <button className="button button-quiet" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more movies'}</button>
                </div>
              )}
            </> :
            <div className="empty-state"><span>✳</span><h3>{search ? 'No matches just yet.' : 'The screen is waiting.'}</h3><p>{search ? 'Try another title or genre.' : 'New stories will appear here when the admin adds a movie.'}</p></div>
          }
        </section>
      </main>
      <footer className="footer"><Link className="brand" to="/"><span className="brand-mark">N</span><span>Night<span className="brand-light">Screen</span></span></Link><span>Made for movie nights.</span></footer>
    </div>
  );
}
