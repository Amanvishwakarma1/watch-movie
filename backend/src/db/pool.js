import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Accepts the connection string exactly as Neon's "Connect" dialog gives it:
//   postgresql://user:pass@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
// node-postgres ignores `channel_binding` in the URL and warns about `sslmode=require`
// (which it already treats as verify-full), so both are translated into pool options here.
export function connectionOptions(databaseUrl) {
  const url = new URL(databaseUrl);
  const isNeon = url.hostname.endsWith('.neon.tech');
  const channelBinding = url.searchParams.get('channel_binding');
  url.searchParams.delete('channel_binding');

  const sslmode = url.searchParams.get('sslmode');
  if (['require', 'prefer', 'verify-ca'].includes(sslmode) || (isNeon && !sslmode)) {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return {
    connectionString: url.toString(),
    // Uses SCRAM-SHA-256-PLUS when the server offers it (Neon does).
    enableChannelBinding: isNeon || channelBinding === 'require' || channelBinding === 'prefer',
    isNeon,
    isPooled: url.hostname.includes('-pooler.')
  };
}

const { isNeon, isPooled, ...options } = connectionOptions(config.databaseUrl);
if (isNeon && !isPooled) {
  console.warn('DATABASE_URL uses a direct Neon host. Prefer the pooled one (host contains "-pooler").');
}

export const pool = new Pool({
  ...options,
  max: 5,
  // Release idle connections quickly so Neon's free compute can scale to zero.
  idleTimeoutMillis: 30000,
  // A suspended Neon compute takes a moment to wake on the first connection.
  connectionTimeoutMillis: 15000
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});
