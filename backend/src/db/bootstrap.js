import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { config } from '../config.js';

const schemaPath = new URL('../../sql/schema.sql', import.meta.url);

// Idempotent: safe to run on every boot. Render's free plan has no Shell,
// so the schema and the admin account are kept in sync from here.
export async function applySchema() {
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
}

export async function ensureAdmin() {
  const existing = await pool.query(
    'SELECT password_hash FROM admins WHERE username = $1',
    [config.adminUsername]
  );
  const current = existing.rows[0];
  if (current && await bcrypt.compare(config.adminPassword, current.password_hash)) return 'unchanged';

  const hash = await bcrypt.hash(config.adminPassword, 12);
  await pool.query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [config.adminUsername, hash]
  );
  return current ? 'updated' : 'created';
}

export async function bootstrapDatabase() {
  await applySchema();
  const status = await ensureAdmin();
  if (status !== 'unchanged') console.log(`Admin account '${config.adminUsername}' ${status}.`);
}
