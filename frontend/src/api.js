const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'movie_admin_token';

export const session = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (token) => { try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } }
};

async function request(path, options = {}) {
  const token = session.get();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  }).catch(() => {
    throw new Error('Cannot reach the server. Please try again in a moment.');
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) session.clear();
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

// Sends the video straight to Mux's direct-upload URL.
// XHR rather than fetch so large videos can report upload progress.
function uploadToMux(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(file);
  });
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  listMovies: ({ page = 1, limit = 20, search = '' } = {}) =>
    request(`/api/movies?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
  getMovie: (id) => request(`/api/movies/${encodeURIComponent(id)}`),
  login: async (username, password) => {
    const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    session.set(data.token);
    return data;
  },
  me: () => request('/api/auth/me'),
  logout: () => session.clear(),
  // Uploads a video to Mux and waits until it is playable. Returns the upload id.
  // onStatus receives 'uploading' then 'processing'; onUploadId fires as soon as the id exists
  // so the caller can clean up if a later step fails.
  uploadVideo: async (file, { onProgress, onStatus, onUploadId } = {}) => {
    const upload = await request('/api/admin/uploads', { method: 'POST' });
    onUploadId?.(upload.uploadId);
    if (file.size > upload.maxBytes) {
      throw new Error(`Video is larger than ${Math.floor(upload.maxBytes / 1024 / 1024 / 1024)} GB.`);
    }
    onStatus?.('uploading');
    await uploadToMux(upload.uploadUrl, file, onProgress);

    onStatus?.('processing');
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const state = await request(`/api/admin/uploads/${encodeURIComponent(upload.uploadId)}`);
      if (state.status === 'ready') return upload.uploadId;
      if (state.status === 'errored') throw new Error(state.error || 'Mux could not process this video.');
      await wait(3000);
    }
    throw new Error('Mux is taking too long to process the video. Check the Mux dashboard and try again.');
  },
  discardUpload: (uploadId) =>
    request(`/api/admin/uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE' }),
  createMovie: (fields) =>
    request('/api/admin/movies', { method: 'POST', body: JSON.stringify(fields) }),
  updateMovie: (id, fields) =>
    request(`/api/admin/movies/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  deleteMovie: (id) => request(`/api/admin/movies/${id}`, { method: 'DELETE' })
};
