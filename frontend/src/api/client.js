// src/api/client.js
// Axios instance for all backend API calls.
//
// TODO: Update BASE_URL when deploying to a real server.
//       Consider moving it to an .env variable (VITE_API_BASE_URL).

import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
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

export default apiClient;
