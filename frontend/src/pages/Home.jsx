import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { readResume } from '../resume.js';
import Navbar from '../components/Navbar.jsx';
import Brand, { SITE_NAME } from '../components/Brand.jsx';
import Billboard from '../components/Billboard.jsx';
import MovieRow from '../components/MovieRow.jsx';
import MovieCard from '../components/MovieCard.jsx';
import { BillboardSkeleton, GridSkeleton, RowSkeleton } from '../components/Skeletons.jsx';
import useSlowHint from '../useSlowHint.js';

const PAGE_SIZE = 50; // the API's maximum

// Kept between visits so coming back from the player shows the rows instantly
// while a fresh copy loads in the background.
let catalogCache = null;

const wakeHint = 'Waking up the server — this can take up to a minute after a quiet period.';

// "Action, Thriller" → ['Action', 'Thriller']
const splitGenres = (genre) => (genre || '').split(/[,/|]/).map(g => g.trim()).filter(Boolean);

function buildRows(movies) {
  const rows = [];
  const started = movies.filter(movie => readResume(movie.id));
  if (started.length) rows.push({ title: 'Continue watching', movies: started });
  rows.push({ title: `New on ${SITE_NAME}`, movies });

  const byGenre = new Map();
  for (const movie of movies) {
    for (const genre of splitGenres(movie.genre)) {
      const key = genre.toLowerCase();
      if (!byGenre.has(key)) byGenre.set(key, { title: genre, movies: [] });
      byGenre.get(key).movies.push(movie);
    }
  }
  // A genre row that holds every movie would just repeat the "New on" row.
  const genreRows = [...byGenre.values()].filter(row => row.movies.length < movies.length);
  genreRows.sort((a, b) => b.movies.length - a.movies.length);
  return rows.concat(genreRows);
}

export default function Home() {
  const [search, setSearch] = useState('');
  const [movies, setMovies] = useState(() => catalogCache?.movies || []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(() => catalogCache?.total || 0);
  const [loading, setLoading] = useState(!catalogCache);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const slow = useSlowHint(loading);
  const searching = search.trim() !== '';

  useEffect(() => {
    let active = true;
    if (!searching && catalogCache) {
      setMovies(catalogCache.movies); setTotal(catalogCache.total); setPage(1);
    } else {
      setLoading(true);
    }
    const timer = setTimeout(() => {
      api.listMovies({ search, limit: PAGE_SIZE })
        .then(data => {
          if (!active) return;
          if (!searching) catalogCache = { movies: data.movies, total: data.pagination.total };
          setMovies(data.movies); setTotal(data.pagination.total); setPage(1); setError('');
        })
        .catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, searching ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [search, searching]);

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

  const rows = useMemo(() => buildRows(movies), [movies]);

  const moreButton = movies.length < total && (
    <div className="load-more">
      <button className="button button-quiet" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more movies'}</button>
    </div>
  );

  let content;
  if (searching) {
    content = (
      <section className="search-results">
        <h2 className="results-title">
          {loading ? 'Searching…' : `${total} ${total === 1 ? 'result' : 'results'} for “${search.trim()}”`}
        </h2>
        {loading ? <GridSkeleton /> :
          error && !movies.length ? <div className="state-message error-state">{error}<p>Please try again in a moment.</p></div> :
          movies.length ? <><div className="card-grid">{movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}</div>{moreButton}</> :
          <div className="empty-state"><h3>No matches just yet.</h3><p>Try another title or genre.</p></div>}
      </section>
    );
  } else if (loading) {
    content = (
      <>
        <BillboardSkeleton>
          <p className="loading-status" role="status">
            <span className="visually-hidden">Loading the collection…</span>
            {slow && wakeHint}
          </p>
        </BillboardSkeleton>
        <div className="rows"><RowSkeleton /><RowSkeleton /></div>
      </>
    );
  } else if (error && !movies.length) {
    content = <div className="state-message error-state home-message">{error}<p>Please refresh the page in a moment.</p></div>;
  } else if (movies.length) {
    content = (
      <>
        <Billboard movie={movies[0]} />
        <div className="rows">{rows.map(row => <MovieRow key={row.title} title={row.title} movies={row.movies} />)}</div>
        {moreButton}
      </>
    );
  } else {
    content = <div className="empty-state home-message"><span>✳</span><h3>The screen is waiting.</h3><p>New stories will appear here when the admin adds a movie.</p></div>;
  }

  return (
    <div className="app-shell">
      <Navbar overlay search={search} onSearch={setSearch} />
      <main className="home">{content}</main>
      <footer className="footer"><Brand /><span>Made for movie nights.</span></footer>
    </div>
  );
}
