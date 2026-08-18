-- §143-144: вертикальные (9:16) клипы и highlight-reel.
-- variant: wide (16:9, stream copy) | vertical (9:16, crop + re-encode).
-- Reel — автосборка топ-N маркеров по важности (§140) в один ролик.

ALTER TABLE clip_requests ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'wide'
  CHECK (variant IN ('wide','vertical'));

CREATE TABLE IF NOT EXISTS highlight_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  -- pending → processing → ready | failed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','ready','failed')),
  top_n INT NOT NULL DEFAULT 5,
  file_name TEXT,
  thumb_name TEXT,
  duration_ms BIGINT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS highlight_reels_status_idx ON highlight_reels (status);
CREATE INDEX IF NOT EXISTS highlight_reels_recording_idx ON highlight_reels (recording_session_id);

ALTER TABLE highlight_reels ENABLE ROW LEVEL SECURITY;
