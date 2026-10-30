import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin, signAdminToken } from '../middleware/auth.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

// Two kinds of admin: the owner's account built from ADMIN_USERNAME / ADMIN_PASSWORD,
// and viewer accounts the owner flagged is_admin in the database. Viewer usernames
// are stored lowercase.
async function findAdmin(username, password) {
  const owner = (await pool.query(
    'SELECT id, username, password_hash FROM admins WHERE username = $1',
    [username]
  )).rows[0];
  if (owner && await bcrypt.compare(password, owner.password_hash)) return owner;

  const viewer = (await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1 AND is_admin',
    [username.toLowerCase()]
  )).rows[0];
  if (viewer && await bcrypt.compare(password, viewer.password_hash)) return viewer;
  return null;
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({
      username: z.string().trim().min(1).max(100),
      password: z.string().min(1).max(200)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter username and password.' });

    const admin = await findAdmin(parsed.data.username, parsed.data.password);
    if (!admin) return res.status(401).json({ error: 'Invalid username or password.' });

    res.json({ admin: { username: admin.username }, token: signAdminToken(admin) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { username: req.admin.username } });
});

export default router;
