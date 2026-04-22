-- V004: Standardize listening vs speaking audio; speaking metadata; client-reported duration.
-- Safe order: add/copy, then drop. Skip statements already applied.

-- ── questions: listening_audio_url replaces audio_url ───────────────────────
ALTER TABLE questions ADD COLUMN listening_audio_url VARCHAR(500) NULL;
UPDATE questions SET listening_audio_url = audio_url WHERE audio_url IS NOT NULL AND TRIM(audio_url) <> '';
ALTER TABLE questions DROP COLUMN audio_url;

-- ── answers: migrate legacy audio_url into speaking_audio_url; metadata ──
UPDATE answers
SET speaking_audio_url = audio_url
WHERE (speaking_audio_url IS NULL OR TRIM(speaking_audio_url) = '')
  AND audio_url IS NOT NULL AND TRIM(audio_url) <> '';

ALTER TABLE answers ADD COLUMN speaking_duration_seconds INT NULL;
ALTER TABLE answers ADD COLUMN speaking_format VARCHAR(16) NULL;
ALTER TABLE answers DROP COLUMN audio_url;

-- ── submissions: optional client-reported seconds (audit / validation) ─────
ALTER TABLE submissions ADD COLUMN client_reported_duration INT NULL;
