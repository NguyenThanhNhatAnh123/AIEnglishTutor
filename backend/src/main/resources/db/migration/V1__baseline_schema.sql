-- Baseline schema (DDL only).
-- Intentionally contains NO seed data and NO destructive DROP statements.

-- Roles
CREATE TABLE roles (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Users
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) DEFAULT NULL,
  role_id INT NOT NULL,
  status VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  KEY role_id (role_id),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Teachers / Students
CREATE TABLE teachers (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  teacher_code VARCHAR(50) NOT NULL,
  department VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_teachers_user (user_id),
  UNIQUE KEY uk_teachers_code (teacher_code),
  KEY user_id (user_id),
  CONSTRAINT teachers_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE students (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  student_code VARCHAR(50) NOT NULL,
  date_of_birth DATE DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_students_user (user_id),
  UNIQUE KEY uk_students_code (student_code),
  KEY user_id (user_id),
  CONSTRAINT students_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Classes
CREATE TABLE classes (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  teacher_id INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY teacher_id (teacher_id),
  CONSTRAINT classes_ibfk_1 FOREIGN KEY (teacher_id) REFERENCES teachers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE class_students (
  id INT NOT NULL AUTO_INCREMENT,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_class_student (class_id, student_id),
  KEY student_id (student_id),
  CONSTRAINT class_students_ibfk_1 FOREIGN KEY (class_id) REFERENCES classes (id),
  CONSTRAINT class_students_ibfk_2 FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Exams
CREATE TABLE exams (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  teacher_id INT NOT NULL,
  duration_minutes INT DEFAULT NULL,
  status VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY teacher_id (teacher_id),
  CONSTRAINT exams_ibfk_1 FOREIGN KEY (teacher_id) REFERENCES teachers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE exam_attempts (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  attempt_number INT DEFAULT NULL,
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY FKt2bysgtvvg64lgryf27b1xo76 (student_id),
  KEY fk_exam_attempts_exam_cascade (exam_id),
  CONSTRAINT FKt2bysgtvvg64lgryf27b1xo76 FOREIGN KEY (student_id) REFERENCES students (id),
  CONSTRAINT fk_exam_attempts_exam_cascade FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE exam_sections (
  id INT NOT NULL AUTO_INCREMENT,
  exam_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  order_index INT DEFAULT NULL,
  section_type ENUM('LISTENING','READING','SPEAKING','WRITING') NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sections_exam (exam_id),
  CONSTRAINT fk_exam_sections_exam_cascade FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE reading_passages (
  id INT NOT NULL AUTO_INCREMENT,
  section_id INT DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  content TEXT,
  PRIMARY KEY (id),
  KEY section_id (section_id),
  CONSTRAINT reading_passages_ibfk_1 FOREIGN KEY (section_id) REFERENCES exam_sections (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE questions (
  id INT NOT NULL AUTO_INCREMENT,
  section_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) DEFAULT NULL,
  points INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  audio_url VARCHAR(500) DEFAULT NULL,
  passage_id INT DEFAULT NULL,
  min_words INT DEFAULT NULL,
  max_words INT DEFAULT NULL,
  listening_audio_url VARCHAR(500) DEFAULT NULL,
  transcript TEXT,
  PRIMARY KEY (id),
  KEY fk_passage (passage_id),
  KEY idx_questions_section (section_id),
  CONSTRAINT fk_passage FOREIGN KEY (passage_id) REFERENCES reading_passages (id),
  CONSTRAINT fk_questions_section_cascade FOREIGN KEY (section_id) REFERENCES exam_sections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_options (
  id INT NOT NULL AUTO_INCREMENT,
  question_id INT NOT NULL,
  option_text VARCHAR(500) DEFAULT NULL,
  is_correct TINYINT(1) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_question_options_question_cascade (question_id),
  CONSTRAINT fk_question_options_question_cascade FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_tags (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_question_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE question_tag_map (
  id INT NOT NULL AUTO_INCREMENT,
  question_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (id),
  KEY question_id (question_id),
  KEY tag_id (tag_id),
  CONSTRAINT question_tag_map_ibfk_1 FOREIGN KEY (question_id) REFERENCES questions (id),
  CONSTRAINT question_tag_map_ibfk_2 FOREIGN KEY (tag_id) REFERENCES question_tags (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Submissions / Answers
CREATE TABLE submissions (
  id INT NOT NULL AUTO_INCREMENT,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  start_time DATETIME DEFAULT NULL,
  submit_time DATETIME DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
  attempt_id INT DEFAULT NULL,
  client_reported_duration INT DEFAULT NULL,
  duration INT DEFAULT NULL,
  end_time DATETIME(6) DEFAULT NULL,
  answered_questions INT DEFAULT NULL,
  completion_percent INT DEFAULT NULL,
  copy_paste_count INT DEFAULT NULL,
  device_label VARCHAR(255) DEFAULT NULL,
  device_type VARCHAR(20) DEFAULT NULL,
  focus_loss_count INT DEFAULT NULL,
  suspicious_event_count INT DEFAULT NULL,
  tab_switch_count INT DEFAULT NULL,
  total_questions INT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY student_id (student_id),
  KEY idx_submissions_exam_student (exam_id, student_id),
  KEY fk_submissions_attempt_cascade (attempt_id),
  CONSTRAINT fk_submissions_attempt_cascade FOREIGN KEY (attempt_id) REFERENCES exam_attempts (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_exam_cascade FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT submissions_ibfk_2 FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE answers (
  id INT NOT NULL AUTO_INCREMENT,
  submission_id INT NOT NULL,
  question_id INT NOT NULL,
  answer_type ENUM('TEXT','CHOICE','AUDIO') DEFAULT NULL,
  content TEXT,
  answer_text TEXT,
  selected_option_id INT DEFAULT NULL,
  audio_url VARCHAR(500) DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  speaking_audio_url VARCHAR(255) DEFAULT NULL,
  speaking_duration_seconds INT DEFAULT NULL,
  speaking_format VARCHAR(16) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_answers_submission_cascade (submission_id),
  KEY fk_answers_question_cascade (question_id),
  CONSTRAINT fk_answers_question_cascade FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_submission_cascade FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Results / Feedback
CREATE TABLE scores (
  id INT NOT NULL AUTO_INCREMENT,
  submission_id INT NOT NULL,
  mc_score FLOAT DEFAULT NULL,
  writing_score FLOAT DEFAULT NULL,
  speaking_score FLOAT DEFAULT NULL,
  total_score FLOAT DEFAULT NULL,
  graded_by INT DEFAULT NULL,
  graded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  listening_score FLOAT DEFAULT '0',
  reading_score FLOAT DEFAULT '0',
  PRIMARY KEY (id),
  KEY fk_scores_submission_cascade (submission_id),
  CONSTRAINT fk_scores_submission_cascade FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE feedbacks (
  id INT NOT NULL AUTO_INCREMENT,
  answer_id INT NOT NULL,
  teacher_feedback TEXT,
  ai_feedback TEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_feedbacks_answer_cascade (answer_id),
  CONSTRAINT fk_feedbacks_answer_cascade FOREIGN KEY (answer_id) REFERENCES answers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Media
CREATE TABLE media_files (
  id INT NOT NULL AUTO_INCREMENT,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) DEFAULT NULL,
  uploaded_by INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  question_id INT DEFAULT NULL,
  original_filename VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_media_question (question_id),
  CONSTRAINT fk_media_question FOREIGN KEY (question_id) REFERENCES questions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI
CREATE TABLE ai_results (
  id INT NOT NULL AUTO_INCREMENT,
  answer_id INT NOT NULL,
  grammar_score FLOAT DEFAULT NULL,
  vocabulary_score FLOAT DEFAULT NULL,
  fluency_score FLOAT DEFAULT NULL,
  pronunciation_score FLOAT DEFAULT NULL,
  coherence_score FLOAT DEFAULT NULL,
  overall_score FLOAT DEFAULT NULL,
  feedback TEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_ai_results_answer_cascade (answer_id),
  CONSTRAINT fk_ai_results_answer_cascade FOREIGN KEY (answer_id) REFERENCES answers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_scoring_logs (
  id INT NOT NULL AUTO_INCREMENT,
  answer_id INT NOT NULL,
  submission_id INT NOT NULL,
  scoring_type VARCHAR(20) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) DEFAULT NULL,
  endpoint VARCHAR(255) DEFAULT NULL,
  request_payload LONGTEXT,
  response_body LONGTEXT,
  http_status INT DEFAULT NULL,
  success_flag BIT(1) NOT NULL,
  latency_ms BIGINT DEFAULT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_scoring_logs_answer (answer_id),
  KEY idx_ai_scoring_logs_submission (submission_id),
  KEY idx_ai_scoring_logs_type (scoring_type),
  CONSTRAINT fk_ai_scoring_logs_answer FOREIGN KEY (answer_id) REFERENCES answers (id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_scoring_logs_submission FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Anti-cheat analytics
CREATE TABLE submission_suspicious_events (
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
  CONSTRAINT fk_submission_suspicious_events_submission FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
  CONSTRAINT fk_submission_suspicious_events_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Misc analytics
CREATE TABLE student_progress (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  average_score FLOAT DEFAULT NULL,
  attempt_count INT DEFAULT NULL,
  last_attempt DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE system_settings (
  id INT NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) DEFAULT NULL,
  description TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

