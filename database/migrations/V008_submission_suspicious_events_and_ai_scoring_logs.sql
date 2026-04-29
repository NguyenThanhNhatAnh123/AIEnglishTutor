-- V008: Persist suspicious event snapshots per submission and raw AI scoring request/response logs.
-- MySQL 8.x.

CREATE TABLE IF NOT EXISTS submission_suspicious_events (
    id INT NOT NULL AUTO_INCREMENT,
    submission_id INT NOT NULL,
    student_id INT NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    event_count INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_submission_suspicious_event (submission_id, event_type),
    KEY idx_submission_suspicious_events_submission (submission_id),
    KEY idx_submission_suspicious_events_student (student_id),
    CONSTRAINT fk_submission_suspicious_events_submission
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    CONSTRAINT fk_submission_suspicious_events_student
        FOREIGN KEY (student_id) REFERENCES students (id)
);

INSERT IGNORE INTO submission_suspicious_events (submission_id, student_id, event_type, event_count, created_at)
SELECT s.id, s.student_id, 'TAB_SWITCH', s.tab_switch_count, COALESCE(s.submit_time, s.end_time, NOW())
FROM submissions s
WHERE COALESCE(s.tab_switch_count, 0) > 0;

INSERT IGNORE INTO submission_suspicious_events (submission_id, student_id, event_type, event_count, created_at)
SELECT s.id, s.student_id, 'FOCUS_LOSS', s.focus_loss_count, COALESCE(s.submit_time, s.end_time, NOW())
FROM submissions s
WHERE COALESCE(s.focus_loss_count, 0) > 0;

INSERT IGNORE INTO submission_suspicious_events (submission_id, student_id, event_type, event_count, created_at)
SELECT s.id, s.student_id, 'COPY_PASTE', s.copy_paste_count, COALESCE(s.submit_time, s.end_time, NOW())
FROM submissions s
WHERE COALESCE(s.copy_paste_count, 0) > 0;

CREATE TABLE IF NOT EXISTS ai_scoring_logs (
    id INT NOT NULL AUTO_INCREMENT,
    answer_id INT NOT NULL,
    submission_id INT NOT NULL,
    scoring_type VARCHAR(20) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) DEFAULT NULL,
    endpoint VARCHAR(255) DEFAULT NULL,
    request_payload LONGTEXT DEFAULT NULL,
    response_body LONGTEXT DEFAULT NULL,
    http_status INT DEFAULT NULL,
    success_flag BIT(1) NOT NULL,
    latency_ms BIGINT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ai_scoring_logs_answer (answer_id),
    KEY idx_ai_scoring_logs_submission (submission_id),
    KEY idx_ai_scoring_logs_type (scoring_type),
    CONSTRAINT fk_ai_scoring_logs_answer
        FOREIGN KEY (answer_id) REFERENCES answers (id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_scoring_logs_submission
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
);
