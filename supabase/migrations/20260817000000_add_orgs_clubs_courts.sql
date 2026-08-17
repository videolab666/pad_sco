-- Шаг 1 (plan-4 §246/§247): Court становится сущностью.
-- organizations → clubs → courts; глобально уникальный короткий short_code
-- для вечных ссылок /c/{code}; legacy_number для обратной совместимости
-- с matches.court_number (1..10).
--
-- RLS: включён БЕЗ политик — таблицы доступны только service role
-- (server routes). Публичный доступ идёт через /api/v1/courts/{code}.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,          -- immutable: печатается в QR
  legacy_number INTEGER,                    -- существующие корты 1..10
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, slug)
);

-- Уникальность legacy-номера внутри клуба (NULL не конфликтует)
CREATE UNIQUE INDEX IF NOT EXISTS courts_club_legacy_number_idx
  ON courts (club_id, legacy_number) WHERE legacy_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS courts_short_code_idx ON courts (short_code);

CREATE TABLE IF NOT EXISTS court_slug_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id),
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS court_slug_history_court_idx ON court_slug_history (court_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_slug_history ENABLE ROW LEVEL SECURITY;

-- updated_at для courts
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courts_touch_updated_at ON courts;
CREATE TRIGGER courts_touch_updated_at
  BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
