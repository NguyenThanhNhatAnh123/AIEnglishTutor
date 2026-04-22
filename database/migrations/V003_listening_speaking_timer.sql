-- V003: Listening transcript, speaking audio path, submission timer fields.
-- Run on MySQL 8.x. Skip statements that fail if already applied.

-- Optional transcript for listening questions (HTML/plain text).
ALTER TABLE questions ADD COLUMN transcript TEXT NULL;

-- Student speaking recordings (file path only; binary lives on disk).
ALTER TABLE answers ADD COLUMN speaking_audio_url VARCHAR(255) NULL;

-- Exam completion tracking (submit_time remains for backward compatibility).
ALTER TABLE submissions ADD COLUMN end_time DATETIME NULL;
ALTER TABLE submissions ADD COLUMN duration INT NULL COMMENT 'seconds spent, end_time - start_time';

UPDATE submissions
SET end_time = submit_time
WHERE submit_time IS NOT NULL AND (end_time IS NULL OR end_time <> submit_time);
