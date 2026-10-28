// Inserts a Cloudinary delivery transformation into an /image/upload/ URL.
// Posters are uploaded full size; resizing on delivery saves free-tier bandwidth.
export function posterUrl(url, width = 500) {
  if (!url || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
