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
  poster_url TEXT NOT NULL,
  poster_public_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_public_id TEXT NOT NULL,
  video_format VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies (title);
