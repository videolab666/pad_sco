-- Media playlist (ads) on the scoreboard: library items, playlists with a
-- "virtual duplicate" bumper, per-court playback state and club-wide settings.
-- Files live in the "media" storage bucket (public read; writes go through
-- presigned upload URLs minted by the server with the service-role key).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  storage_path TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER,
  width INTEGER,
  height INTEGER,
  -- Reserved: optional background photo for vertical videos on horizontal
  -- screens (blurred behind the contained video). UI lands in a later phase.
  bg_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  -- "virtual duplicate": club bumper inserted between ad items.
  -- { "afterEveryN": int|null, "minIntervalSec": int|null, "bumperItemId": uuid|null }
  bumper JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_playlist_items (
  playlist_id UUID NOT NULL REFERENCES media_playlists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER,
  PRIMARY KEY (playlist_id, item_id)
);

CREATE INDEX IF NOT EXISTS media_playlist_items_order_idx
  ON media_playlist_items (playlist_id, position);

CREATE TABLE IF NOT EXISTS media_state (
  court_number INTEGER PRIMARY KEY,
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  -- 'manual' | 'remote' | 'idle' | 'completed' | 'no-match'
  trigger_source TEXT,
  forced_until TIMESTAMPTZ,
  playlist_id UUID REFERENCES media_playlists(id) ON DELETE SET NULL,
  last_stopped_at TIMESTAMPTZ,
  last_match_seen_at TIMESTAMPTZ,
  last_match_id UUID,
  -- Match id whose completion already triggered an ad session (one per match).
  last_completed_shown_for UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defaults: 2 GiB storage quota + default ad triggers (mirror of
-- DEFAULT_MEDIA_TRIGGERS in lib/media-core.ts; the /settings UI edits this row).
INSERT INTO club_settings (key, value) VALUES (
  'media',
  '{
    "storageLimitBytes": 2147483648,
    "triggers": {
      "afterCompletedMin": 10,
      "noScoreMin": 15,
      "noMatchMin": 0,
      "manualOnly": false,
      "stopOnAnyScore": true,
      "stopOnNewMatch": true,
      "maxSessionMin": 0,
      "loopsLimit": 0,
      "cooldownAfterStopMin": 10,
      "perCourt": {}
    }
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Public-read media bucket (scoreboard screens play files via public URLs).
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Realtime: scoreboards follow media_state, the admin UI follows the rest.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['media_state', 'media_items', 'media_playlists', 'media_playlist_items']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
