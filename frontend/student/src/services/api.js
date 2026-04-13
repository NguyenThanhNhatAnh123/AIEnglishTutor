import axios from 'axios';

const API_BASE = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE,
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
  register: (data) => api.post('/auth/register', data),
};

export const studentApi = {
  getMe: () => api.get('/students/me'),
};

export const examApi = {
  getAll: () => api.get('/exams'),
  /** Teacher/admin only — full exam may include correct option flags */
  getById: (id) => api.get(`/exams/${id}`),
};

/** Student-safe exam taking (no correct answers in payload) */
export const studentExamApi = {
  start: (examId) => api.post(`/student/exams/${examId}/start`),
  getExam: (examId) => api.get(`/student/exams/${examId}`),
  saveAnswer: (body) => api.post('/student/answers', body),
  submit: (submissionId) => api.post(`/student/submissions/${submissionId}/submit`),
};

export const submissionApi = {
  start: (data) => api.post('/submissions/start', data),
  submit: (data) => api.post('/submissions/submit', data),
  getMy: () => api.get('/submissions/my'),
};

export const answerApi = {
  create: (data) => api.post('/answers', data),
};

export const scoreApi = {
  getBySubmissionId: (id) => api.get(`/scores/${id}`),
};

export const aiApi = {
  scoreWriting: (data) => api.post('/ai/score-writing', data),
  scoreSpeaking: (data) => api.post('/ai/score-speaking', data),
};

export default api;
