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

// Sends a file straight to Cloudinary using params signed by our API.
// XHR rather than fetch so large videos can report upload progress.
function uploadToCloudinary({ uploadUrl, params }, file, onProgress) {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    Object.entries(params).forEach(([key, value]) => body.append(key, value));
    body.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error?.message || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(body);
  });
}

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
  // Returns the Cloudinary public_id of the uploaded file.
  uploadMedia: async (kind, file, onProgress) => {
    const signed = await request('/api/admin/uploads/signature', { method: 'POST', body: JSON.stringify({ kind }) });
    if (file.size > signed.maxBytes) {
      throw new Error(`${kind === 'video' ? 'Video' : 'Poster'} is larger than ${Math.floor(signed.maxBytes / 1024 / 1024)} MB.`);
    }
    await uploadToCloudinary(signed, file, onProgress);
    return signed.params.public_id;
  },
  discardMedia: (kind, publicId) =>
    request('/api/admin/uploads', { method: 'DELETE', body: JSON.stringify({ kind, public_id: publicId }) }),
  createMovie: (fields) =>
    request('/api/admin/movies', { method: 'POST', body: JSON.stringify(fields) }),
  updateMovie: (id, fields) =>
    request(`/api/admin/movies/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  deleteMovie: (id) => request(`/api/admin/movies/${id}`, { method: 'DELETE' })
};
