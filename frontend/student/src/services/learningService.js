import axios from 'axios';
import { APP_BASE_PATH } from '../../../packages/utils/constants.js';

const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
const defaultLearningOrigin = import.meta.env.DEV ? 'http://localhost:8081' : runtimeOrigin;
const configuredLearningUrl = import.meta.env.VITE_LEARNING_API_URL || '';
const learningBaseURL = (configuredLearningUrl || `${defaultLearningOrigin}/api`).replace(/\/$/, '');

const learningApi = axios.create({
  baseURL: learningBaseURL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

learningApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

learningApi.interceptors.response.use(
  (response) => {
    const contentType = response.headers?.['content-type'] || '';
    const looksLikeHtml =
      typeof response.data === 'string' && response.data.trim().toLowerCase().startsWith('<!doctype');
    if (looksLikeHtml || contentType.includes('text/html')) {
      return Promise.reject(
        new Error('Learning service is not reachable. Check VITE_LEARNING_API_URL or the /api/learning proxy route.')
      );
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `${window.location.origin}${APP_BASE_PATH}/login`;
    }
    return Promise.reject(error);
  }
);

export const learningService = {
  getDecks: (params = {}) => learningApi.get('/learning/decks', { params }),
  getDeck: (deckId) => learningApi.get(`/learning/decks/${deckId}`),
  getDeckItems: (deckId) => learningApi.get(`/learning/decks/${deckId}/items`),
  enrollDeck: (deckId) => learningApi.post(`/learning/decks/${deckId}/enroll`),
  getDueReviews: ({ deckId, limit = 20 } = {}) =>
    learningApi.get('/learning/reviews/due', { params: { deckId, limit } }),
  submitReview: ({ itemId, rating, requestId }) =>
    learningApi.post('/learning/reviews', { itemId, rating, requestId }),
  getProgress: () => learningApi.get('/learning/progress'),
  getDeckProgress: (deckId) => learningApi.get(`/learning/progress/decks/${deckId}`),
};

export default learningApi;
