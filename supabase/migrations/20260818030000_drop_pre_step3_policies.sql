-- Шаг 3 slice C (plan-4 §99/§248): СНИМАЕМ pre-step3 write-политики на matches.
--
-- Все писатели теперь идут через командный конвейер:
--   UI-клик → команда point/adjust-game/... (Origin-auth)
--   Физическая кнопка → команда (X-API-Key)
--   Внешний API → команда (X-API-Key)
--   Создание матча → POST /api/matches/create (Origin/X-API-Key)
--
-- После этой миграции прямой anon-INSERT/UPDATE/DELETE на matches невозможен —
-- DoD Шага 1 «игрок не может изменить матч прямым запросом» закрыт полностью.
--
-- Players остаются с открытыми write-политиками (клиент пишет напрямую —
-- lib/player-storage.ts); закрывается в Шаге 5 вместе с players-командами.

DROP POLICY IF EXISTS "matches insert pre-step3" ON matches;
DROP POLICY IF EXISTS "matches update pre-step3" ON matches;
DROP POLICY IF EXISTS "matches delete pre-step3" ON matches;

-- Чтение остаётся публичным (табло, scorebug, vMix, live-страницы)
