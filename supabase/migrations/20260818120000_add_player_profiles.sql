-- Player PWA (plan-4 §44, §84): личный кабинет игрока.
-- Публичный профиль + приватность + статистика + достижения.

-- Публичный профиль игрока (§84: privacy/consent)
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  -- §84: consent flags
  public_name BOOLEAN NOT NULL DEFAULT true,
  public_rating BOOLEAN NOT NULL DEFAULT true,
  public_history BOOLEAN NOT NULL DEFAULT true,
  public_photo BOOLEAN NOT NULL DEFAULT false,
  -- Соц-ссылки
  bio TEXT,
  avatar_url TEXT,
  preferred_side TEXT CHECK (preferred_side IN ('left','right','both') OR preferred_side IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, club_id)
);

CREATE INDEX IF NOT EXISTS player_profiles_player_idx ON player_profiles (player_id);

-- Достижения (§34)
CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  -- Тип достижения
  achievement_type TEXT NOT NULL,
  -- win_streak_3, win_streak_5, matches_10, matches_50, matches_100,
  -- tournament_winner, americano_champion, tiebreak_master, club_veteran
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji или lucide icon name
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, club_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS player_achievements_player_idx
  ON player_achievements (player_id, earned_at DESC);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

-- Публичное чтение профилей (для live-страниц и PWA)
CREATE POLICY "profiles public read" ON player_profiles FOR SELECT USING (true);
CREATE POLICY "achievements public read" ON player_achievements FOR SELECT USING (true);
