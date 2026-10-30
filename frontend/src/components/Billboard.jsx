import { useState } from 'react';
import { coverUrl, movieMeta } from '../media.js';
import { readResume } from '../resume.js';
import WatchLink from './WatchLink.jsx';
import { SITE_NAME } from './Brand.jsx';
import { PlayIcon } from './Icons.jsx';

// The large featured movie at the top of the home page.
export default function Billboard({ movie }) {
  const meta = movieMeta(movie);
  const [loaded, setLoaded] = useState(false);
  // A cached image can finish before React attaches onLoad.
  const imageRef = (img) => { if (img?.complete) setLoaded(true); };
  return (
    <section className="billboard">
      <img
        ref={imageRef}
        className={`billboard-image${loaded ? '' : ' loading'}`}
        src={coverUrl(movie, 1920)}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      <div className="billboard-shade" />
      <div className="billboard-content">
        <p className="billboard-tag">New on {SITE_NAME}</p>
        <h1>{movie.title}</h1>
        {meta && <p className="billboard-meta">{meta}</p>}
        {movie.description && <p className="billboard-copy">{movie.description}</p>}
        <WatchLink className="button button-play" movie={movie}>
          <PlayIcon /> {readResume(movie.id) ? 'Resume' : 'Play'}
        </WatchLink>
      </div>
    </section>
  );
}
