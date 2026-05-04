-- Exam classification: OFFICIAL (single completed attempt) vs PRACTICE (repeatable).
ALTER TABLE exams
  ADD COLUMN exam_type VARCHAR(20) NOT NULL DEFAULT 'PRACTICE'
  COMMENT 'OFFICIAL or PRACTICE';
