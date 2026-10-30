import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Bearer tokens instead of cookies: on Render the frontend and API live on
// different *.onrender.com sites, and browsers block cross-site cookies.
export function signAdminToken(admin) {
  return jwt.sign(
    { role: 'admin', username: admin.username },
    config.jwtSecret,
    { subject: admin.id, issuer: 'movie-streaming', expiresIn: '8h' }
  );
}

export function signUserToken(user) {
  return jwt.sign(
    { role: 'user', username: user.username },
    config.jwtSecret,
    { subject: user.id, issuer: 'movie-streaming', expiresIn: '30d' }
  );
}

// Viewer accounts. The role claim keeps viewer and admin tokens from being
// interchangeable: requireAdmin rejects 'user' tokens and this rejects 'admin' ones.
export function requireUser(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Please sign in.' });

  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'movie-streaming' });
    if (payload.role !== 'user') return res.status(401).json({ error: 'Invalid session.' });
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Admin login required.' });

  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'movie-streaming' });
    if (payload.role !== 'admin') return res.status(401).json({ error: 'Invalid session.' });
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
