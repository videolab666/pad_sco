-- Competition Phase (plan-4 §10-12, §31-33, §58 Phase 3):
-- Americano/Mexicano + OpenSkill рейтинг.

-- ─── Рейтинги (§31-33) ─────────────────────────────────────────────────────

-- Лог каждого применения рейтинга (event-sourced, §22)
CREATE TABLE IF NOT EXISTS rating_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  -- mu/sigma до и после (OpenSkill: Weng-Lin Bayesian)
  mu_before DOUBLE PRECISION NOT NULL,
  sigma_before DOUBLE PRECISION NOT NULL,
  mu_after DOUBLE PRECISION NOT NULL,
  sigma_after DOUBLE PRECISION NOT NULL,
  -- Рейтинг для Americano vs обычных матчей (§123: Format Rating)
  rating_type TEXT NOT NULL DEFAULT 'club'
    CHECK (rating_type IN ('club','americano','league','global')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rating_events_player_idx ON rating_events (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rating_events_club_idx ON rating_events (club_id, rating_type);

-- Проекция: текущий рейтинг игрока (кэш для leaderboard, §33)
CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating_type TEXT NOT NULL DEFAULT 'club',
  mu DOUBLE PRECISION NOT NULL DEFAULT 25.0,
  sigma DOUBLE PRECISION NOT NULL DEFAULT 8.333,
  -- Консервативная оценка рейтинга = mu - 3*sigma (§64: rating confidence)
  conservative_rating DOUBLE PRECISION NOT NULL GENERATED ALWAYS AS (mu - 3.0 * sigma) STORED,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  last_match_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, player_id, rating_type)
);

CREATE INDEX IF NOT EXISTS player_ratings_leaderboard_idx
  ON player_ratings (club_id, rating_type, conservative_rating DESC);

-- ─── Americano / Mexicano (§10-12) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS americano_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Americano',
  -- americano | mexicano (§10-11)
  format TEXT NOT NULL DEFAULT 'americano'
    CHECK (format IN ('americano','mexicano')),
  -- creating | active | completed | cancelled
  status TEXT NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating','active','completed','cancelled')),
  -- Количество игроков (8/12/16 для Whist; любое для mexicano)
  player_count INT NOT NULL,
  -- Количество кортов (player_count / 4)
  court_count INT NOT NULL DEFAULT 2,
  -- Очков за победу в раунде
  points_per_round INT NOT NULL DEFAULT 16,
  -- Количество раундов (для Americano = player_count - 1; mexicano — гибко)
  total_rounds INT NOT NULL,
  current_round INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS americano_events_club_idx
  ON americano_events (club_id, status, created_at DESC);

-- Участники Americano (§10)
CREATE TABLE IF NOT EXISTS americano_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES americano_events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- Позиция в расписании (0..N-1) — назначается при старте
  seat INT,
  -- Текущий счёт в турнире
  total_points INT NOT NULL DEFAULT 0,
  games_played INT NOT NULL DEFAULT 0,
  games_won INT NOT NULL DEFAULT 0,
  games_lost INT NOT NULL DEFAULT 0,
  -- Для tie-breaking (§10: очки → победы → разница)
  points_diff INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS americano_participants_event_idx
  ON americano_participants (event_id, total_points DESC);

-- Раунды (§10: система создаёт пары, назначает соперников и корты)
CREATE TABLE IF NOT EXISTS americano_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES americano_events(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  -- pending → playing → completed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','playing','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, round_number)
);

-- Матчи внутри раунда (по одному на корт)
CREATE TABLE IF NOT EXISTS americano_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES americano_rounds(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES americano_events(id) ON DELETE CASCADE,
  court_number INT NOT NULL,
  -- Пары по позициям (seat) участников
  team_a_seats INT[] NOT NULL,
  team_b_seats INT[] NOT NULL,
  -- Результат
  score_a INT,
  score_b INT,
  winner TEXT CHECK (winner IN ('A','B','draw') OR winner IS NULL),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS americano_matches_round_idx
  ON americano_matches (round_id);
CREATE INDEX IF NOT EXISTS americano_matches_event_idx
  ON americano_matches (event_id);

-- RLS: только service role (управление через API платформы)
ALTER TABLE rating_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE americano_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE americano_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE americano_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE americano_matches ENABLE ROW LEVEL SECURITY;
