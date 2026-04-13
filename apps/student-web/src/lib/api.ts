import axios from 'axios';
import { getToken, getRefreshToken, setAuth, clearAuth } from './auth';
import { getApiBaseUrl } from './runtime-env';

const api = axios.create({
  baseURL: `${getApiBaseUrl()}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  cfg.baseURL = `${getApiBaseUrl()}/api/v1`;
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config;

    // Handle 401 and attempt refresh
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const baseUrl = getApiBaseUrl();

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearAuth();
          window.location.href = '/login';
          return Promise.reject(err);
        }

        // Attempt to refresh token
        const refreshRes = await axios.post<{
          access_token: string;
          refresh_token?: string;
        }>(`${baseUrl}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken = refreshRes.data.access_token;
        const newRefreshToken = refreshRes.data.refresh_token;

        // Update stored tokens
        const userId = localStorage.getItem('student_id');
        const role = localStorage.getItem('role');
        if (userId && role) {
          setAuth(newToken, userId, role, newRefreshToken);
        }

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
