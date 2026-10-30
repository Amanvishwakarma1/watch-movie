import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { coverUrl } from '../media.js';
import { prepareCover } from '../cover.js';
import Navbar from '../components/Navbar.jsx';

const emptyForm = { title: '', description: '', genre: '', release_year: '' };

export default function AdminDashboard({ onLogout }) {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [video, setVideo] = useState(null);
  const [cover, setCover] = useState(null);
  const [coverBusy, setCoverBusy] = useState(null); // id of the movie whose cover is being changed
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState(null); // { id, title, saving }
  const busy = Boolean(status);
  const processing = status === 'Processing video…';

  // Mux converts the video after the upload; there is no byte progress for that
  // step, so show a running clock instead of a bar that looks stuck at 0%.
  useEffect(() => {
    if (!processing) return undefined;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [processing]);

  async function loadMovies() {
    const data = await api.listMovies({ limit: 50 });
    setMovies(data.movies);
  }
  useEffect(() => { loadMovies().catch(err => setError(err.message)); }, []);

  useEffect(() => {
    if (!busy) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setError(''); setNotice('');
    if (!video) {
      setError('Choose a video file.');
      return;
    }

    let uploadId = null;
    try {
      setProgress(0);
      const uploadedId = await api.uploadVideo(video, {
        onProgress: setProgress,
        onUploadId: (id) => { uploadId = id; },
        onStatus: (step) => {
          setStatus(step === 'uploading' ? 'Uploading video…' : 'Processing video…');
          setProgress(0);
        }
      });
      setStatus('Publishing…');
      const created = await api.createMovie({
        title: form.title,
        description: form.description,
        genre: form.genre.trim() || null,
        release_year: form.release_year === '' ? null : Number(form.release_year),
        upload_id: uploadedId
      });
      uploadId = null; // published: from here on a failure must not discard the video
      let coverProblem = '';
      if (cover) {
        try {
          await api.setCover(created.movie.id, await prepareCover(cover));
        } catch (err) {
          coverProblem = err.message;
        }
      }
      setForm(emptyForm);
      setVideo(null);
      setCover(null);
      formEl.reset();
      await loadMovies();
      if (coverProblem) setError(`The movie is published, but its cover was not saved: ${coverProblem} Use "Change cover" on the movie below.`);
      else setNotice('Movie uploaded and published successfully.');
    } catch (err) {
      setError(err.message);
      // Best effort: don't leave an orphaned video using Mux storage.
      if (uploadId) api.discardUpload(uploadId).catch(() => {});
    } finally {
      setStatus(''); setProgress(0);
    }
  }

  function replaceMovie(updated) {
    setMovies(current => current.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
  }

  async function changeCover(movie, file) {
    if (!file) return;
    setError(''); setNotice(''); setCoverBusy(movie.id);
    try {
      const data = await api.setCover(movie.id, await prepareCover(file));
      replaceMovie(data.movie);
      setNotice(`Cover updated for "${movie.title}".`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCoverBusy(null);
    }
  }

  async function removeCover(movie) {
    setError(''); setNotice(''); setCoverBusy(movie.id);
    try {
      const data = await api.removeCover(movie.id);
      replaceMovie(data.movie);
      setNotice(`Cover removed from "${movie.title}". The site now shows a frame from the video.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCoverBusy(null);
    }
  }

  async function remove(movie) {
    if (!window.confirm(`Delete "${movie.title}" and its video on Mux?`)) return;
    setError(''); setNotice('');
    try {
      await api.deleteMovie(movie.id);
      setMovies(current => current.filter(item => item.id !== movie.id));
      setNotice(`Deleted "${movie.title}".`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveTitle(event) {
    event.preventDefault();
    const title = editing.title.trim();
    const movie = movies.find(item => item.id === editing.id);
    if (!title || title === movie.title) { setEditing(null); return; }
    setError(''); setNotice('');
    setEditing({ ...editing, saving: true });
    try {
      const data = await api.updateMovie(editing.id, { title });
      setMovies(current => current.map(item => (item.id === editing.id ? { ...item, title: data.movie.title } : item)));
      setNotice(`Renamed to "${data.movie.title}".`);
      setEditing(null);
    } catch (err) {
      setError(err.message);
      setEditing({ ...editing, saving: false });
    }
  }

  return (
    <div className="app-shell">
      <Navbar admin onLogout={onLogout} />
      <main className="section-wrap dashboard-page">
        <div className="dashboard-title">
          <div><p className="eyebrow">CONTROL ROOM</p><h1>Movie <span>dashboard.</span></h1><p className="muted">Add a title to publish it on the public website.</p></div>
          <Link className="button button-quiet" to="/">View website ↗</Link>
        </div>

        <div className="dashboard-grid">
          <form className="admin-form upload-form" onSubmit={submit}>
            <h2>Upload a movie</h2>
            <fieldset disabled={busy}>
              <label>Movie title *<input maxLength="200" value={form.title} onChange={e => update('title', e.target.value)} required /></label>
              <label>Description<textarea maxLength="5000" rows="4" value={form.description} onChange={e => update('description', e.target.value)} /></label>
              <div className="form-row">
                <label>Genre<input maxLength="80" value={form.genre} onChange={e => update('genre', e.target.value)} placeholder="Drama, Action…" /></label>
                <label>Release year<input type="number" min="1888" max="2100" value={form.release_year} onChange={e => update('release_year', e.target.value)} placeholder="2026" /></label>
              </div>
              <label>Movie video *<input type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] || null)} required /></label>

              <p className="field-hint">MP4, MOV, MKV or WebM. The upload goes straight to Mux, which converts it for streaming.</p>
              <label>Cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
              <p className="field-hint">Optional. A wide (16:9) JPEG, PNG or WebP picture works best, since cards are widescreen. It is shrunk automatically. Without one, the site uses a frame from the video.</p>
            </fieldset>
            {error && <p className="form-error">{error}</p>}
            {notice && <p className="form-success">{notice}</p>}
            {busy && (
              <div className="upload-progress" role="status">
                <div className="upload-progress-label">
                  <span>{status}</span>
                  {processing
                    ? <span>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
                    : progress > 0 && <span>{Math.round(progress * 100)}%</span>}
                </div>
                <div className="upload-progress-track">
                  {processing
                    ? <div className="indeterminate" />
                    : <div style={{ width: `${Math.round(progress * 100)}%` }} />}
                </div>
                {processing && (
                  <p className="upload-progress-hint">Upload finished. Mux is now converting the video for streaming. A full-length movie can take several minutes, so keep this tab open. It will publish automatically.</p>
                )}
              </div>
            )}
            <button className="button button-primary full-width" disabled={busy}>{busy ? status : 'Upload & publish movie'}</button>
          </form>

          <section className="manage-panel">
            <div className="manage-heading"><h2>Published movies</h2><span className="count-pill">{movies.length}</span></div>
            {movies.length === 0 ? <p className="muted">No movies published yet.</p> :
              <div className="manage-list">{movies.map(movie => (
                <div className="manage-item" key={movie.id}>
                  <img src={coverUrl(movie, 160)} alt="" />
                  {editing?.id === movie.id ? (
                    <form className="rename-form" onSubmit={saveTitle}>
                      <input
                        autoFocus
                        maxLength="200"
                        value={editing.title}
                        onChange={e => setEditing({ ...editing, title: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }}
                        aria-label="Movie title"
                        disabled={editing.saving}
                        required
                      />
                      <button className="button button-primary button-small" disabled={editing.saving}>{editing.saving ? 'Saving…' : 'Save'}</button>
                      <button type="button" className="button button-quiet button-small" onClick={() => setEditing(null)} disabled={editing.saving}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div className="manage-item-info">
                        <strong>{movie.title}</strong>
                        <span className="manage-links">
                          <Link to={`/movie/${movie.id}`}>Preview movie ↗</Link>
                          <button type="button" className="link-button" onClick={() => setEditing({ id: movie.id, title: movie.title })}>Rename</button>
                          <label className={`link-button${coverBusy === movie.id ? ' disabled' : ''}`}>
                            {coverBusy === movie.id ? 'Saving…' : 'Change cover'}
                            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={coverBusy === movie.id}
                              onChange={e => { changeCover(movie, e.target.files?.[0]); e.target.value = ''; }} />
                          </label>
                          {movie.has_cover && (
                            <button type="button" className="link-button" disabled={coverBusy === movie.id} onClick={() => removeCover(movie)}>Remove cover</button>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  <button className="delete-button" onClick={() => remove(movie)} aria-label={`Delete ${movie.title}`} title="Delete movie">×</button>
                </div>
              ))}</div>
            }
          </section>
        </div>
      </main>
    </div>
  );
}
