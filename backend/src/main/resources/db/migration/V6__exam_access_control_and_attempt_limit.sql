-- Per-exam attempt limit and optional class-based access control.

ALTER TABLE exams
  ADD COLUMN max_attempts INT NULL COMMENT 'Null = unlimited attempts';

CREATE TABLE exam_allowed_classes (
  exam_id INT NOT NULL,
  class_id INT NOT NULL,
  PRIMARY KEY (exam_id, class_id),
  KEY idx_exam_allowed_classes_class (class_id),
  CONSTRAINT fk_exam_allowed_classes_exam
    FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_allowed_classes_class
    FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
