-- V001: Minimal incremental indexes + optional attempt_id (greenfield / first deploy).
-- If you are importing a legacy dump like the stock ai_english_exam dump, run
-- V002_align_schema_with_application.sql instead (or after V001) to remove redundant
-- columns and add FKs. Skip any statement below that fails because the object exists.

-- questions.audio_url — skip if already present in your dump
ALTER TABLE questions ADD COLUMN audio_url VARCHAR(500) NULL;

-- submissions.attempt_id — skip if V002 or Hibernate already added it
ALTER TABLE submissions ADD COLUMN attempt_id INT NULL;

CREATE INDEX idx_submissions_attempt_id ON submissions (attempt_id);
CREATE INDEX idx_submissions_student_exam ON submissions (student_id, exam_id);
CREATE INDEX idx_submissions_status ON submissions (status);
CREATE INDEX idx_exam_attempts_student_exam ON exam_attempts (student_id, exam_id);
CREATE INDEX idx_answers_submission_id ON answers (submission_id);
CREATE INDEX idx_answers_question_id ON answers (question_id);

-- Uncomment after every submission row has a valid attempt_id:
-- ALTER TABLE submissions
--     ADD CONSTRAINT fk_submissions_exam_attempt
--     FOREIGN KEY (attempt_id) REFERENCES exam_attempts (id);
