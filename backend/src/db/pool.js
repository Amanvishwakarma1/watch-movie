import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;
// SSL comes from the connection string (Neon URLs include sslmode=require).
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  // Neon free-tier compute suspends when idle; the first connection can take a few seconds.
  connectionTimeoutMillis: 15000
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});
