-- V006: Section skill type (READING/LISTENING/WRITING/SPEAKING) + writing word limits on questions.
-- MySQL 8.x. Skip statements that fail if already applied.

ALTER TABLE exam_sections
    ADD COLUMN section_type VARCHAR(20) NOT NULL DEFAULT 'READING'
        COMMENT 'READING, LISTENING, WRITING, SPEAKING';

ALTER TABLE questions
    ADD COLUMN min_words INT NULL,
    ADD COLUMN max_words INT NULL;
