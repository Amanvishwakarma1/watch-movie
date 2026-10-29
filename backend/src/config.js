import 'dotenv/config';

const required = [
  'DATABASE_URL',
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD'
];

const isPlaceholder = (value) => /replace_with|^your_|USER:PASSWORD@/.test(value);

const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
const unfilled = required.filter(key => isPlaceholder(process.env[key]));
if (unfilled.length) {
  throw new Error(`Replace the placeholder values in backend/.env (or Render env vars): ${unfilled.join(', ')}`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}
if (process.env.ADMIN_PASSWORD.length < 10) {
  throw new Error('ADMIN_PASSWORD must be at least 10 characters long.');
}

export const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Comma-separated list, e.g. "https://movies.onrender.com,http://localhost:5173"
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL,
  mux: {
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET
  },
  jwtSecret: process.env.JWT_SECRET,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  // Mux has no per-file cap of its own; this is just a sanity limit in the dashboard.
  maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES || 5 * 1024 * 1024 * 1024)
};
