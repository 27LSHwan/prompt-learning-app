import axios from 'axios';
import { getApiBaseUrl } from './runtime-env';

const api = axios.create({
  baseURL: `${getApiBaseUrl()}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 with token refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      const baseUrl = getApiBaseUrl();

      if (refreshToken) {
        try {
          const res = await axios.post(`${baseUrl}/api/v1/auth/refresh`, { refresh_token: refreshToken });
          const newToken = res.data.access_token;
          localStorage.setItem('admin_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed, clear auth and redirect to login
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user_id');
          localStorage.removeItem('admin_role');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        // No refresh token, clear auth and redirect to login
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('admin_role');
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
