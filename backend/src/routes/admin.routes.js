import express, { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { config } from '../config.js';
import { createDirectUpload, deleteAsset, discardUpload, getUploadState } from '../services/mux.js';

const router = Router();
router.use(requireAdmin);

const movieFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  genre: z.string().trim().max(80).nullable().optional(),
  release_year: z.number().int().min(1888).max(2100).nullable().optional(),
  upload_id: z.string().min(1).max(200)
});

const movieColumns = `id, title, description, genre, release_year, mux_playback_id, created_at,
  (cover_image IS NOT NULL) AS has_cover, cover_updated_at`;

// Never trust the browser's Content-Type: check the file's own signature.
// SVG is deliberately not accepted (it can carry scripts).
function sniffImage(buffer) {
  if (buffer.length > 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const COVER_LIMIT = '3mb';

// Step 1: the dashboard asks for a Mux direct-upload URL, then PUTs the video straight to Mux.
router.post('/uploads', async (req, res, next) => {
  try {
    const origin = req.get('origin');
    const corsOrigin = config.frontendUrls.includes(origin) ? origin : config.frontendUrls[0];
    res.status(201).json(await createDirectUpload(corsOrigin));
  } catch (error) {
    next(error);
  }
});

// Step 2: Mux transcodes after the upload; the dashboard polls until the video is ready.
router.get('/uploads/:id', async (req, res, next) => {
  try {
    const state = await getUploadState(req.params.id);
    if (!state) return res.status(404).json({ error: 'Upload not found.' });
    res.json(state);
  } catch (error) {
    next(error);
  }
});

// Discards an upload that never became a movie (e.g. the admin cancelled or a later step failed).
router.delete('/uploads/:id', async (req, res, next) => {
  try {
    const state = await getUploadState(req.params.id);
    if (state?.assetId) {
      const used = await pool.query('SELECT 1 FROM movies WHERE mux_asset_id = $1', [state.assetId]);
      if (used.rowCount) return res.status(409).json({ error: 'That video belongs to a published movie.' });
    }
    await discardUpload(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Step 3: once Mux reports the video ready, store the movie record in Neon.
router.post('/movies', async (req, res, next) => {
  try {
    const parsed = movieFields.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid movie details.' });
    const data = parsed.data;

    const state = await getUploadState(data.upload_id);
    if (!state) return res.status(400).json({ error: 'Upload was not found on Mux. Please upload again.' });
    if (state.status !== 'ready') return res.status(409).json({ error: 'The video is still processing on Mux. Try again in a moment.' });

    const result = await pool.query(
      `INSERT INTO movies (title, description, genre, release_year, mux_asset_id, mux_playback_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING ${movieColumns}`,
      [data.title, data.description, data.genre || null, data.release_year ?? null, state.assetId, state.playbackId]
    );
    res.status(201).json({ movie: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That video is already published.' });
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
       RETURNING ${movieColumns}, updated_at`,
      values
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.json({ movie: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/movies/:id/cover',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: COVER_LIMIT }),
  async (req, res, next) => {
    try {
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) return res.status(404).json({ error: 'Movie not found.' });
      const type = Buffer.isBuffer(req.body) ? sniffImage(req.body) : null;
      if (!type) return res.status(400).json({ error: 'The cover must be a JPEG, PNG or WebP image.' });
      const result = await pool.query(
        `UPDATE movies SET cover_image = $1, cover_type = $2, cover_updated_at = NOW(), updated_at = NOW()
         WHERE id = $3 RETURNING ${movieColumns}`,
        [req.body, type, id.data]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
      res.json({ movie: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/movies/:id/cover', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: 'Movie not found.' });
    const result = await pool.query(
      `UPDATE movies SET cover_image = NULL, cover_type = NULL, cover_updated_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING ${movieColumns}`,
      [id.data]
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
       RETURNING mux_asset_id`,
      [id.data]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });

    await deleteAsset(result.rows[0].mux_asset_id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
