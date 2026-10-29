import { useState } from 'react';
import { movieMeta, posterUrl } from '../media.js';
import WatchLink from './WatchLink.jsx';
import { PlayIcon } from './Icons.jsx';

export default function MovieCard({ movie }) {
  const [loaded, setLoaded] = useState(false);
  const meta = movieMeta(movie);

  // A cached image can finish before React attaches onLoad.
  const imageRef = (img) => { if (img?.complete) setLoaded(true); };

  return (
    <WatchLink className="movie-card" movie={movie} aria-label={`Play ${movie.title}`}>
      <div className={`card-media${loaded ? '' : ' skeleton'}`}>
        <img
          ref={imageRef}
          src={posterUrl(movie.mux_playback_id, 640)}
          alt=""
          loading="lazy"
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <span className="card-play" aria-hidden="true"><PlayIcon /></span>
        <div className="card-info">
          <h3>{movie.title}</h3>
          {meta && <p>{meta}</p>}
        </div>
      </div>
    </WatchLink>
  );
}
