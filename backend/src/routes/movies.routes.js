import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';

const router = Router();

const publicColumns = `id, title, description, genre, release_year,
  mux_playback_id, created_at, updated_at`;

router.get('/', async (req, res, next) => {
  try {
    const parsed = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      search: z.string().trim().max(100).default('')
    }).safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination or search parameters.' });

    const { page, limit, search } = parsed.data;
    const offset = (page - 1) * limit;
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const [items, count] = await Promise.all([
      pool.query(
        `SELECT ${publicColumns} FROM movies
         WHERE mux_playback_id IS NOT NULL AND (title ILIKE $1 ESCAPE '\\' OR genre ILIKE $1 ESCAPE '\\')
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM movies
         WHERE mux_playback_id IS NOT NULL AND (title ILIKE $1 ESCAPE '\\' OR genre ILIKE $1 ESCAPE '\\')`,
        [pattern]
      )
    ]);
    res.json({
      movies: items.rows,
      pagination: { page, limit, total: count.rows[0].total }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: 'Movie not found.' });
    const result = await pool.query(
      `SELECT ${publicColumns} FROM movies WHERE id = $1 AND mux_playback_id IS NOT NULL`,
      [id.data]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.json({ movie: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
