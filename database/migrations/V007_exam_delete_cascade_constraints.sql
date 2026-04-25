-- V007: enforce cascade delete for exam graph to prevent orphan records.
-- Safe to run multiple times.

DROP PROCEDURE IF EXISTS ensure_fk_with_cascade;
DELIMITER //
CREATE PROCEDURE ensure_fk_with_cascade(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_ref_table VARCHAR(64),
    IN p_ref_column VARCHAR(64),
    IN p_fk_name VARCHAR(64)
)
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_fk_name VARCHAR(128);
    DECLARE cur CURSOR FOR
        SELECT k.CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE k
        WHERE k.TABLE_SCHEMA = DATABASE()
          AND k.TABLE_NAME = p_table_name
          AND k.COLUMN_NAME = p_column_name
          AND k.REFERENCED_TABLE_NAME = p_ref_table
          AND k.REFERENCED_COLUMN_NAME = p_ref_column;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO v_fk_name;
        IF done = 1 THEN
            LEAVE read_loop;
        END IF;
        SET @drop_sql = CONCAT('ALTER TABLE ', p_table_name, ' DROP FOREIGN KEY ', v_fk_name);
        PREPARE stmt FROM @drop_sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END LOOP;
    CLOSE cur;

    SET @add_sql = CONCAT(
            'ALTER TABLE ', p_table_name,
            ' ADD CONSTRAINT ', p_fk_name,
            ' FOREIGN KEY (', p_column_name, ') REFERENCES ', p_ref_table, '(', p_ref_column, ') ON DELETE CASCADE'
        );
    PREPARE stmt2 FROM @add_sql;
    EXECUTE stmt2;
    DEALLOCATE PREPARE stmt2;
END//
DELIMITER ;

CALL ensure_fk_with_cascade('exam_sections', 'exam_id', 'exams', 'id', 'fk_exam_sections_exam_cascade');
CALL ensure_fk_with_cascade('questions', 'section_id', 'exam_sections', 'id', 'fk_questions_section_cascade');
CALL ensure_fk_with_cascade('question_options', 'question_id', 'questions', 'id', 'fk_question_options_question_cascade');
CALL ensure_fk_with_cascade('exam_attempts', 'exam_id', 'exams', 'id', 'fk_exam_attempts_exam_cascade');
CALL ensure_fk_with_cascade('submissions', 'exam_id', 'exams', 'id', 'fk_submissions_exam_cascade');
CALL ensure_fk_with_cascade('submissions', 'attempt_id', 'exam_attempts', 'id', 'fk_submissions_attempt_cascade');
CALL ensure_fk_with_cascade('answers', 'submission_id', 'submissions', 'id', 'fk_answers_submission_cascade');
CALL ensure_fk_with_cascade('answers', 'question_id', 'questions', 'id', 'fk_answers_question_cascade');
CALL ensure_fk_with_cascade('scores', 'submission_id', 'submissions', 'id', 'fk_scores_submission_cascade');
CALL ensure_fk_with_cascade('feedbacks', 'answer_id', 'answers', 'id', 'fk_feedbacks_answer_cascade');
CALL ensure_fk_with_cascade('ai_results', 'answer_id', 'answers', 'id', 'fk_ai_results_answer_cascade');

DROP PROCEDURE IF EXISTS ensure_fk_with_cascade;
