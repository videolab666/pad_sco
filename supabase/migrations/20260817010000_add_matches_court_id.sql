-- Шаг 2 (plan-4 §246/§247): явная привязка матча к корту.
-- matches.court_id — каноническая ссылка; court_number остаётся для
-- legacy-кортов и обратной совместимости всех существующих URL.
--
-- Бэкфилл: существующие матчи с court_number получают court_id
-- соответствующего legacy-корта (клуб пока один — default).

ALTER TABLE matches ADD COLUMN IF NOT EXISTS court_id UUID;

CREATE INDEX IF NOT EXISTS matches_court_id_idx
  ON matches (court_id) WHERE court_id IS NOT NULL;

UPDATE matches m
SET court_id = c.id
FROM courts c
WHERE c.legacy_number IS NOT NULL
  AND m.court_number = c.legacy_number
  AND m.court_id IS NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_court_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_court_id_fkey
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE SET NULL;
