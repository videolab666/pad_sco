-- Clubs metadata: тариф и настройки клуба (plan-4 §55, plan 2026-09-02).
--
-- v1 биллинга хранит план в clubs.metadata.plan (starter|club|pro) — ручное
-- управление без Stripe. Фичи гейтятся по тарифу (§94), видео — ретенция
-- и лимиты (§148). JSONB, а не отдельные колонки: план и его поля меняются
-- без миграций (v2: Stripe webhook пишет сюда же).

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
