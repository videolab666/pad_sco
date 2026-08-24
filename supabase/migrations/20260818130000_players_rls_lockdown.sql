-- Техдолг (§248 Шаг 3): закрываем write-политики на players.
-- Все записи теперь идут через серверный слой (API платформы).
-- Чтение остаётся публичным (база игроков для выбора в матчах).

DROP POLICY IF EXISTS "players insert pre-step3" ON players;
DROP POLICY IF EXISTS "players update pre-step3" ON players;
DROP POLICY IF EXISTS "players delete pre-step3" ON players;
