import { useCallback, useEffect, useRef, useState } from 'react';
import MovieCard from './MovieCard.jsx';
import { ChevronIcon } from './Icons.jsx';

// A horizontally scrolling row of cards. Arrow buttons appear on devices with a
// mouse; touch screens swipe the row directly.
export default function MovieRow({ title, movies }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    });
  }, []);

  useEffect(() => {
    update();
    const observer = new ResizeObserver(update);
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [update, movies.length]);

  function page(direction) {
    const el = trackRef.current;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="row" aria-label={title}>
      <h2 className="row-title">{title}</h2>
      <div className="row-viewport">
        {!edges.start && (
          <button type="button" className="row-arrow left" onClick={() => page(-1)} aria-label={`Scroll ${title} back`}>
            <ChevronIcon direction="left" />
          </button>
        )}
        <div className="row-track" ref={trackRef} onScroll={update}>
          {movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}
        </div>
        {!edges.end && (
          <button type="button" className="row-arrow right" onClick={() => page(1)} aria-label={`Scroll ${title} forward`}>
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>
    </section>
  );
}
