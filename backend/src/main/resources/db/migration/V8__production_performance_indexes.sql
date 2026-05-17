-- Production query indexes for high-concurrency exam/submission flows.

CREATE INDEX idx_exams_status_created
    ON exams (status, created_at, id);

CREATE INDEX idx_exam_attempts_exam_student_attempt
    ON exam_attempts (exam_id, student_id, attempt_number);

CREATE INDEX idx_submissions_student_start
    ON submissions (student_id, start_time, id);

CREATE INDEX idx_submissions_exam_status_work_time
    ON submissions (exam_id, status, end_time, submit_time, start_time, id);

CREATE INDEX idx_answers_submission_question
    ON answers (submission_id, question_id);

CREATE INDEX idx_feedbacks_review_answer
    ON feedbacks (review_status, answer_id);

CREATE INDEX idx_ai_scoring_logs_created_type
    ON ai_scoring_logs (created_at, scoring_type);
