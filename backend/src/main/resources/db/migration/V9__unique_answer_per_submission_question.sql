-- Prevent duplicate answers for the same submission/question pair under concurrent writes.

SET @uk_answers_submission_question_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'answers'
    AND index_name = 'uk_answers_submission_question'
);
SET @sql := IF(@uk_answers_submission_question_exists = 0,
  'ALTER TABLE answers ADD CONSTRAINT uk_answers_submission_question UNIQUE (submission_id, question_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
