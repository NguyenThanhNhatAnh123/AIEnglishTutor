import axios from 'axios';
import { API_BASE_URL, API_ORIGIN, APP_BASE_PATH } from '../../../packages/utils/constants.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // If payload is FormData, do NOT force Content-Type.
  // The browser will set "multipart/form-data; boundary=..." automatically.
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
  /** Own submission detail (title, status, timing) — server enforces ownership */
  getById: (submissionId) => api.get(`/submissions/${submissionId}`),
  downloadSpeaking: (submissionId, answerId) =>
    api.get(`/submissions/${submissionId}/answers/${answerId}/speaking`, { responseType: 'blob' }),
};

export const scoreApi = {
  getBySubmissionId: (id) => api.get(`/scores/${id}`),
};

/** Media upload (audio recording) */
export const mediaApi = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file, 'recording.webm');
    return api.post('/media/upload', formData);
  },
};

/** Speaking answers → uploads/audio/speaking/ (student only) */
export const speakingApi = {
  upload: (blob, submissionId, questionId) => {
    const formData = new FormData();
    const ext = blob.type?.includes('webm')
      ? 'webm'
      : blob.type?.includes('ogg')
        ? 'ogg'
        : blob.type?.includes('wav')
          ? 'wav'
          : blob.type?.includes('mpeg') || blob.type?.includes('mp3')
            ? 'mp3'
            : blob.type?.includes('mp4')
              ? 'm4a'
              : 'bin';
    formData.append('file', blob, `recording.${ext}`);
    formData.append('submissionId', String(submissionId));
    formData.append('questionId', String(questionId));
    return api.post('/speaking/upload', formData);
  },
};

export const aiApi = {
  imageOcrTts: (file) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'image.png');
    // Let the browser/axios set multipart boundary automatically.
    return api.post('/ai/image-ocr-tts', formData, { headers: {} });
  },
};

export { API_ORIGIN };

export default api;
