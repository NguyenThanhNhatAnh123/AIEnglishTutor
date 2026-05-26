# Database Design

AI English Tutor uses two MySQL databases to keep the exam/grading domain and
the vocabulary learning domain separate.

## Databases

- `ai_english_exam`: main backend database
- `ai_english_learning`: learning service database

Both schemas are managed by Flyway migrations.

## Main Backend Schema

Important table groups:

- Identity: `roles`, `users`, `teachers`, `students`
- Class management: `classes`, `class_students`
- Exam content: `exams`, `exam_sections`, `reading_passages`, `questions`,
  `question_options`, `question_tags`, `question_tag_map`
- Attempts and submissions: `exam_attempts`, `submissions`, `answers`,
  `submission_suspicious_events`
- Results and feedback: `scores`, `feedbacks`, `ai_results`,
  `ai_scoring_logs`
- Media and settings: `media_files`, `student_progress`, `system_settings`

## Learning Schema

Important tables:

- `decks`
- `vocabulary_items`
- `student_deck_enrollments`
- `student_item_state`
- `flashcard_reviews`

This schema is intentionally separate because spaced repetition has its own
state and review history.

## Data Integrity

The schema uses:

- Primary keys for all major tables
- Foreign keys for important relationships
- Unique constraints for email, username, teacher code, student code, enrollment
  and one-answer-per-question rules
- Flyway migrations to keep schema changes versioned

## Index Strategy

Important indexes include:

- `idx_exams_status_created` for active exam listing
- `idx_exam_attempts_exam_student_attempt` for attempt-limit checks
- `idx_submissions_student_start` for student submission history
- `idx_submissions_exam_status_work_time` for teacher submission dashboards
- `idx_answers_submission_question` and `uk_answers_submission_question` for
  answer lookup/upsert
- Learning indexes such as `idx_state_due`, `idx_enrollment_student_status`, and
  `idx_review_student`

## Transaction And Pooling

Spring Boot uses HikariCP with explicit pool settings. JPA is configured with:

- `spring.jpa.open-in-view=false`
- `ddl-auto=validate`
- JDBC batching
- transaction timeout
- leak detection threshold

Services use `@Transactional` with `readOnly=true` where appropriate.

## Graduation-Scope Backup Plan

For the report, the recommended backup strategy is:

- Daily logical backup using `mysqldump`
- Keep at least 7 daily backups for demo/small deployment
- Store backups outside the application server
- Test restore before final defense

Production would require automated backups, point-in-time recovery, monitoring
and restore drills.

## Suggested Improvements

- Add pagination to dashboard/submission endpoints when data grows.
- Add EXPLAIN screenshots for key dashboard and student exam queries in the
  report appendix.
- Add a diagram showing the main entity relationships.
- Consider adding explicit FK/indexes for `student_progress` if the table is
  actively used.
