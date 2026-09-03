-- Player Auth: связка auth-юзеров Supabase с профилями игроков
-- (plan 2026-09-02 player-auth-video-cabinet, Task 2).
--
-- players.user_id → auth.users: nullable (локальные игроки без входа живут
-- как раньше), уникальный частичный индекс — один профиль на аккаунт.
-- email/avatar_url — снимок из OAuth-метаданных (для кабинета и поиска
-- своих записей в будущем). Гостей не трогаем: QR-флоу корта без логина.

ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS players_user_id_uniq ON players (user_id) WHERE user_id IS NOT NULL;
