-- V005: Persist submission completion stats and anti-cheat analytics.
-- MySQL 8.x; skip statements that fail if already applied.

ALTER TABLE submissions ADD COLUMN answered_questions INT NULL;
ALTER TABLE submissions ADD COLUMN total_questions INT NULL;
ALTER TABLE submissions ADD COLUMN completion_percent INT NULL;

ALTER TABLE submissions ADD COLUMN tab_switch_count INT NULL;
ALTER TABLE submissions ADD COLUMN focus_loss_count INT NULL;
ALTER TABLE submissions ADD COLUMN copy_paste_count INT NULL;
ALTER TABLE submissions ADD COLUMN suspicious_event_count INT NULL;

ALTER TABLE submissions ADD COLUMN device_type VARCHAR(20) NULL;
ALTER TABLE submissions ADD COLUMN device_label VARCHAR(255) NULL;

