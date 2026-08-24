// src/api/auth.js
// Real authentication — calls POST /api/auth/login on the FastAPI backend.

import apiClient from './client';

/**
 * Attempt to log in with username/password.
 * @returns {{ access_token, user_name, role }}
 * @throws Error with a user-readable message on failure
 */
export async function login(username, password) {
  try {
    const response = await apiClient.post('/api/auth/login', { username, password });
    return response.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    throw new Error(detail || 'Login failed. Please check your credentials and try again.');
  }
}
