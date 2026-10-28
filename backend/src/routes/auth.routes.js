import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin, signAdminToken } from '../middleware/auth.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({
      username: z.string().trim().min(1).max(100),
      password: z.string().min(1).max(200)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter username and password.' });

    const result = await pool.query(
      'SELECT id, username, password_hash FROM admins WHERE username = $1',
      [parsed.data.username]
    );
    const admin = result.rows[0];
    if (!admin) return res.status(401).json({ error: 'Invalid username or password.' });
    const valid = await bcrypt.compare(parsed.data.password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

    res.json({ admin: { username: admin.username }, token: signAdminToken(admin) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { username: req.admin.username } });
});

export default router;
