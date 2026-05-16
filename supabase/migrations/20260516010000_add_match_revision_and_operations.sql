-- Task 2: durable sync and replay.
-- Adds optimistic-concurrency control and a server-side idempotency / audit log.

-- Monotonic write counter for every match. Optimistic-concurrency updates use
-- `UPDATE matches ... WHERE id = ? AND revision = baseRevision` so a stale
-- client write fails fast instead of overwriting newer server data.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

-- Append-only operation log: server-side idempotency + referee audit trail.
-- A repeated operationId is detected here so a click is never applied twice.
CREATE TABLE IF NOT EXISTS match_operations (
  operation_id UUID PRIMARY KEY,
  match_id     UUID NOT NULL,
  base_revision INTEGER NOT NULL,
  result_revision INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  client_id    TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast lookup of a match's operation history (audit review, compaction).
CREATE INDEX IF NOT EXISTS match_operations_match_idx
  ON match_operations (match_id, result_revision);

-- Keep Realtime publication covering the new table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE match_operations;
    EXCEPTION WHEN duplicate_object THEN
      -- already part of the publication
      NULL;
    END;
  END IF;
END $$;
