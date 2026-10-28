import { Link } from 'react-router-dom';
import { posterUrl } from '../media.js';

export default function MovieCard({ movie }) {
  return (
    <Link className="movie-card" to={`/movie/${movie.id}`}>
      <div className="poster-wrap">
        <img src={posterUrl(movie.poster_url)} alt={`${movie.title} poster`} loading="lazy" />
        <span className="poster-play" aria-hidden="true">▶</span>
      </div>
      <div className="movie-card-info">
        <h3>{movie.title}</h3>
        <p>{[movie.release_year, movie.genre].filter(Boolean).join(' · ') || 'Movie'}</p>
      </div>
    </Link>
  );
}
