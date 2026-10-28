import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ admin = false, onLogout }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">N</span>
        <span>Night<span className="brand-light">Screen</span></span>
      </Link>
      <nav>
        <Link to="/">Discover</Link>
        {admin ? (
          <>
            <Link to="/admin">Dashboard</Link>
            <button className="button button-quiet button-small" onClick={() => {
              onLogout?.();
              navigate('/admin/login');
            }}>Sign out</button>
          </>
        ) : (
          <Link className="admin-link" to="/admin/login">Admin</Link>
        )}
      </nav>
    </header>
  );
}
