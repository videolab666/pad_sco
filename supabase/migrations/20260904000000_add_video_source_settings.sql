-- Remote Camera Settings (plan 2026-09-02 remote-camera-settings, Task 1).
--
-- Desired-state на video_sources: админ пишет desired_settings + инкремент
-- settings_version; камера в heartbeat сообщает applied-версию и local_seq.
-- Часы не участвуют: только монотонные счётчики (урок qr-gated-плана).
-- Adopt: локальная правка телефона (localSeq > acked) становится желаемой.

ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS desired_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS settings_version INT NOT NULL DEFAULT 0;
ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS acked_local_seq INT NOT NULL DEFAULT 0;
