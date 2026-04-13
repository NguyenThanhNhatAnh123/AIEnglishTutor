-- V002: Align legacy MySQL dumps with the Spring Boot JPA model.
-- Target: MySQL 8.0.x. Run in order; skip a block if it was already applied (duplicate column / FK).
--
-- Conflicts with V001: if submissions.attempt_id and indexes already exist, skip section 3
-- (ADD COLUMN + CREATE INDEX). If questions.audio_url was added by V001, section 1 MODIFY still applies.

-- =============================================================================
-- 1) questions — drop unmapped reading passage link; remove empty reading_passages
-- =============================================================================
-- Skip if constraint was already removed:
ALTER TABLE questions DROP FOREIGN KEY fk_passage;

ALTER TABLE questions
    DROP COLUMN passage_id,
    DROP COLUMN min_words,
    DROP COLUMN max_words;

DROP TABLE IF EXISTS reading_passages;

-- Widen to match JPA Question.audioUrl (length 500)
ALTER TABLE questions MODIFY COLUMN audio_url VARCHAR(500) NULL;

-- =============================================================================
-- 2) answers — remove redundant columns (content / answer_type duplicate question typing)
-- =============================================================================
UPDATE answers
SET answer_text = content
WHERE (answer_text IS NULL OR TRIM(answer_text) = '') AND content IS NOT NULL;

ALTER TABLE answers
    DROP COLUMN answer_type,
    DROP COLUMN content;

ALTER TABLE answers
    MODIFY submission_id INT NOT NULL,
    MODIFY question_id INT NOT NULL;

-- =============================================================================
-- 3) submissions — link to exam_attempts (backfill then FK)
-- =============================================================================
-- Skip the next line if attempt_id already exists (e.g. after V001):
ALTER TABLE submissions ADD COLUMN attempt_id INT NULL AFTER student_id;

UPDATE submissions s
JOIN (
    SELECT s2.id AS sid,
           (SELECT MIN(ea.id) FROM exam_attempts ea
            WHERE ea.student_id = s2.student_id AND ea.exam_id = s2.exam_id) AS aid
    FROM submissions s2
) m ON s.id = m.sid
SET s.attempt_id = m.aid
WHERE m.aid IS NOT NULL AND s.attempt_id IS NULL;

-- Skip indexes that already exist:
CREATE INDEX idx_submissions_attempt_id ON submissions (attempt_id);
CREATE INDEX idx_submissions_student_exam ON submissions (student_id, exam_id);
CREATE INDEX idx_submissions_status ON submissions (status);

-- =============================================================================
-- 4) exam_attempts — FKs to students / exams
-- =============================================================================
CREATE INDEX idx_exam_attempts_student_exam ON exam_attempts (student_id, exam_id);

ALTER TABLE exam_attempts
    ADD CONSTRAINT fk_exam_attempts_student FOREIGN KEY (student_id) REFERENCES students (id),
    ADD CONSTRAINT fk_exam_attempts_exam FOREIGN KEY (exam_id) REFERENCES exams (id);

-- =============================================================================
-- 5) submissions — FK to exam_attempts (requires non-null attempt_id or nullable FK)
-- =============================================================================
ALTER TABLE submissions
    ADD CONSTRAINT fk_submissions_exam_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts (id);

-- =============================================================================
-- 6) ai_results — NOT NULL + unique answer_id (JPA OneToOne Answer)
-- =============================================================================
DELETE ar FROM ai_results ar
LEFT JOIN answers a ON ar.answer_id = a.id
WHERE a.id IS NULL;

ALTER TABLE ai_results
    MODIFY answer_id INT NOT NULL,
    ADD UNIQUE KEY uk_ai_results_answer (answer_id);

-- =============================================================================
-- 7) scores — drop listening_score / reading_score (not mapped by Score.java)
-- =============================================================================
-- Only backfill mc_score when it is NULL so existing mc values stay authoritative.
UPDATE scores
SET mc_score = listening_score
WHERE mc_score IS NULL AND listening_score IS NOT NULL;

UPDATE scores
SET mc_score = reading_score
WHERE mc_score IS NULL AND reading_score IS NOT NULL;

UPDATE scores
SET mc_score = (IFNULL(listening_score, 0) + IFNULL(reading_score, 0)) / 2
WHERE mc_score IS NULL AND listening_score IS NOT NULL AND reading_score IS NOT NULL;

ALTER TABLE scores
    DROP COLUMN listening_score,
    DROP COLUMN reading_score;

ALTER TABLE scores ADD UNIQUE KEY uk_scores_submission (submission_id);

-- =============================================================================
-- 8) Performance indexes for answers
-- =============================================================================
CREATE INDEX idx_answers_submission_id ON answers (submission_id);
CREATE INDEX idx_answers_question_id ON answers (question_id);
