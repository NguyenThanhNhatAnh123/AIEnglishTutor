import axios from 'axios';
import { API_BASE_URL, API_ORIGIN, APP_BASE_PATH } from '../../../packages/utils/constants.js';

/** Upload audio without forcing JSON Content-Type (multipart boundary). */
async function uploadAudioMultipart(file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `Upload failed (${res.status})`);
    err.response = { data: json, status: res.status };
    throw err;
  }
  return { data: json };
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // If payload is FormData, let the browser set multipart/form-data with boundary.
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const isLoginRequest = e.config?.url?.includes('/auth/login');
    if (e.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `${window.location.origin}${APP_BASE_PATH}/login`;
    }
    return Promise.reject(e);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
};

export const roleApi = {
  getAll: () => api.get('/roles'),
};

export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const studentApi = {
  getAll: () => api.get('/students'),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

export const teacherApi = {
  getAll: () => api.get('/teachers'),
  create: (data) => api.post('/teachers', data),
};

export const classApi = {
  getAll: () => api.get('/classes'),
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`),
  getStudents: (id) => api.get(`/classes/${id}/students`),
  addStudent: (classId, studentId) => api.post(`/classes/${classId}/students/${studentId}`),
  removeStudent: (classId, studentId) => api.delete(`/classes/${classId}/students/${studentId}`),
};

export const examApi = {
  getAll: () => api.get('/exams'),
  getById: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.put(`/exams/${id}`, data),
  patch: (id, data) => api.patch(`/exams/${id}`, data),
  delete: (id) => api.delete(`/exams/${id}`),
};

/** CRUD sections under an exam (aligned with student exam structure by section) */
export const examSectionApi = {
  list: (examId) => api.get(`/exams/${examId}/sections`),
  create: (examId, data) => api.post(`/exams/${examId}/sections`, data),
  update: (examId, sectionId, data) => api.put(`/exams/${examId}/sections/${sectionId}`, data),
  delete: (examId, sectionId) => api.delete(`/exams/${examId}/sections/${sectionId}`),
};

export const questionApi = {
  getAll: (examId) =>
    api.get('/questions', { params: examId != null && examId !== '' ? { examId } : {} }),
  create: (data) => api.post('/questions', data),
  createBulk: (questions) => api.post('/questions/bulk', { questions }),
  update: (id, data) => api.put(`/questions/${id}`, data),
  delete: (id) => api.delete(`/questions/${id}`),
};

export const mediaApi = {
  uploadAudio: (file) => uploadAudioMultipart(file),
};

export const scoreApi = {
  getBySubmissionId: (id) => api.get(`/scores/${id}`),
  update: (id, data) => api.put(`/scores/${id}`, data),
};

export const aiApi = {
  imageOcrTts: (file) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'image.png');
    // Let the browser/axios set multipart boundary automatically.
    return api.post('/ai/image-ocr-tts', formData, { headers: {} });
  },
  ocrPaper: (file) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'paper.pdf');
    return api.post('/ai/ocr-paper', formData, { headers: {} });
  },
  ocrToQuestion: (file, sectionId, points = 1, correctChoiceIndex = 0, questionType = 'MULTIPLE_CHOICE') => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'image.png');
    formData.append('sectionId', String(sectionId));
    formData.append('points', String(points));
    formData.append('correctChoiceIndex', String(correctChoiceIndex));
    formData.append('questionType', String(questionType));
    return api.post('/ai/ocr-to-question', formData, { headers: {} });
  },
  scoreSpeaking: (answerId, audioUrl) =>
    api.post('/ai/score-speaking', {
      answerId,
      audioUrl,
    }),
  scoreWriting: (answerId, essayText, customPrompt) =>
    api.post('/ai/score-writing', {
      answerId,
      essayText,
      customPrompt,
    }),
  tts: (text) => api.post('/ai/tts', { text }),
};

export const writingReviewApi = {
  generateDraft: (answerId, customPrompt) =>
    api.post(`/writing-reviews/answers/${answerId}/generate-draft`, { customPrompt }),
  updateDraft: (answerId, data) =>
    api.put(`/writing-reviews/answers/${answerId}`, data),
  approvePublish: (answerId) =>
    api.post(`/writing-reviews/answers/${answerId}/approve-publish`),
  revertDraft: (answerId) =>
    api.post(`/writing-reviews/answers/${answerId}/revert-draft`),
};

export const speakingReviewApi = {
  generateDraft: (answerId, customPrompt, language = 'en') =>
    api.post(`/speaking-reviews/answers/${answerId}/generate-draft`, { customPrompt, language }),
  updateDraft: (answerId, data) =>
    api.put(`/speaking-reviews/answers/${answerId}`, data),
  approvePublish: (answerId) =>
    api.post(`/speaking-reviews/answers/${answerId}/approve-publish`),
  revertDraft: (answerId) =>
    api.post(`/speaking-reviews/answers/${answerId}/revert-draft`),
};

export const submissionApi = {
  getByExamId: (examId) => api.get('/submissions', { params: { examId } }),
  getById: (id) => api.get(`/submissions/${id}`),
  getAnswers: (id) => api.get(`/submissions/${id}/answers`),
  getAnswersBatch: (submissionIds) => api.get('/submissions/answers', { params: { submissionId: submissionIds } }),
  delete: (id) => api.delete(`/submissions/${id}`),
  downloadSpeaking: (submissionId, answerId) =>
    api.get(`/submissions/${submissionId}/answers/${answerId}/speaking`, { responseType: 'blob' }),
};

export { API_ORIGIN };

export default api;
