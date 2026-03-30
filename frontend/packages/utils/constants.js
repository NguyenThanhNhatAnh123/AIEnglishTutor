// ─── API ────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'http://localhost:8080/api';

// ─── App ports ───────────────────────────────────────────────────────────────
export const STUDENT_PORT  = 5173;
export const TEACHER_PORT  = 5174;

// ─── Question types ───────────────────────────────────────────────────────────
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  WRITING:         'WRITING',
  SPEAKING:        'SPEAKING',
};

export const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  WRITING:         'Writing',
  SPEAKING:        'Speaking',
};

// ─── Exam statuses ────────────────────────────────────────────────────────────
export const EXAM_STATUS = {
  DRAFT:  'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

// ─── Submission statuses ──────────────────────────────────────────────────────
export const SUBMISSION_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED:   'SUBMITTED',
  GRADED:      'GRADED',
};

// ─── User roles ───────────────────────────────────────────────────────────────
export const ROLES = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  ADMIN:   'ADMIN',
};

// ─── Grade thresholds ────────────────────────────────────────────────────────
export const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A+' },
  { min: 80, grade: 'A'  },
  { min: 70, grade: 'B'  },
  { min: 60, grade: 'C'  },
  { min: 50, grade: 'D'  },
  { min:  0, grade: 'F'  },
];

/**
 * Returns the letter grade for a numeric score.
 * @param {number} score
 * @returns {string}
 */
export function getGrade(score) {
  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return 'F';
}

// ─── Local storage keys ──────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER:  'user',
};
