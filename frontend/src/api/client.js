// src/api/client.js
// Axios instance for all backend API calls.
//
// Base URL is read from the VITE_API_URL env variable (see frontend/.env);
// update that file when deploying to a real server.

import axios from 'axios';

const apiClient = axios.create({
  // NOTE: the variable name here must match the one actually set in
  // frontend/.env (VITE_API_URL) — it previously read VITE_API_BASE_URL,
  // a name .env never set, so the .env value was silently ignored and
  // this always fell back to the localhost default.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the stored auth token to every request if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The backend now actually verifies the token on every request (it used to
// accept anything, including no token at all). If it comes back with 401 —
// missing, expired, or invalid token — clear the stale session and send the
// user back to the login page instead of leaving the current page stuck on
// a raw "Not authenticated" error.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (window.location.pathname !== '/') {
        window.location.assign('/');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;