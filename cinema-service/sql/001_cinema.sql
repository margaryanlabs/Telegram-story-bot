-- VETOGRAM CINEMA metadata database (PostgreSQL 14+).
-- Only metadata + playback references, never binary video.
BEGIN;
CREATE TABLE IF NOT EXISTS cinema_movies (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{2,90}$'),
  title_ru TEXT NOT NULL CHECK (length(title_ru) BETWEEN 1 AND 240),
  original_title TEXT NOT NULL DEFAULT '',
  release_year INTEGER CHECK (release_year BETWEEN 1880 AND 2200),
  synopsis TEXT NOT NULL DEFAULT '',
  poster_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  spoken_language TEXT NOT NULL DEFAULT 'ru',
  genres TEXT[] NOT NULL DEFAULT '{}',
  hue SMALLINT NOT NULL DEFAULT 210 CHECK (hue BETWEEN 0 AND 359),
  rights_holder TEXT NOT NULL,
  publishing_status TEXT NOT NULL DEFAULT 'review'
    CHECK (publishing_status IN ('review','published','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cinema_playback_sources (
  id BIGSERIAL PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES cinema_movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('iframe','hls','video')),
  playback_url TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  rights_basis TEXT NOT NULL CHECK (rights_basis IN ('official_embed','creative_commons','contract')),
  rights_evidence_url TEXT NOT NULL,
  attribution TEXT NOT NULL,
  spoken_language TEXT NOT NULL DEFAULT 'ru',
  territory_codes TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT false,
  rights_reviewed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(movie_id, provider, playback_url),
  CHECK (active = false OR rights_reviewed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS cinema_movies_published_idx
  ON cinema_movies (publishing_status, release_year DESC);
CREATE INDEX IF NOT EXISTS cinema_movies_search_idx
  ON cinema_movies USING GIN (to_tsvector('simple', coalesce(title_ru,'')||' '||coalesce(original_title,'')));
CREATE INDEX IF NOT EXISTS cinema_sources_active_idx
  ON cinema_playback_sources(movie_id, active, rights_reviewed_at DESC);
COMMIT;
