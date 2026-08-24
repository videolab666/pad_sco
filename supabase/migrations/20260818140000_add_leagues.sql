-- Leagues (plan-4 §81): сезоны, дивизионы, fixtures.

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- active | completed | upcoming
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','upcoming')),
  -- Сезон (§79)
  season TEXT, -- "Winter 2026"
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  -- Настройки продвижения/вылета (§81)
  promote_count INT NOT NULL DEFAULT 2,
  relegate_count INT NOT NULL DEFAULT 2,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Division A", "Division B"
  level INT NOT NULL DEFAULT 1, -- 1 = высшая
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- Текущая позиция в таблице
  position INT,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  sets_won INT NOT NULL DEFAULT 0,
  sets_lost INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (division_id, player_id)
);

CREATE TABLE IF NOT EXISTS league_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  round INT NOT NULL,
  player_a_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_b_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- pending | completed | cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','cancelled')),
  score_a TEXT, -- "6:4 3:6 10:7"
  score_b TEXT,
  winner UUID REFERENCES players(id),
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (division_id, round, player_a_id, player_b_id)
);

-- Round-robin генерация fixtures
CREATE INDEX IF NOT EXISTS league_fixtures_division_idx
  ON league_fixtures (division_id, round);
CREATE INDEX IF NOT EXISTS league_entries_division_idx
  ON league_entries (division_id, position);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_fixtures ENABLE ROW LEVEL SECURITY;
