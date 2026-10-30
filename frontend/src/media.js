import { API_BASE } from './api.js';

// Without a custom cover, posters are frames taken from the video itself
// (Mux thumbnails). Resizing on delivery keeps the images small.
export function posterUrl(playbackId, width = 500) {
  if (!playbackId) return '';
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}`;
}

// The cover shown for a movie: the admin's own image when there is one,
// otherwise a frame from the video. `width` only applies to video frames;
// uploaded covers are already shrunk (see cover.js).
export function coverUrl(movie, width = 500) {
  if (movie.has_cover) {
    return `${API_BASE}/api/movies/${movie.id}/cover?v=${encodeURIComponent(movie.cover_updated_at || '')}`;
  }
  return posterUrl(movie.mux_playback_id, width);
}

// Browsers only allow fullscreen from inside a click, and the player page has
// not loaded yet at that point, so the whole page goes fullscreen instead.
// The player treats the page as its fullscreen element (see VideoPlayer).
// iPhones cannot fullscreen a page; there the player page still fills the screen.
export function requestPageFullscreen() {
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen()
    .then(() => {
      // Phones: turn sideways like a video app. Desktop browsers reject this, which is fine.
      if (matchMedia('(pointer: coarse)').matches) screen.orientation?.lock?.('landscape').catch(() => {});
    })
    .catch(() => {});
}

export function movieMeta(movie) {
  return [movie.release_year, movie.genre].filter(Boolean).join(' · ');
}
