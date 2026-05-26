CREATE TABLE decks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300) NULL,
  level VARCHAR(10) NOT NULL,
  topic VARCHAR(60) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_decks_level (level),
  INDEX idx_decks_topic (topic),
  INDEX idx_decks_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocabulary_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  deck_id BIGINT NOT NULL,
  word VARCHAR(100) NOT NULL,
  phonetic VARCHAR(100) NULL,
  part_of_speech VARCHAR(20) NULL,
  definition_en VARCHAR(400) NOT NULL,
  definition_vi VARCHAR(400) NOT NULL,
  example_sentence VARCHAR(500) NULL,
  example_sentence_vi VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  order_in_deck INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vocab_deck FOREIGN KEY (deck_id) REFERENCES decks(id),
  UNIQUE KEY uk_vocab_deck_word (deck_id, word),
  INDEX idx_vocab_deck (deck_id),
  INDEX idx_vocab_deck_order (deck_id, order_in_deck),
  INDEX idx_vocab_active (deck_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_deck_enrollments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  student_user_id BIGINT NOT NULL,
  deck_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  last_studied_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_enrollment_deck FOREIGN KEY (deck_id) REFERENCES decks(id),
  CONSTRAINT chk_enrollment_status CHECK (status IN ('active','completed','paused')),
  UNIQUE KEY uk_enrollment_student_deck (student_user_id, deck_id),
  INDEX idx_enrollment_student_status (student_user_id, status),
  INDEX idx_enrollment_deck (deck_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_item_state (
  id BIGINT NOT NULL AUTO_INCREMENT,
  student_user_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50,
  interval_days INT NOT NULL DEFAULT 1,
  streak INT NOT NULL DEFAULT 0,
  lapse_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  due_at TIMESTAMP NOT NULL,
  last_reviewed_at TIMESTAMP NULL,
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_state_item FOREIGN KEY (item_id) REFERENCES vocabulary_items(id),
  CONSTRAINT chk_state_status CHECK (status IN ('new','learning','review','suspended')),
  UNIQUE KEY uk_state_student_item (student_user_id, item_id),
  INDEX idx_state_due (student_user_id, due_at),
  INDEX idx_state_status (student_user_id, status),
  INDEX idx_state_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE flashcard_reviews (
  id BIGINT NOT NULL AUTO_INCREMENT,
  student_item_state_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  rating VARCHAR(20) NOT NULL,
  prev_interval_days INT NOT NULL,
  next_interval_days INT NOT NULL,
  prev_ease_factor DECIMAL(4,2) NOT NULL,
  next_ease_factor DECIMAL(4,2) NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_review_state FOREIGN KEY (student_item_state_id) REFERENCES student_item_state(id),
  CONSTRAINT chk_review_rating CHECK (rating IN ('again','hard','good','easy')),
  UNIQUE KEY uk_review_request (student_user_id, request_id),
  INDEX idx_review_student (student_user_id, reviewed_at),
  INDEX idx_review_item_student (item_id, student_user_id),
  INDEX idx_review_state (student_item_state_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
