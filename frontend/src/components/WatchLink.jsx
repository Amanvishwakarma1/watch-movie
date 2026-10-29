import { Link } from 'react-router-dom';
import { requestPageFullscreen } from '../media.js';

// Opens the player fullscreen and starts the movie. The movie travels in the
// route state so playback starts without waiting for another API call.
export default function WatchLink({ movie, children, ...props }) {
  function onClick(event) {
    // Ctrl/Cmd/middle-click opens a new tab as usual; no fullscreen for those.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    requestPageFullscreen();
  }

  return (
    <Link to={`/movie/${movie.id}`} state={{ movie, autoplay: true }} onClick={onClick} {...props}>
      {children}
    </Link>
  );
}
