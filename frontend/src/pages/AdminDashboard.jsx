import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { posterUrl } from '../media.js';
import Navbar from '../components/Navbar.jsx';

const emptyForm = { title: '', description: '', genre: '', release_year: '' };

export default function AdminDashboard({ onLogout }) {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [video, setVideo] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [elapsed, setElapsed] = useState(0);
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
      await api.createMovie({
        title: form.title,
        description: form.description,
        genre: form.genre.trim() || null,
        release_year: form.release_year === '' ? null : Number(form.release_year),
        upload_id: uploadedId
      });
      setForm(emptyForm);
      setVideo(null);
      formEl.reset();
      await loadMovies();
      setNotice('Movie uploaded and published successfully.');
    } catch (err) {
      setError(err.message);
      // Best effort: don't leave an orphaned video using Mux storage.
      if (uploadId) api.discardUpload(uploadId).catch(() => {});
    } finally {
      setStatus(''); setProgress(0);
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
              <p className="field-hint">MP4, MOV, MKV or WebM. The upload goes straight to Mux, which converts it for streaming and picks the poster from the video.</p>
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
                  <img src={posterUrl(movie.mux_playback_id, 120)} alt="" />
                  <div className="manage-item-info"><strong>{movie.title}</strong><Link to={`/movie/${movie.id}`}>Preview movie ↗</Link></div>
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
