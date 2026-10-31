-- Only add metadata fields. Never store audio/video bytes or unreviewed player options.
BEGIN;
ALTER TABLE cinema_playback_sources ADD COLUMN IF NOT EXISTS translation_name TEXT NOT NULL DEFAULT 'Оригинальная дорожка';
ALTER TABLE cinema_playback_sources ADD COLUMN IF NOT EXISTS quality_label TEXT NOT NULL DEFAULT '';
ALTER TABLE cinema_playback_sources ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS cinema_sources_select_idx ON cinema_playback_sources(movie_id,active,priority DESC,id);
COMMIT;
