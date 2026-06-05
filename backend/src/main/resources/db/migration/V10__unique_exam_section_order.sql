-- Keep exam section order stable for aggregate exam writes.

SET @uk_exam_sections_order_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'exam_sections'
    AND index_name = 'uk_exam_sections_exam_order'
);

SET @duplicate_exam_section_order_count := (
  SELECT COUNT(*) FROM (
    SELECT exam_id, order_index
    FROM exam_sections
    WHERE order_index IS NOT NULL
    GROUP BY exam_id, order_index
    HAVING COUNT(*) > 1
  ) duplicate_orders
);

SET @sql := IF(@uk_exam_sections_order_exists = 0 AND @duplicate_exam_section_order_count = 0,
  'ALTER TABLE exam_sections ADD CONSTRAINT uk_exam_sections_exam_order UNIQUE (exam_id, order_index)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
