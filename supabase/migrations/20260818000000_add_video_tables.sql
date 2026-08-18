-- Video Platform (plan-4 §129-137): реестр камер, сессии записи, маркеры.
--
-- Gateway (MediaMTX) — «глупый» транспорт; вся бизнес-логика (когда писать,
-- маркеры, клипы) — в платформе. RLS без политик: только service role
-- (управление — через API платформы), публичный доступ — HLS/VOD-ссылки,
-- которые выдаёт gateway, а не эти таблицы.

-- §130: VideoSource — аппаратно-независимый источник на корте
CREATE TABLE IF NOT EXISTS video_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  -- phone_agent | rpi_csi | action_cam | ip_camera | hdmi_encoder | custom
  source_type TEXT NOT NULL DEFAULT 'phone_agent',
  -- srt | rtsp | rtmp | webrtc | hls | usb | file
  protocol TEXT NOT NULL DEFAULT 'srt',
  -- Имя потока на gateway: court-3-main (streamid публикации)
  stream_key TEXT NOT NULL UNIQUE,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  health JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- offline | online | recording
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_sources_court_idx ON video_sources (court_id);
CREATE INDEX IF NOT EXISTS video_sources_club_idx ON video_sources (club_id);

-- §132: Recording Session — привязана к Court Session, не к матчу
-- (ротации/Americano/тренировки = много матчей в одной записи)
CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  court_session_id UUID REFERENCES court_sessions(id) ON DELETE SET NULL,
  source_id UUID REFERENCES video_sources(id) ON DELETE SET NULL,
  -- §133: idle|arming|recording|finalizing|uploading|ready|failed
  status TEXT NOT NULL DEFAULT 'recording',
  -- venue-gateway | cloud
  storage TEXT NOT NULL DEFAULT 'venue-gateway',
  -- путь/маска сегментов на gateway
  storage_key TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  -- resolution/fps/codec/bitrate/dropped_frames…
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recording_sessions_court_idx
  ON recording_sessions (court_id, started_at DESC);
CREATE INDEX IF NOT EXISTS recording_sessions_session_idx
  ON recording_sessions (court_session_id);
CREATE INDEX IF NOT EXISTS recording_sessions_status_idx
  ON recording_sessions (status);

-- §137: Video Marker — событие на временной шкале записи
CREATE TABLE IF NOT EXISTS video_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  event_id TEXT,
  -- MATCH_POINT | SET_WON | GOLDEN_POINT | MANUAL_HIGHLIGHT | CUSTOM…
  marker_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  -- §136: позиция в записи + confidence синхронизации
  video_position_ms BIGINT NOT NULL DEFAULT 0,
  importance INT NOT NULL DEFAULT 1,
  pre_roll_ms INT NOT NULL DEFAULT 20000,
  post_roll_ms INT NOT NULL DEFAULT 10000,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_markers_session_idx
  ON video_markers (recording_session_id, video_position_ms);
CREATE INDEX IF NOT EXISTS video_markers_match_idx ON video_markers (match_id);

ALTER TABLE video_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_markers ENABLE ROW LEVEL SECURITY;
