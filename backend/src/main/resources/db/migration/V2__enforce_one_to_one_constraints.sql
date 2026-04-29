-- Flyway migration must be restartable on existing DBs.
-- Some environments may already contain these unique indexes/constraints.
-- We therefore conditionally ADD them only when missing.

-- ai_results(answer_id)
SET @uk_ai_results_answer_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_results'
    AND index_name = 'uk_ai_results_answer'
);
SET @sql := IF(@uk_ai_results_answer_exists = 0,
  'ALTER TABLE ai_results ADD CONSTRAINT uk_ai_results_answer UNIQUE (answer_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- feedbacks(answer_id)
SET @uk_feedbacks_answer_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'feedbacks'
    AND index_name = 'uk_feedbacks_answer'
);
SET @sql := IF(@uk_feedbacks_answer_exists = 0,
  'ALTER TABLE feedbacks ADD CONSTRAINT uk_feedbacks_answer UNIQUE (answer_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- scores(submission_id)
SET @uk_scores_submission_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'scores'
    AND index_name = 'uk_scores_submission'
);
SET @sql := IF(@uk_scores_submission_exists = 0,
  'ALTER TABLE scores ADD CONSTRAINT uk_scores_submission UNIQUE (submission_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
