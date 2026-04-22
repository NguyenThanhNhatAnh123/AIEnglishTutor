import axios from 'axios';
import { API_BASE_URL, API_ORIGIN } from '../../../packages/utils/constants.js';

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
  register: (data) => api.post('/auth/register', data),
};

export const studentApi = {
  getMe: () => api.get('/students/me'),
};

/** Student-safe exam APIs (no correct answers, only ACTIVE exams) */
export const studentExamApi = {
  /** Returns only ACTIVE exams — students never see DRAFT/CLOSED */
  getActiveExams: () => api.get('/student/exams'),
  start: (examId) => api.post(`/student/exams/${examId}/start`),
  getExam: (examId) => api.get(`/student/exams/${examId}`),
  saveAnswer: (body) => api.post('/student/answers', body),
  submit: (submissionId, body) =>
    api.post(`/student/submissions/${submissionId}/submit`, body ?? {}),
  /** Load saved answers for exam resume */
  getAnswers: (submissionId) => api.get(`/student/submissions/${submissionId}/answers`),
};

export const submissionApi = {
  /** Student's own submission history */
  getMy: () => api.get('/submissions/my'),
};

export const scoreApi = {
  getBySubmissionId: (id) => api.get(`/scores/${id}`),
};

/** Media upload (audio recording) */
export const mediaApi = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'recording.webm');
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

/** Speaking answers → uploads/audio/speaking/ (student only) */
export const speakingApi = {
  upload: (blob, submissionId, questionId) => {
    const formData = new FormData();
    formData.append('file', blob, blob.type?.includes('webm') ? 'recording.webm' : 'recording.dat');
    formData.append('submissionId', String(submissionId));
    formData.append('questionId', String(questionId));
    return api.post('/speaking/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export { API_ORIGIN };

export default api;
