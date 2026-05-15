// ─── API ────────────────────────────────────────────────────────────────────
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
const defaultOrigin = import.meta.env.DEV ? 'http://localhost:8080' : runtimeOrigin;
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const configuredOrigin = import.meta.env.VITE_API_ORIGIN || '';

export const API_ORIGIN = (configuredOrigin || configuredBaseUrl.replace(/\/api\/?$/, '') || defaultOrigin).replace(/\/$/, '');
export const API_BASE_URL = (configuredBaseUrl || `${API_ORIGIN}/api`).replace(/\/$/, '');
export const APP_BASE_PATH = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '');

// ─── App ports ───────────────────────────────────────────────────────────────
export const STUDENT_PORT  = 5173;
export const TEACHER_PORT  = 5174;

// ─── Exam section skill types (must match backend ExamSectionType) ────────────
export const SECTION_TYPES = {
  READING: 'READING',
  LISTENING: 'LISTENING',
  WRITING: 'WRITING',
  SPEAKING: 'SPEAKING',
};

// ─── Question types ───────────────────────────────────────────────────────────
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  LISTENING:       'LISTENING',
  WRITING:         'WRITING',
  SPEAKING:        'SPEAKING',
};

export const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  LISTENING:       'Listening',
  WRITING:         'Writing',
  SPEAKING:        'Speaking',
};

// ─── Exam statuses ────────────────────────────────────────────────────────────
export const EXAM_STATUS = {
  DRAFT:  'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

// ─── Submission statuses (must match backend SubmissionStatus enum) ───────────
export const SUBMISSION_STATUS = {
  IN_PROGRESS:    'IN_PROGRESS',
  SUBMITTED:      'SUBMITTED',
  AUTO_SUBMITTED: 'AUTO_SUBMITTED',
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
