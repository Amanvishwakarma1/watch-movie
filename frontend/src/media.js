// Posters are frames taken from the video itself (Mux thumbnails), so there is
// nothing separate to upload. Resizing on delivery keeps the images small.
export function posterUrl(playbackId, width = 500) {
  if (!playbackId) return '';
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}`;
}
