import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { CloseIcon, SearchIcon, UploadIcon } from './Icons.jsx';
import { session } from '../api.js';
import { useViewer } from '../viewer.jsx';

// `overlay` floats the bar over the home billboard and turns it solid on scroll.
// Passing `onSearch` adds the search field.
export default function Navbar({ admin = false, onLogout, overlay = false, search = '', onSearch, hideAccount = false }) {
  const navigate = useNavigate();
  const viewer = useViewer();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  const classes = ['topbar', overlay && 'overlay', overlay && (scrolled || search) && 'solid'].filter(Boolean).join(' ');
  // Only the owner's accounts see this: an admin viewer, or anyone with a dashboard session.
  // The button is a convenience; the API still checks the token on every upload or edit.
  const canUpload = Boolean(viewer.user?.is_admin || session.get());

  return (
    <header className={classes}>
      <Brand />
      <nav>
        {onSearch && <SearchField value={search} onChange={onSearch} />}
        <Link className="nav-home" to="/">Home</Link>
        {admin ? (
          <>
            <Link to="/admin">Dashboard</Link>
            <button className="button button-quiet button-small" onClick={() => {
              onLogout?.();
              navigate('/admin/login');
            }}>Sign out</button>
          </>
        ) : !hideAccount && (
          <>
            {canUpload && (
              <Link className="nav-upload" to="/admin" title="Upload and edit movies" aria-label="Upload and edit movies">
                <UploadIcon /><span>Upload</span>
              </Link>
            )}
            {viewer.user ? (
              <>
                <span className="nav-user" title={`Signed in as ${viewer.user.username}`}>{viewer.user.username}</span>
                <button className="button button-quiet button-small" onClick={viewer.logout}>Sign out</button>
              </>
            ) : (
              <Link className="button button-small nav-signin" to="/login">Sign in</Link>
            )}
          </>
        )}
      </nav>
    </header>
  );
}

function SearchField({ value, onChange }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const open = focused || Boolean(value);

  return (
    <div className={`nav-search${open ? ' open' : ''}`}>
      <button type="button" className="nav-search-icon" aria-label="Search" tabIndex={open ? -1 : 0}
        onClick={() => inputRef.current?.focus()}>
        <SearchIcon />
      </button>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Escape') { onChange(''); e.currentTarget.blur(); } }}
        placeholder="Titles, genres"
        aria-label="Search movies"
      />
      {value && (
        <button type="button" className="nav-search-clear" aria-label="Clear search"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onChange(''); inputRef.current?.focus(); }}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
