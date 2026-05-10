-- Remove load-test accounts and their dependent data.
-- Matches usernames/emails starting with "loadtest".

DELETE FROM class_students
WHERE student_id IN (
    SELECT s.id
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM submission_suspicious_events
WHERE student_id IN (
    SELECT s.id
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM submissions
WHERE student_id IN (
    SELECT s.id
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM exam_attempts
WHERE student_id IN (
    SELECT s.id
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM students
WHERE user_id IN (
    SELECT u.id
    FROM users u
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM exams
WHERE teacher_id IN (
    SELECT t.id
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM classes
WHERE teacher_id IN (
    SELECT t.id
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM teachers
WHERE user_id IN (
    SELECT u.id
    FROM users u
    WHERE u.username LIKE 'loadtest%' OR u.email LIKE 'loadtest%'
);

DELETE FROM users
WHERE username LIKE 'loadtest%' OR email LIKE 'loadtest%';
