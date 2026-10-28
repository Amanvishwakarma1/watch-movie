import app from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { bootstrapDatabase } from './db/bootstrap.js';

try {
  await bootstrapDatabase();
} catch (error) {
  console.error('Database bootstrap failed:', error.message);
  await pool.end().catch(() => {});
  process.exit(1);
}

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Movie API listening on port ${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
