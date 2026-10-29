// Posters are frames taken from the video itself (Mux thumbnails), so there is
// nothing separate to upload. Resizing on delivery keeps the images small.
export function posterUrl(playbackId, width = 500) {
  if (!playbackId) return '';
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}`;
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
