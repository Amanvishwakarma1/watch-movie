// Shrinks a chosen picture in the browser before upload: at most 1280 px wide,
// re-encoded as WebP (JPEG where WebP is unavailable). A 12 MB phone photo
// becomes ~100-200 KB, which keeps the free database small and pages fast.
const MAX_WIDTH = 1280;

export async function prepareCover(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Choose a JPEG, PNG or WebP picture.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That picture could not be read. Try a JPEG, PNG or WebP file.');
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const toBlob = (type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.88);
  if (!blob) throw new Error('That picture could not be prepared. Try another one.');
  return blob;
}
