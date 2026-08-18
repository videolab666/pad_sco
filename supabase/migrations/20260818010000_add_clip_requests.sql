-- Clip pipeline (plan-4 §141): маркер → clip_request → FFmpeg-воркер → mp4.
-- Воркер ходит с X-API-Key (машина), публичный доступ — только к готовым
-- файлам через /api/v1/video/clips/{id}/file (по id, не по пути).

CREATE TABLE IF NOT EXISTS clip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id UUID NOT NULL REFERENCES video_markers(id) ON DELETE CASCADE,
  recording_session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  -- pending → processing → ready | failed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','ready','failed')),
  in_ms BIGINT NOT NULL,
  out_ms BIGINT NOT NULL,
  -- Имя файла внутри каталога клипов (без пути — сбор маршрутом, не клиентом)
  file_name TEXT,
  thumb_name TEXT,
  duration_ms BIGINT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clip_requests_status_idx ON clip_requests (status);
CREATE INDEX IF NOT EXISTS clip_requests_recording_idx ON clip_requests (recording_session_id);

ALTER TABLE clip_requests ENABLE ROW LEVEL SECURITY;
