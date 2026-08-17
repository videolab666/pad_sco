-- Шаг 1 slice B (plan-4 §50, §118, §248): staff-auth + RLS.
--
-- Модель: Supabase Auth user → club_memberships (роль) → доступ к API
-- клуба через серверный слой (service role). Публичный anon-ключ остаётся
-- только для чтения табло.
--
-- ⚠️ ДОЛГ ШАГА 3: матчи и игроки сейчас пишутся клиентом НАПРЯМУЮ с anon
-- ключа (lib/match-sync.ts, lib/player-storage.ts). RLS включаем уже
-- сейчас, но write-политики временно открытые — после перевода записи на
-- серверный command-pipeline (Шаг 3, §99) политики снимаются одной
-- миграцией. Закрыть их сейчас = сломать синхронизацию всех табло.

-- ─── 1. Роли персонала ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  -- owner | manager | referee | coach | viewer
  role TEXT NOT NULL DEFAULT 'manager'
    CHECK (role IN ('owner','manager','referee','coach','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS club_memberships_user_idx ON club_memberships (user_id);
CREATE INDEX IF NOT EXISTS club_memberships_club_idx ON club_memberships (club_id);

ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;
-- Пользователь видит свои членства (UI-проверки); остальное — service role.
CREATE POLICY "members read own" ON club_memberships
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 2. matches: RLS включён, поведение сохранено ─────────────────────────

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches public read" ON matches
  FOR SELECT USING (true);

CREATE POLICY "matches insert pre-step3" ON matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "matches update pre-step3" ON matches
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "matches delete pre-step3" ON matches
  FOR DELETE USING (true);

-- ─── 3. players: аналогично (клиент пишет напрямую) ───────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players public read" ON players
  FOR SELECT USING (true);

CREATE POLICY "players insert pre-step3" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "players update pre-step3" ON players
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "players delete pre-step3" ON players
  FOR DELETE USING (true);

-- ─── 4. Полностью закрытые таблицы: только service role ───────────────────
-- match_operations — серверная идемпотентность/аудит (только API-роуты).
-- media_* / club_settings — рекламный контент (только API-роуты; публичный
-- доступ к файлам идёт через Storage URL, не через таблицы).

ALTER TABLE match_operations ENABLE ROW LEVEL SECURITY;

ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;

-- organizations/clubs/courts/court_slug_history/court_sessions/
-- session_participants уже закрыты (миграции 20260817*).
