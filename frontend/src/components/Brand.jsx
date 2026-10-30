import { Link } from 'react-router-dom';

export const SITE_NAME = 'Movie Max';
export const SITE_TITLE = `${SITE_NAME} — Movie Streaming`;

// The Movie Max logo (public/logo.webp, transparent background).
export function Logo({ className = 'brand-logo' }) {
  return <img className={className} src="/logo.webp" alt={SITE_NAME} width="960" height="224" decoding="async" />;
}

export default function Brand() {
  return (
    <Link className="brand" to="/">
      <Logo />
    </Link>
  );
}
