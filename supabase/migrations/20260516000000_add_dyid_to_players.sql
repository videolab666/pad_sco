-- Add the "dyId" column to the players table.
-- It stores the external player id from a tennispadel.double-yellow.be feed
-- and enables cross-device deduplication of imported players.
--
-- Run this once against an existing database (Supabase SQL Editor or psql).
-- The column name is quoted so it stays camelCase and matches the JS property.

ALTER TABLE players ADD COLUMN IF NOT EXISTS "dyId" TEXT;

CREATE INDEX IF NOT EXISTS players_dyid_idx ON players ("dyId");
