import axios from 'axios';
import { API_BASE_URL, API_ORIGIN } from '../../../packages/utils/constants.js';

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
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(e);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
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
  create: (data) => api.post('/students', data),
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
  scoreSpeaking: (answerId, audioUrl) =>
    api.post('/ai/score-speaking', {
      answerId,
      audioUrl,
    }),
  tts: (text) => api.post('/ai/tts', { text }),
};

export const submissionApi = {
  getByExamId: (examId) => api.get('/submissions', { params: { examId } }),
  getById: (id) => api.get(`/submissions/${id}`),
  getAnswers: (id) => api.get(`/submissions/${id}/answers`),
  delete: (id) => api.delete(`/submissions/${id}`),
  downloadSpeaking: (submissionId, answerId) =>
    api.get(`/submissions/${submissionId}/answers/${answerId}/speaking`, { responseType: 'blob' }),
};

export { API_ORIGIN };

export default api;