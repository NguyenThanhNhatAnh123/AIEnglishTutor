ALTER TABLE feedbacks
    ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN draft_score FLOAT NULL,
    ADD COLUMN published_score FLOAT NULL,
    ADD COLUMN custom_prompt TEXT NULL,
    ADD COLUMN published_at DATETIME NULL,
    ADD COLUMN published_by INT NULL,
    ADD COLUMN updated_at DATETIME NULL;

UPDATE feedbacks
SET review_status = 'PUBLISHED',
    published_score = COALESCE(published_score, draft_score),
    teacher_feedback = COALESCE(teacher_feedback, ai_feedback),
    published_at = COALESCE(published_at, created_at),
    updated_at = COALESCE(updated_at, created_at)
WHERE (teacher_feedback IS NOT NULL AND TRIM(teacher_feedback) <> '')
   OR (ai_feedback IS NOT NULL AND TRIM(ai_feedback) <> '');
