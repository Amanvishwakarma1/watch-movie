import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireUser, signUserToken } from '../middleware/auth.js';

const router = Router();

// Only failed attempts count, so normal viewers are never locked out by their own logins.
const limiter = (limit) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
});

const credentials = z.object({
  username: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9_.-]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore.'),
  // bcrypt only reads the first 72 bytes, so a longer password would be silently cut.
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be at most 72 characters.')
});

// Compared against when the username does not exist, so a miss takes as long as a hit.
const dummyHash = bcrypt.hashSync('not-a-real-password', 10);

router.post('/signup', limiter(20), async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { username, password } = parsed.data;

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    const user = result.rows[0];
    res.status(201).json({ user: { username: user.username }, token: signUserToken(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    next(error);
  }
});

router.post('/login', limiter(10), async (req, res, next) => {
  try {
    const parsed = z.object({
      username: z.string().trim().toLowerCase().min(1).max(100),
      password: z.string().min(1).max(200)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter username and password.' });

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [parsed.data.username]
    );
    const user = result.rows[0];
    const valid = await bcrypt.compare(parsed.data.password, user ? user.password_hash : dummyHash);
    if (!user || !valid) return res.status(401).json({ error: 'Invalid username or password.' });

    res.json({ user: { username: user.username }, token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
});

// Forgot-password: no email or code, on purpose (the site owner's choice; accounts
// only hold watch history). Anyone who knows a username can set a new password,
// so every attempt counts toward the limit, not just failures.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
});

router.post('/reset-password', resetLimiter, async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { username, password } = parsed.data;

    // Accounts flagged is_admin can upload content, so this open reset must never
    // touch them: it would hand the dashboard to anyone who knows the username.
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 AND NOT is_admin RETURNING id, username',
      [hash, username]
    );
    if (!result.rowCount) {
      const locked = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (locked.rowCount) return res.status(403).json({ error: "This account's password can't be reset here. Ask the site owner." });
      return res.status(404).json({ error: 'No account with that username. Check the spelling, or create an account.' });
    }
    const user = result.rows[0];
    res.json({ user: { username: user.username }, token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireUser, async (req, res, next) => {
  try {
    // The account may have been removed since the token was issued.
    const result = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    if (!result.rowCount) return res.status(401).json({ error: 'Please sign in again.' });
    res.json({ user: { username: result.rows[0].username } });
  } catch (error) {
    next(error);
  }
});

// Most recently watched first.
router.get('/progress', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT movie_id, position_seconds, duration_seconds, updated_at
       FROM watch_progress WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ progress: result.rows });
  } catch (error) {
    next(error);
  }
});

const RESUME_MIN = 15;      // before this, there is nothing worth resuming
const FINISHED_WITHIN = 60; // within the last minute counts as finished (credits)

router.put('/progress/:movieId', requireUser, async (req, res, next) => {
  try {
    const movieId = z.string().uuid().safeParse(req.params.movieId);
    const body = z.object({
      position: z.number().min(0).max(172800),
      duration: z.number().min(0).max(172800)
    }).safeParse(req.body);
    if (!movieId.success) return res.status(404).json({ error: 'Movie not found.' });
    if (!body.success) return res.status(400).json({ error: 'Invalid progress.' });

    const position = Math.floor(body.data.position);
    const duration = Math.floor(body.data.duration);
    const finished = duration > 0 && position >= duration - FINISHED_WITHIN;
    if (position <= RESUME_MIN || finished) {
      await pool.query('DELETE FROM watch_progress WHERE user_id = $1 AND movie_id = $2', [req.user.id, movieId.data]);
      return res.json({ saved: false });
    }

    await pool.query(
      `INSERT INTO watch_progress (user_id, movie_id, position_seconds, duration_seconds, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET position_seconds = EXCLUDED.position_seconds,
                     duration_seconds = EXCLUDED.duration_seconds,
                     updated_at = NOW()`,
      [req.user.id, movieId.data, position, duration]
    );
    res.json({ saved: true });
  } catch (error) {
    if (error.code === '23503') {
      // Foreign key: either the movie or the account no longer exists.
      return error.constraint === 'watch_progress_user_id_fkey'
        ? res.status(401).json({ error: 'Please sign in again.' })
        : res.status(404).json({ error: 'Movie not found.' });
    }
    next(error);
  }
});

router.delete('/progress/:movieId', requireUser, async (req, res, next) => {
  try {
    const movieId = z.string().uuid().safeParse(req.params.movieId);
    if (!movieId.success) return res.status(404).json({ error: 'Movie not found.' });
    await pool.query('DELETE FROM watch_progress WHERE user_id = $1 AND movie_id = $2', [req.user.id, movieId.data]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
