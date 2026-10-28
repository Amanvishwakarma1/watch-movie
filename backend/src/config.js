import 'dotenv/config';

const required = [
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
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
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  jwtSecret: process.env.JWT_SECRET,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  // Cloudinary free plan caps: 100 MB per video, 10 MB per image.
  maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES || 100 * 1024 * 1024),
  maxPosterBytes: Number(process.env.MAX_POSTER_BYTES || 10 * 1024 * 1024)
};
