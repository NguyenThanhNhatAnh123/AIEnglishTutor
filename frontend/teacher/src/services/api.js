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
  create: (data) => api.post('/classes', data),
  delete: (id) => api.delete(`/classes/${id}`),
  getStudents: (id) => api.get(`/classes/${id}/students`),
};

export const examApi = {
  getAll: () => api.get('/exams'),
  getById: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.put(`/exams/${id}`, data),
  patch: (id, data) => api.patch(`/exams/${id}`, data), // thêm để dùng cho Publish
  delete: (id) => api.delete(`/exams/${id}`),
};

export const questionApi = {
  getAll: () => api.get('/questions'),
  create: (data) => api.post('/questions', data),
};

export const scoreApi = {
  getBySubmissionId: (id) => api.get(`/scores/${id}`),
  update: (id, data) => api.put(`/scores/${id}`, data),
};

export const submissionApi = {
  getByExamId: (examId) => api.get('/submissions', { params: { examId } }),
  getById: (id) => api.get(`/submissions/${id}`),
  getAnswers: (id) => api.get(`/submissions/${id}/answers`),
};

export default api;