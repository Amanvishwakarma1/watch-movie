import { pool } from '../src/db/pool.js';
import { bootstrapDatabase } from '../src/db/bootstrap.js';

try {
  await bootstrapDatabase();
  console.log('Database schema and admin account are up to date.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
