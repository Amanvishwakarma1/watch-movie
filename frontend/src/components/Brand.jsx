import { Link } from 'react-router-dom';

export const SITE_NAME = 'Movie Max';
export const SITE_TITLE = `${SITE_NAME} — Movie Streaming`;

export default function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">M</span>
      <span>Movie <span className="brand-light">Max</span></span>
    </Link>
  );
}
