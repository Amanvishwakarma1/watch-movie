import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { deleteAsset, getAsset, isOwnPublicId, signUpload, uploadKinds } from '../services/cloudinary.js';

const router = Router();
router.use(requireAdmin);

const uploadKind = z.enum(['poster', 'video']);

const movieFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  genre: z.string().trim().max(80).nullable().optional(),
  release_year: z.number().int().min(1888).max(2100).nullable().optional(),
  poster_public_id: z.string().refine(id => isOwnPublicId(id, 'poster'), 'Invalid poster upload.'),
  video_public_id: z.string().refine(id => isOwnPublicId(id, 'video'), 'Invalid video upload.')
});

// Step 1: the dashboard asks for a signed upload, then sends the file directly to Cloudinary.
router.post('/uploads/signature', (req, res) => {
  const kind = uploadKind.safeParse(req.body?.kind);
  if (!kind.success) return res.status(400).json({ error: 'Upload kind must be "poster" or "video".' });
  res.json(signUpload(kind.data));
});

// Discards an upload that never became a movie (e.g. the admin cancelled or a later step failed).
router.delete('/uploads', async (req, res, next) => {
  try {
    const kind = uploadKind.safeParse(req.body?.kind);
    if (!kind.success || !isOwnPublicId(req.body?.public_id, kind.data)) {
      return res.status(400).json({ error: 'Invalid upload reference.' });
    }
    const column = kind.data === 'video' ? 'video_public_id' : 'poster_public_id';
    const used = await pool.query(`SELECT 1 FROM movies WHERE ${column} = $1`, [req.body.public_id]);
    if (used.rowCount) return res.status(409).json({ error: 'That file belongs to a published movie.' });

    await deleteAsset(req.body.public_id, uploadKinds[kind.data].resourceType);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Step 2: once both files are on Cloudinary, store the movie record in Neon.
router.post('/movies', async (req, res, next) => {
  try {
    const parsed = movieFields.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid movie details.' });
    const data = parsed.data;

    const [poster, video] = await Promise.all([
      getAsset(data.poster_public_id, 'image'),
      getAsset(data.video_public_id, 'video')
    ]);
    if (!poster || !video) return res.status(400).json({ error: 'Uploaded media was not found on Cloudinary. Please upload again.' });

    const result = await pool.query(
      `INSERT INTO movies
       (title, description, genre, release_year, poster_url, poster_public_id,
        video_url, video_public_id, video_format)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, title, description, genre, release_year, poster_url, video_url, video_format, created_at`,
      [
        data.title,
        data.description,
        data.genre || null,
        data.release_year ?? null,
        poster.secure_url,
        poster.public_id,
        video.secure_url,
        video.public_id,
        video.format || null
      ]
    );
    res.status(201).json({ movie: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/movies/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    const fields = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      genre: z.string().trim().max(80).nullable().optional(),
      release_year: z.number().int().min(1888).max(2100).nullable().optional()
    }).strict().safeParse(req.body);

    if (!id.success) return res.status(404).json({ error: 'Movie not found.' });
    if (!fields.success || Object.keys(fields.data).length === 0) {
      return res.status(400).json({ error: 'Provide valid movie fields to update.' });
    }

    const values = [];
    const sets = [];
    for (const [column, value] of Object.entries(fields.data)) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
    values.push(id.data);
    const result = await pool.query(
      `UPDATE movies SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length}
       RETURNING id, title, description, genre, release_year, poster_url, video_url, video_format, updated_at`,
      values
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.json({ movie: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/movies/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: 'Movie not found.' });
    const result = await pool.query(
      `DELETE FROM movies WHERE id = $1
       RETURNING poster_public_id, video_public_id`,
      [id.data]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });

    await Promise.all([
      deleteAsset(result.rows[0].poster_public_id, 'image'),
      deleteAsset(result.rows[0].video_public_id, 'video')
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
