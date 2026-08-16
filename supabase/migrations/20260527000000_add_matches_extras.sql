-- Task 1: extended match state (events / timing / rally stats / toss /
-- new balls / handicap / power play / timeouts / official calls / metadata).
--
-- These fields are append-only or rarely-written and live entirely inside a
-- single jsonb column instead of bloating the schema with one column per
-- feature. matchToRow / matchFromRow pack and spread this column.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb;
