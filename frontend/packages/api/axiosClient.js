import axios from 'axios';

const BASE_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:8080/api';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT token to every request
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Retry logic for transient errors (network issues, 5xx)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;

    // Only retry on network errors or retryable status codes
    const shouldRetry =
      (!error.response || RETRYABLE_STATUSES.includes(error.response.status)) &&
      config.__retryCount < MAX_RETRIES &&
      config.method !== 'post'; // Don't retry POST (may cause duplicate writes)

    if (shouldRetry) {
      config.__retryCount += 1;
      // Exponential backoff: 1s, 2s, 4s
      const delay = RETRY_DELAY_MS * Math.pow(2, config.__retryCount - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return axiosClient(config);
    }

    // Handle 401 globally – redirect to /login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Prevent redirect loops
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
