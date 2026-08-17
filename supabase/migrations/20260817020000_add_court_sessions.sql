-- Шаг 2 (plan-4 §5-6): Court Session — главная сущность платформы.
--
-- Booking ≠ Session ≠ Match: сессия — контейнер на корте (0..N матчей,
-- участники с ролями/статусами, тренировки, open play, Americano и т.д.).
-- Существующие исторические матчи остаются без сессии (session_id NULL).
--
-- RLS без политик — доступ только через service role (server routes).

CREATE TABLE IF NOT EXISTS court_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  -- §5: match | training | open_play | group_session | americano |
  -- mexicano | king_of_court | tournament | custom
  type TEXT NOT NULL DEFAULT 'match',
  -- preparing → active → completed | cancelled
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('preparing','active','completed','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS court_sessions_court_idx
  ON court_sessions (court_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS court_sessions_status_idx ON court_sessions (status);

-- Участники сессии (§6): player из базы, гость по имени или тренер;
-- статус живёт отдельно от статуса в матче.
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES court_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  -- player | guest | coach
  role TEXT NOT NULL DEFAULT 'player'
    CHECK (role IN ('player','guest','coach')),
  -- expected | checked_in | playing | waiting | left
  status TEXT NOT NULL DEFAULT 'expected'
    CHECK (status IN ('expected','checked_in','playing','waiting','left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_participants_session_idx
  ON session_participants (session_id);

-- Матч принадлежит сессии (0..N матчей на сессию, §5).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS matches_session_id_idx
  ON matches (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_session_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES court_sessions(id) ON DELETE SET NULL;

ALTER TABLE court_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS court_sessions_touch_updated_at ON court_sessions;
CREATE TRIGGER court_sessions_touch_updated_at
  BEFORE UPDATE ON court_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
