-- Mirror of backend Flyway V5__exam_type.sql (exam OFFICIAL vs PRACTICE).
ALTER TABLE exams
  ADD COLUMN exam_type VARCHAR(20) NOT NULL DEFAULT 'PRACTICE'
  COMMENT 'OFFICIAL or PRACTICE';
