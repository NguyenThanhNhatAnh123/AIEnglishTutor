# Thiết Kế Cơ Sở Dữ Liệu

AI English Tutor sử dụng hai database MySQL để tách miền nghiệp vụ bài thi/chấm
điểm và miền nghiệp vụ học từ vựng.

## Các Database

- `ai_english_exam`: database chính của backend
- `ai_english_learning`: database của learning service

Cả hai schema đều được quản lý bằng Flyway migrations.

## Schema Backend Chính

Các nhóm bảng quan trọng:

- Định danh người dùng: `roles`, `users`, `teachers`, `students`
- Quản lý lớp: `classes`, `class_students`
- Nội dung đề thi: `exams`, `exam_sections`, `reading_passages`, `questions`,
  `question_options`, `question_tags`, `question_tag_map`
- Lượt làm bài và bài nộp: `exam_attempts`, `submissions`, `answers`,
  `submission_suspicious_events`
- Kết quả và phản hồi: `scores`, `feedbacks`, `ai_results`,
  `ai_scoring_logs`
- Media và cấu hình: `media_files`, `student_progress`, `system_settings`

## Schema Learning Service

Các bảng quan trọng:

- `decks`
- `vocabulary_items`
- `student_deck_enrollments`
- `student_item_state`
- `flashcard_reviews`

Schema này được tách riêng vì spaced repetition có trạng thái học và lịch sử
review riêng.

## Toàn Vẹn Dữ Liệu

Schema sử dụng:

- Primary key cho các bảng chính
- Foreign key cho các quan hệ quan trọng
- Unique constraint cho email, username, mã giáo viên, mã sinh viên, enrollment
  và quy tắc một câu trả lời cho mỗi câu hỏi trong một bài làm
- Flyway migration để quản lý phiên bản thay đổi schema

## Chiến Lược Index

Các index quan trọng:

- `idx_exams_status_created`: phục vụ danh sách đề thi active
- `idx_exam_attempts_exam_student_attempt`: kiểm tra số lần làm bài
- `idx_submissions_student_start`: lịch sử nộp bài của sinh viên
- `idx_submissions_exam_status_work_time`: dashboard bài nộp cho giáo viên
- `idx_answers_submission_question` và `uk_answers_submission_question`: tìm và
  cập nhật câu trả lời
- Learning indexes như `idx_state_due`, `idx_enrollment_student_status`,
  `idx_review_student`

## Transaction Và Connection Pooling

Spring Boot sử dụng HikariCP với cấu hình pool rõ ràng. JPA được cấu hình:

- `spring.jpa.open-in-view=false`
- `ddl-auto=validate`
- JDBC batching
- transaction timeout
- leak detection threshold

Tầng service dùng `@Transactional`, trong đó các truy vấn đọc dùng
`readOnly=true` khi phù hợp.

## Kế Hoạch Backup Ở Phạm Vi Khóa Luận

Chiến lược backup đề xuất để trình bày trong báo cáo:

- Backup logic hằng ngày bằng `mysqldump`
- Giữ tối thiểu 7 bản backup gần nhất cho môi trường demo/quy mô nhỏ
- Lưu backup ngoài server chạy ứng dụng
- Thử restore trước ngày bảo vệ

Khi triển khai production cần có backup tự động, point-in-time recovery, giám sát
và diễn tập restore định kỳ.

## Đề Xuất Cải Thiện

- Thêm phân trang cho dashboard/submission khi dữ liệu tăng.
- Chụp EXPLAIN plan cho các truy vấn quan trọng và đưa vào phụ lục báo cáo.
- Vẽ sơ đồ quan hệ entity chính.
- Bổ sung FK/index rõ ràng cho `student_progress` nếu bảng này còn được sử dụng.
