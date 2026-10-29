-- gen_random_uuid() is built into PostgreSQL 13+ (Neon runs 14-18), no extension needed.

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password hashes must never be readable through Neon's Data API roles
-- (anonymous / authenticated). With RLS on and no policies, only the table
-- owner (the role the API connects as) can see rows.
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  genre VARCHAR(80),
  release_year SMALLINT,
  mux_asset_id TEXT,
  mux_playback_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration from the Cloudinary version: media now lives on Mux (posters are
-- Mux thumbnails of the video). Safe to repeat; the old columns are dropped.
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mux_asset_id TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;
ALTER TABLE movies DROP COLUMN IF EXISTS poster_url;
ALTER TABLE movies DROP COLUMN IF EXISTS poster_public_id;
ALTER TABLE movies DROP COLUMN IF EXISTS video_url;
ALTER TABLE movies DROP COLUMN IF EXISTS video_public_id;
ALTER TABLE movies DROP COLUMN IF EXISTS video_format;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_mux_asset ON movies (mux_asset_id);
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies (title);
