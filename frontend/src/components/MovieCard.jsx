import { useState } from 'react';
import { coverUrl, movieMeta } from '../media.js';
import WatchLink from './WatchLink.jsx';
import { PlayIcon } from './Icons.jsx';
import { useViewer } from '../viewer.jsx';

export default function MovieCard({ movie }) {
  const [loaded, setLoaded] = useState(false);
  const meta = movieMeta(movie);
  const saved = useViewer().progress[movie.id];
  const watched = saved?.duration ? Math.min(100, (saved.position / saved.duration) * 100) : 0;

  // A cached image can finish before React attaches onLoad.
  const imageRef = (img) => { if (img?.complete) setLoaded(true); };

  return (
    <WatchLink className="movie-card" movie={movie} aria-label={`Play ${movie.title}`}>
      <div className={`card-media${loaded ? '' : ' skeleton'}`}>
        <img
          ref={imageRef}
          src={coverUrl(movie, 640)}
          alt=""
          loading="lazy"
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <span className="card-play" aria-hidden="true"><PlayIcon /></span>
        {watched > 0 && <div className="card-progress" aria-hidden="true"><div style={{ width: `${watched}%` }} /></div>}
        <div className="card-info">
          <h3>{movie.title}</h3>
          {meta && <p>{meta}</p>}
        </div>
      </div>
    </WatchLink>
  );
}
